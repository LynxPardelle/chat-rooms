import { defineStore } from 'pinia';
import { computed, reactive, watch } from 'vue';
import { SocketService } from '@/core/services/SocketService';
import { StorageService } from '@/core/services/storage.service';
import { ErrorService } from '@/core/services/error.service';
import { useAuthStore } from './auth';
import { useUIStore } from './ui';
import { usePresenceStore } from './presence';
import { useReadReceiptsStore } from './read-receipts';
import type { EnhancedMessage, EnhancedRoom } from '@/types';
import {
  WebSocketEvent,
  type SendMessagePayload,
  type UserJoinedRoomPayload,
  type UserLeftRoomPayload,
  type UserRoomJoinedResponse,
  type UserRoomLeftResponse
} from '@/core/types/enhanced-api.types';

// ================================
// Chat Store Types
// ================================

interface TypingIndicator {
  userId: string;
  username: string;
  roomId: string;
  timestamp: number;
}

interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  customMessage?: string;
}

interface ConnectionQuality {
  latency: number;
  stability: number;
  packetLoss: number;
}

interface MessageDraft {
  roomId: string;
  content: string;
  timestamp: Date;
}

interface OfflineAction {
  type: 'send_message' | 'edit_message' | 'delete_message' | 'mark_room_read';
  payload: any;
  timestamp: Date;
  clientId?: string;
}

type WebSocketConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

/**
 * Chat Store State Interface
 */
interface ChatState {
  // Connection & Status
  connectionState: WebSocketConnectionState;
  connectionQuality: ConnectionQuality;
  isOnline: boolean;
  lastSyncTimestamp: Date | null;
  
  // Messages & Rooms
  messages: Map<string, EnhancedMessage>;
  rooms: Map<string, EnhancedRoom>;
  activeRoomId: string | null;
  messagesByRoom: Map<string, string[]>;
  
  // Real-time Features
  typingIndicators: Map<string, TypingIndicator[]>;
  userPresence: Map<string, UserPresence>;
  onlineUsers: Set<string>;
  
  // Offline Support
  offlineActions: OfflineAction[];
  failedMessages: Map<string, EnhancedMessage>;
  
  // UI State
  drafts: Map<string, MessageDraft>;
  selectedMessages: Set<string>;
  replyingTo: EnhancedMessage | null;
  editingMessage: EnhancedMessage | null;
  
  // Loading States
  loadingStates: Map<string, boolean>;
  
  // Performance
  lastActivity: Date;
}

/**
 * Enterprise Chat Store with Real-time WebSocket Integration
 */
export const useChatStore = defineStore('chat', () => {
  // Services
  const socketService = SocketService.getInstance();
  const storageService = StorageService.getInstance();
  const errorService = ErrorService.getInstance();
    // Store dependencies
  const authStore = useAuthStore();
  const uiStore = useUIStore();
  const presenceStore = usePresenceStore();
  const readReceiptsStore = useReadReceiptsStore();

  // =============================================================================
  // STATE
  // =============================================================================
  
  const state = reactive<ChatState>({
    connectionState: 'disconnected',
    connectionQuality: { latency: 0, stability: 100, packetLoss: 0 },
    isOnline: navigator.onLine,
    lastSyncTimestamp: null,
    
    messages: new Map(),
    rooms: new Map(),
    activeRoomId: null,
    messagesByRoom: new Map(),
    
    typingIndicators: new Map(),
    userPresence: new Map(),
    onlineUsers: new Set(),
    
    offlineActions: [],
    failedMessages: new Map(),
    
    drafts: new Map(),
    selectedMessages: new Set(),
    replyingTo: null,
    editingMessage: null,
    
    loadingStates: new Map(),
    
    lastActivity: new Date()
  });

  // =============================================================================
  // COMPUTED GETTERS
  // =============================================================================
  
  const isConnected = computed(() => state.connectionState === 'connected');
  const isReconnecting = computed(() => state.connectionState === 'reconnecting');
  const hasOfflineActions = computed(() => state.offlineActions.length > 0);
  const failedMessageCount = computed(() => state.failedMessages.size);
  
  const activeRoom = computed(() => 
    state.activeRoomId ? state.rooms.get(state.activeRoomId) : null
  );
  
  const activeRoomMessages = computed(() => {
    if (!state.activeRoomId) return [];
    const messageIds = state.messagesByRoom.get(state.activeRoomId) || [];
    return messageIds
      .map(id => state.messages.get(id))
      .filter(Boolean)
      .sort((a, b) => new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime());
  });
  
  const unreadMessageCount = computed(() => {
    let total = 0;
    for (const room of state.rooms.values()) {
      // Note: EnhancedRoom may not have unreadCount property yet
      // This would need to be added to the type definition
      total += (room as any).unreadCount || 0;
    }
    return total;
  });
  
  const activeTypingUsers = computed(() => {
    if (!state.activeRoomId) return [];
    return state.typingIndicators.get(state.activeRoomId) || [];
  });
  
  const onlineUsersList = computed(() => 
    Array.from(state.onlineUsers).map(userId => state.userPresence.get(userId)).filter(Boolean)
  );

  // =============================================================================
  // WEBSOCKET CONNECTION MANAGEMENT
  // =============================================================================
  
  const connectWebSocket = async (): Promise<void> => {
    try {
      state.connectionState = 'connecting';
      
      await socketService.connect();
      
      // Setup basic event listeners
      setupWebSocketListeners();
      
      // Join previously active room
      if (state.activeRoomId) {
        await joinRoom(state.activeRoomId);
      }
      
      // Sync offline actions
      await syncOfflineActions();
      
      state.connectionState = 'connected';
      state.lastSyncTimestamp = new Date();
      
      // Show success notification
      uiStore.showSuccess('Connected to chat');
      
    } catch (error) {
      state.connectionState = 'failed';
      errorService.handleError(error as Error);
      throw error;
    }
  };
  
  const disconnectWebSocket = (): void => {
    socketService.disconnect();
    state.connectionState = 'disconnected';
    clearRealTimeState();
  };
  const setupWebSocketListeners = (): void => {
    // Use existing WebSocket events that are actually defined
    socketService.on(WebSocketEvent.RECEIVE_MESSAGE, handleMessageReceived);
    socketService.on(WebSocketEvent.JOINED_ROOM, handleRoomJoined);
    socketService.on(WebSocketEvent.LEFT_ROOM, handleRoomLeft);
    socketService.on(WebSocketEvent.TYPING_UPDATED, handleTypingUpdated);
    socketService.on(WebSocketEvent.USER_JOINED, handleUserJoined);
    socketService.on(WebSocketEvent.USER_LEFT, handleUserLeft);
    
    // Enhanced Chat State Events
    socketService.on(WebSocketEvent.USER_ROOM_JOINED, handleUserRoomJoined);
    socketService.on(WebSocketEvent.USER_ROOM_LEFT, handleUserRoomLeft);
    
    // Initialize specialized stores
    presenceStore.initialize();
    readReceiptsStore.initialize();
    
    // Connection events
    socketService.on('connection_quality', handleConnectionQuality);
    socketService.on('error', handleWebSocketError);
  };

  // =============================================================================
  // MESSAGE OPERATIONS
  // =============================================================================
    const sendMessage = async (content: string, roomId?: string): Promise<void> => {
    const targetRoomId = roomId || state.activeRoomId;
    if (!targetRoomId) throw new Error('No active room');
    
    const messageData: SendMessagePayload = {
      content
    };
    
    try {
      // Stop typing when sending message
      await stopTyping(targetRoomId);
      
      if (isConnected.value) {
        // Send via WebSocket using existing method
        await socketService.sendMessage(targetRoomId, content);
      } else {
        // Queue for offline sync with room context
        queueOfflineAction({
          type: 'send_message',
          payload: { ...messageData, roomId: targetRoomId },
          timestamp: new Date()
        });
        
        uiStore.showInfo('Message queued for sending');
      }
    } catch (error) {
      uiStore.showError('Failed to send message');
      throw error;
    }
  };

  // =============================================================================
  // ROOM OPERATIONS
  // =============================================================================
    const joinRoom = async (roomId: string): Promise<void> => {
    if (state.activeRoomId === roomId) return;
    
    try {
      state.loadingStates.set(`room_${roomId}`, true);
      
      if (isConnected.value) {
        // Use existing SocketService method
        await socketService.joinRoom(roomId);
        
        // Emit enhanced room join event
        if (authStore.user?.id) {
          const payload: UserJoinedRoomPayload = {
            roomId,
            userId: authStore.user.id
          };
          await socketService.emit(WebSocketEvent.USER_JOINED_ROOM, payload);
        }
      }
      
      // Update active room
      if (state.activeRoomId) {
        await leaveRoom(state.activeRoomId);
      }
      
      state.activeRoomId = roomId;
      
      // Mark messages in room as read
      const messageIds = state.messagesByRoom.get(roomId) || [];
      if (messageIds.length > 0) {
        const latestMessageId = messageIds[messageIds.length - 1];
        await readReceiptsStore.markMessageAsRead(latestMessageId, roomId);
      }
      
      // Save to storage
      storageService.setItem('activeRoomId', roomId, { persistent: true });
      
    } finally {
      state.loadingStates.delete(`room_${roomId}`);
    }
  };
  
  const leaveRoom = async (roomId: string): Promise<void> => {
    if (isConnected.value) {
      await socketService.leaveRoom(roomId);
      
      // Emit enhanced room leave event
      if (authStore.user?.id) {
        const payload: UserLeftRoomPayload = {
          roomId,
          userId: authStore.user.id
        };
        await socketService.emit(WebSocketEvent.USER_LEFT_ROOM, payload);
      }
    }
    
    // Stop typing in the room
    await presenceStore.stopTyping(roomId);
    
    // Clear room-specific state
    state.typingIndicators.delete(roomId);
    
    if (state.activeRoomId === roomId) {
      state.activeRoomId = null;
      storageService.removeItem('activeRoomId');
    }
  };

  // =============================================================================
  // REAL-TIME FEATURES
  // =============================================================================
    const startTyping = async (roomId?: string): Promise<void> => {
    const targetRoomId = roomId || state.activeRoomId;
    if (!targetRoomId || !isConnected.value) return;
    
    // Use enhanced presence store for typing
    await presenceStore.startTyping(targetRoomId);
  };
  
  const stopTyping = async (roomId?: string): Promise<void> => {
    const targetRoomId = roomId || state.activeRoomId;
    if (!targetRoomId || !isConnected.value) return;
    
    // Use enhanced presence store for typing
    await presenceStore.stopTyping(targetRoomId);
  };
    const updatePresence = async (status: UserPresence['status'], customMessage?: string): Promise<void> => {
    if (!isConnected.value) return;
    
    // Use enhanced presence store for status updates
    await presenceStore.updateOwnPresence(status, customMessage);
  };

  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================
  
  const addMessageToStore = (message: EnhancedMessage): void => {
    state.messages.set(message.id, message);
    
    const roomMessages = state.messagesByRoom.get(message.roomId) || [];
    if (!roomMessages.includes(message.id)) {
      roomMessages.push(message.id);
      state.messagesByRoom.set(message.roomId, roomMessages);
    }
  };
    const queueOfflineAction = (action: OfflineAction): void => {
    state.offlineActions.push(action);
    storageService.setItem('offlineActions', state.offlineActions, { persistent: true });
  };
  
  const syncOfflineActions = async (): Promise<void> => {
    if (state.offlineActions.length === 0) return;
    
    const actions = [...state.offlineActions];
    state.offlineActions = [];
    storageService.removeItem('offlineActions');
    
    for (const action of actions) {
      try {
        switch (action.type) {          case 'send_message':
            const sendPayload = action.payload as SendMessagePayload & { roomId: string };
            await sendMessage(sendPayload.content, sendPayload.roomId);
            break;
          // Add other action types as needed
        }
      } catch (error) {
        // Re-queue failed actions
        state.offlineActions.push(action);
        errorService.handleError(error as Error);
      }
    }
    
    storageService.setItem('offlineActions', state.offlineActions, { persistent: true });
  };
  
  const clearRealTimeState = (): void => {
    state.typingIndicators.clear();
    state.onlineUsers.clear();
    state.userPresence.clear();
  };

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================
  
  const handleMessageReceived = (message: EnhancedMessage): void => {
    addMessageToStore(message);
    
    // Show notification for mentions or if not in active room
    if (message.roomId !== state.activeRoomId) {
      uiStore.showInfo(`New message in ${message.roomId}`);
    }
  };
  
  const handleRoomJoined = (data: { roomId: string; messages?: EnhancedMessage[] }): void => {
    if (data.messages) {
      data.messages.forEach(addMessageToStore);
    }
  };
  
  const handleRoomLeft = (data: { roomId: string }): void => {
    state.typingIndicators.delete(data.roomId);
  };
    const handleTypingUpdated = (data: { userId: string; username: string; roomId: string; isTyping: boolean }): void => {
    const user = authStore.user;
    const currentUserId = user && typeof user === 'object' && 'id' in user ? (user as any).id : null;
    if (data.userId === currentUserId) return;
    
    const indicators = state.typingIndicators.get(data.roomId) || [];
    const existing = indicators.find(i => i.userId === data.userId);
    
    if (data.isTyping && !existing) {
      indicators.push({
        userId: data.userId,
        username: data.username,
        roomId: data.roomId,
        timestamp: Date.now()
      });
      state.typingIndicators.set(data.roomId, indicators);
    } else if (!data.isTyping && existing) {
      const filtered = indicators.filter(i => i.userId !== data.userId);
      if (filtered.length === 0) {
        state.typingIndicators.delete(data.roomId);
      } else {
        state.typingIndicators.set(data.roomId, filtered);
      }
    }
  };
  
  const handleUserJoined = (data: { userId: string; roomId: string }): void => {
    state.onlineUsers.add(data.userId);
  };
    const handleUserLeft = (data: { userId: string; roomId: string }): void => {
    state.onlineUsers.delete(data.userId);
  };

  // Enhanced Chat State Event Handlers
  const handleUserRoomJoined = (data: UserRoomJoinedResponse): void => {
    // Update room member count or member list if available
    const room = state.rooms.get(data.roomId);
    if (room) {
      // Room member management would go here
      // This could update a members array or count
    }
    
    // Emit to presence store for tracking
    presenceStore.handlePresenceUpdate({
      userId: data.userId,
      username: data.username,
      status: 'online',
      lastSeen: data.joinedAt
    });
  };

  const handleUserRoomLeft = (data: UserRoomLeftResponse): void => {
    // Update room member count or member list if available
    const room = state.rooms.get(data.roomId);
    if (room) {
      // Room member management would go here
    }
    
    // Update presence status
    presenceStore.handlePresenceUpdate({
      userId: data.userId,
      username: data.username,
      status: 'offline',
      lastSeen: data.leftAt
    });
  };
  
  const handleConnectionQuality = (quality: ConnectionQuality): void => {
    state.connectionQuality = quality;
  };
  
  const handleWebSocketError = (error: any): void => {
    errorService.handleWebSocketError(error, 'Chat WebSocket error');
  };

  // =============================================================================
  // LIFECYCLE & WATCHERS
  // =============================================================================
  
  // Watch online status
  watch(() => navigator.onLine, (isOnline) => {
    state.isOnline = isOnline;
    if (isOnline && state.connectionState === 'disconnected') {
      connectWebSocket().catch(error => {
        errorService.handleError(error);
      });
    }
  });
  
  // Auto-connect when authenticated
  watch(() => authStore.isAuthenticated, (isAuthenticated) => {
    if (isAuthenticated && state.connectionState === 'disconnected') {
      connectWebSocket().catch(error => {
        errorService.handleError(error);
      });
    } else if (!isAuthenticated) {
      disconnectWebSocket();
    }
  });
  
  // Load persisted data on initialization
  const initializeStore = (): void => {
    // Load offline actions
    const savedActions = storageService.getItem('offlineActions') as OfflineAction[] | null;
    if (savedActions) {
      state.offlineActions = savedActions;
    }
    
    // Load active room
    const savedActiveRoom = storageService.getItem('activeRoomId') as string | null;
    if (savedActiveRoom) {
      state.activeRoomId = savedActiveRoom;
    }
    
    // Auto-connect if authenticated
    if (authStore.isAuthenticated) {
      connectWebSocket().catch(error => {
        errorService.handleError(error);
      });
    }
  };
  
  // Initialize on store creation
  initializeStore();

  // =============================================================================
  // PUBLIC API
  // =============================================================================
  
  return {
    // State (readonly)
    connectionState: computed(() => state.connectionState),
    connectionQuality: computed(() => state.connectionQuality),
    isOnline: computed(() => state.isOnline),
    isConnected,
    isReconnecting,
    hasOfflineActions,
    failedMessageCount,
    
    // Data
    activeRoom,
    activeRoomMessages,
    unreadMessageCount,
    activeTypingUsers,
    onlineUsersList,
    
    // Connection Management
    connectWebSocket,
    disconnectWebSocket,
    
    // Message Operations
    sendMessage,
    
    // Room Operations
    joinRoom,
    leaveRoom,
    
    // Real-time Features
    startTyping,
    stopTyping,
    updatePresence,
      // Utility
    syncOfflineActions,
    
    // Enhanced Stores Integration
    presenceStore,
    readReceiptsStore,
    
    // Direct state access (for advanced use cases)
    $state: state
  };
});