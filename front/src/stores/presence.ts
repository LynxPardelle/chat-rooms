import { defineStore } from 'pinia';
import { computed, reactive, ref, readonly } from 'vue';
import { SocketService } from '@/core/services/SocketService';
import { useAuthStore } from './auth';
import { 
  WebSocketEvent,
  type UserPresenceUpdatePayload,
  type PresenceUpdateResponse,
  type TypingIndicatorResponse,
  type UserStartTypingPayload,
  type UserStopTypingPayload
} from '@/core/types/enhanced-api.types';

// ================================
// Presence Store Types
// ================================

interface UserPresence {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  customMessage?: string;
  lastActivity: number;
}

interface TypingIndicator {
  userId: string;
  username: string;
  roomId: string;
  timestamp: number;
}

interface PresenceState {
  userPresence: Map<string, UserPresence>;
  typingIndicators: Map<string, TypingIndicator[]>; // roomId -> typing users
  onlineUsers: Set<string>;
  ownStatus: 'online' | 'away' | 'busy' | 'offline';
  ownCustomMessage: string;
  lastActivityTime: number;
  autoAwayEnabled: boolean;
  autoAwayDelay: number; // milliseconds
}

/**
 * Enhanced Presence Store
 * Manages user presence, typing indicators, and activity tracking
 */
export const usePresenceStore = defineStore('presence', () => {
  // Services
  const socketService = SocketService.getInstance();
  const authStore = useAuthStore();

  // =============================================================================
  // STATE
  // =============================================================================
  
  const state = reactive<PresenceState>({
    userPresence: new Map(),
    typingIndicators: new Map(),
    onlineUsers: new Set(),
    ownStatus: 'online',
    ownCustomMessage: '',
    lastActivityTime: Date.now(),
    autoAwayEnabled: true,
    autoAwayDelay: 300000, // 5 minutes
  });

  // Timers
  const typingTimeouts = new Map<string, NodeJS.Timeout>();
  const activityCheckInterval = ref<NodeJS.Timeout | null>(null);

  // =============================================================================
  // COMPUTED GETTERS
  // =============================================================================
  
  const isOnline = computed(() => state.ownStatus === 'online');
  const isAway = computed(() => state.ownStatus === 'away');
  const isBusy = computed(() => state.ownStatus === 'busy');
  const isOffline = computed(() => state.ownStatus === 'offline');

  const onlineUsersList = computed(() => 
    Array.from(state.onlineUsers).map(userId => state.userPresence.get(userId)).filter(Boolean)
  );

  const onlineUsersCount = computed(() => state.onlineUsers.size);

  const getTypingUsersInRoom = (roomId: string) => computed(() => 
    state.typingIndicators.get(roomId) || []
  );

  const getUserPresence = (userId: string) => computed(() => 
    state.userPresence.get(userId)
  );

  const getTypingIndicatorsForRoom = (roomId: string) => computed(() => {
    const indicators = state.typingIndicators.get(roomId) || [];
    // Filter out own typing indicator and expired ones
    const currentTime = Date.now();
    return indicators.filter(indicator => 
      indicator.userId !== authStore.user?.id && 
      (currentTime - indicator.timestamp) < 5000 // 5 seconds expiry
    );
  });

  // =============================================================================
  // PRESENCE MANAGEMENT
  // =============================================================================

  const updateOwnPresence = async (
    status: 'online' | 'away' | 'busy' | 'offline',
    customMessage?: string
  ): Promise<void> => {
    try {
      const payload: UserPresenceUpdatePayload = {
        status,
        customMessage
      };

      state.ownStatus = status;
      if (customMessage !== undefined) {
        state.ownCustomMessage = customMessage;
      }

      await socketService.emit(WebSocketEvent.USER_PRESENCE_UPDATE, payload);
    } catch (error) {
      console.error('Failed to update presence:', error);
      throw error;
    }
  };

  const setOnline = () => updateOwnPresence('online');
  const setAway = (message?: string) => updateOwnPresence('away', message);
  const setBusy = (message?: string) => updateOwnPresence('busy', message);
  const setOffline = () => updateOwnPresence('offline');

  const handlePresenceUpdate = (data: PresenceUpdateResponse): void => {
    const presence: UserPresence = {
      userId: data.userId,
      username: data.username,
      status: data.status,
      lastSeen: data.lastSeen,
      customMessage: data.customMessage,
      lastActivity: Date.now()
    };

    state.userPresence.set(data.userId, presence);

    // Update online users set
    if (data.status === 'online') {
      state.onlineUsers.add(data.userId);
    } else {
      state.onlineUsers.delete(data.userId);
    }
  };

  // =============================================================================
  // TYPING INDICATORS
  // =============================================================================

  const startTyping = async (roomId: string): Promise<void> => {
    if (!authStore.user?.id) return;

    try {
      const payload: UserStartTypingPayload = {
        roomId,
        userId: authStore.user.id
      };

      await socketService.emit(WebSocketEvent.USER_START_TYPING, payload);

      // Auto-stop typing after 3 seconds of inactivity
      const timeoutKey = `${roomId}_${authStore.user.id}`;
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey)!);
      }

      const timeout = setTimeout(() => {
        stopTyping(roomId);
      }, 3000);

      typingTimeouts.set(timeoutKey, timeout);
    } catch (error) {
      console.error('Failed to start typing:', error);
    }
  };

  const stopTyping = async (roomId: string): Promise<void> => {
    if (!authStore.user?.id) return;

    try {
      const payload: UserStopTypingPayload = {
        roomId,
        userId: authStore.user.id
      };

      await socketService.emit(WebSocketEvent.USER_STOP_TYPING, payload);

      // Clear timeout
      const timeoutKey = `${roomId}_${authStore.user.id}`;
      if (typingTimeouts.has(timeoutKey)) {
        clearTimeout(typingTimeouts.get(timeoutKey)!);
        typingTimeouts.delete(timeoutKey);
      }
    } catch (error) {
      console.error('Failed to stop typing:', error);
    }
  };

  const handleTypingIndicator = (data: TypingIndicatorResponse): void => {
    const { roomId, userId, username, isTyping, timestamp } = data;

    if (!state.typingIndicators.has(roomId)) {
      state.typingIndicators.set(roomId, []);
    }

    const indicators = state.typingIndicators.get(roomId)!;
    const existingIndex = indicators.findIndex(indicator => indicator.userId === userId);

    if (isTyping) {
      const typingIndicator: TypingIndicator = {
        userId,
        username,
        roomId,
        timestamp
      };

      if (existingIndex >= 0) {
        indicators[existingIndex] = typingIndicator;
      } else {
        indicators.push(typingIndicator);
      }
    } else {
      if (existingIndex >= 0) {
        indicators.splice(existingIndex, 1);
      }
    }
  };

  // =============================================================================
  // ACTIVITY TRACKING
  // =============================================================================

  const updateActivity = (): void => {
    state.lastActivityTime = Date.now();
    
    // If we were away due to inactivity, set back to online
    if (state.ownStatus === 'away' && state.autoAwayEnabled) {
      updateOwnPresence('online');
    }
  };

  const startActivityTracking = (): void => {
    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const activityHandler = () => updateActivity();
    
    events.forEach(event => {
      document.addEventListener(event, activityHandler, { passive: true });
    });

    // Check for inactivity every minute
    if (activityCheckInterval.value) {
      clearInterval(activityCheckInterval.value);
    }

    activityCheckInterval.value = setInterval(() => {
      if (state.autoAwayEnabled && state.ownStatus === 'online') {
        const timeSinceActivity = Date.now() - state.lastActivityTime;
        if (timeSinceActivity >= state.autoAwayDelay) {
          updateOwnPresence('away', 'Away due to inactivity');
        }
      }
    }, 60000); // Check every minute
  };

  const stopActivityTracking = (): void => {
    if (activityCheckInterval.value) {
      clearInterval(activityCheckInterval.value);
      activityCheckInterval.value = null;
    }
  };

  // =============================================================================
  // CLEANUP
  // =============================================================================

  const cleanup = (): void => {
    // Clear all typing timeouts
    for (const timeout of typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    typingTimeouts.clear();

    // Stop activity tracking
    stopActivityTracking();

    // Clear state
    state.userPresence.clear();
    state.typingIndicators.clear();
    state.onlineUsers.clear();
  };

  // =============================================================================
  // WEBSOCKET EVENT SETUP
  // =============================================================================

  const setupPresenceListeners = (): void => {
    socketService.on(WebSocketEvent.PRESENCE_UPDATED, handlePresenceUpdate);
    socketService.on(WebSocketEvent.TYPING_INDICATOR_UPDATED, handleTypingIndicator);
  };

  const removePresenceListeners = (): void => {
    socketService.off(WebSocketEvent.PRESENCE_UPDATED, handlePresenceUpdate);
    socketService.off(WebSocketEvent.TYPING_INDICATOR_UPDATED, handleTypingIndicator);
  };

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  const initialize = (): void => {
    setupPresenceListeners();
    startActivityTracking();
    updateOwnPresence('online');
  };

  const destroy = (): void => {
    removePresenceListeners();
    cleanup();
  };

  // =============================================================================
  // RETURN PUBLIC API
  // =============================================================================

  return {
    // State
    state: readonly(state),
    
    // Computed
    isOnline,
    isAway,
    isBusy,
    isOffline,
    onlineUsersList,
    onlineUsersCount,
    
    // Getters
    getTypingUsersInRoom,
    getUserPresence,
    getTypingIndicatorsForRoom,
    
    // Presence actions
    updateOwnPresence,
    setOnline,
    setAway,
    setBusy,
    setOffline,
    
    // Typing actions
    startTyping,
    stopTyping,
    
    // Activity tracking
    updateActivity,
    startActivityTracking,
    stopActivityTracking,
    
    // Lifecycle
    initialize,
    destroy,
    cleanup,
    
    // Event handlers (for external use)
    handlePresenceUpdate,
    handleTypingIndicator
  };
});
