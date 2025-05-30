import { defineStore } from 'pinia';
import { computed, reactive, readonly } from 'vue';
import { SocketService } from '@/core/services/SocketService';
import { useAuthStore } from './auth';
import { 
  WebSocketEvent,
  type MessageReadPayload,
  type ReadReceiptResponse,
  type NotificationResponse
} from '@/core/types/enhanced-api.types';

// ================================
// Read Receipts & Notifications Store Types
// ================================

interface ReadReceipt {
  messageId: string;
  roomId: string;
  userId: string;
  username: string;
  readAt: string;
}

interface MessageReadStatus {
  messageId: string;
  roomId: string;
  deliveredTo: Set<string>;
  readBy: Map<string, string>; // userId -> readAt timestamp
  totalRecipients: number;
}

interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'reaction' | 'room_invite';
  title: string;
  body: string;
  data?: Record<string, any>;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
}

interface NotificationSettings {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  messageNotifications: boolean;
  mentionNotifications: boolean;
  reactionNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:mm format
  quietHoursEnd: string; // HH:mm format
}

interface ReadReceiptsState {
  // Read receipts
  messageReadStatus: Map<string, MessageReadStatus>;
  readReceipts: Map<string, ReadReceipt[]>; // messageId -> receipts
  
  // Notifications
  notifications: Map<string, Notification>;
  unreadNotifications: Set<string>;
  notificationSettings: NotificationSettings;
  
  // UI state
  showReadReceipts: boolean;
  notificationPermission: NotificationPermission;
}

/**
 * Read Receipts and Notifications Store
 * Manages message read tracking and user notifications
 */
export const useReadReceiptsStore = defineStore('readReceipts', () => {
  // Services
  const socketService = SocketService.getInstance();
  const authStore = useAuthStore();

  // =============================================================================
  // STATE
  // =============================================================================
  
  const state = reactive<ReadReceiptsState>({
    messageReadStatus: new Map(),
    readReceipts: new Map(),
    
    notifications: new Map(),
    unreadNotifications: new Set(),
    notificationSettings: {
      soundEnabled: true,
      desktopEnabled: true,
      messageNotifications: true,
      mentionNotifications: true,
      reactionNotifications: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00'
    },
    
    showReadReceipts: true,
    notificationPermission: Notification.permission
  });

  // =============================================================================
  // COMPUTED GETTERS
  // =============================================================================
  
  const unreadNotificationCount = computed(() => state.unreadNotifications.size);
  
  const hasUnreadNotifications = computed(() => state.unreadNotifications.size > 0);
  
  const recentNotifications = computed(() => 
    Array.from(state.notifications.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  );

  const getMessageReadStatus = (messageId: string) => computed(() => 
    state.messageReadStatus.get(messageId)
  );

  const getReadReceiptsForMessage = (messageId: string) => computed(() => 
    state.readReceipts.get(messageId) || []
  );

  const isMessageRead = (messageId: string, userId?: string) => computed(() => {
    const status = state.messageReadStatus.get(messageId);
    if (!status) return false;
    
    if (userId) {
      return status.readBy.has(userId);
    }
    
    // Check if read by current user
    return status.readBy.has(authStore.user?.id || '');
  });

  const getMessageDeliveryStats = (messageId: string) => computed(() => {
    const status = state.messageReadStatus.get(messageId);
    if (!status) {
      return { delivered: 0, read: 0, total: 0, deliveryRate: 0, readRate: 0 };
    }

    const delivered = status.deliveredTo.size;
    const read = status.readBy.size;
    const total = status.totalRecipients;

    return {
      delivered,
      read,
      total,
      deliveryRate: total > 0 ? (delivered / total) * 100 : 0,
      readRate: total > 0 ? (read / total) * 100 : 0
    };
  });

  // =============================================================================
  // READ RECEIPTS MANAGEMENT
  // =============================================================================

  const markMessageAsRead = async (messageId: string, roomId: string): Promise<void> => {
    if (!authStore.user?.id) return;

    try {
      const payload: MessageReadPayload = {
        messageId,
        roomId,
        userId: authStore.user.id
      };

      await socketService.emit(WebSocketEvent.MESSAGE_READ, payload);

      // Update local state optimistically
      updateLocalReadStatus(messageId, authStore.user.id, new Date().toISOString());
    } catch (error) {
      console.error('Failed to mark message as read:', error);
      throw error;
    }
  };

  const markRoomAsRead = async (roomId: string, messageIds: string[]): Promise<void> => {
    try {
      // Mark multiple messages as read in batch
      const promises = messageIds.map(messageId => markMessageAsRead(messageId, roomId));
      await Promise.all(promises);
    } catch (error) {
      console.error('Failed to mark room as read:', error);
      throw error;
    }
  };

  const updateLocalReadStatus = (messageId: string, userId: string, readAt: string): void => {
    let status = state.messageReadStatus.get(messageId);
    
    if (!status) {
      status = {
        messageId,
        roomId: '', // Will be updated when we have room context
        deliveredTo: new Set(),
        readBy: new Map(),
        totalRecipients: 0
      };
      state.messageReadStatus.set(messageId, status);
    }

    status.readBy.set(userId, readAt);
  };

  const handleReadReceiptUpdate = (data: ReadReceiptResponse): void => {
    const receipt: ReadReceipt = {
      messageId: data.messageId,
      roomId: data.roomId,
      userId: data.userId,
      username: data.username,
      readAt: data.readAt
    };

    // Update read receipts collection
    if (!state.readReceipts.has(data.messageId)) {
      state.readReceipts.set(data.messageId, []);
    }
    
    const receipts = state.readReceipts.get(data.messageId)!;
    const existingIndex = receipts.findIndex(r => r.userId === data.userId);
    
    if (existingIndex >= 0) {
      receipts[existingIndex] = receipt;
    } else {
      receipts.push(receipt);
    }

    // Update message read status
    updateLocalReadStatus(data.messageId, data.userId, data.readAt);
  };

  // =============================================================================
  // NOTIFICATIONS MANAGEMENT
  // =============================================================================

  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      state.notificationPermission = permission;
      return permission;
    }

    return Notification.permission;
  };

  const isInQuietHours = (): boolean => {
    if (!state.notificationSettings.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { quietHoursStart, quietHoursEnd } = state.notificationSettings;
    
    // Handle cases where quiet hours span midnight
    if (quietHoursStart > quietHoursEnd) {
      return currentTime >= quietHoursStart || currentTime <= quietHoursEnd;
    } else {
      return currentTime >= quietHoursStart && currentTime <= quietHoursEnd;
    }
  };

  const shouldShowNotification = (type: Notification['type']): boolean => {
    if (isInQuietHours()) return false;

    const settings = state.notificationSettings;
    
    switch (type) {
      case 'message':
        return settings.messageNotifications;
      case 'mention':
        return settings.mentionNotifications;
      case 'reaction':
        return settings.reactionNotifications;
      case 'room_invite':
        return true; // Always show room invites
      default:
        return true;
    }
  };

  const showDesktopNotification = (notification: Notification): void => {
    if (!state.notificationSettings.desktopEnabled) return;
    if (state.notificationPermission !== 'granted') return;
    if (!shouldShowNotification(notification.type)) return;

    const browserNotification = new Notification(notification.title, {
      body: notification.body,
      icon: '/favicon.ico', // Adjust path as needed
      tag: notification.id,
      data: notification.data
    });

    // Auto-close after 5 seconds
    setTimeout(() => {
      browserNotification.close();
    }, 5000);

    browserNotification.onclick = () => {
      window.focus();
      markNotificationAsRead(notification.id);
      browserNotification.close();
    };
  };

  const playNotificationSound = (): void => {
    if (!state.notificationSettings.soundEnabled) return;

    try {
      // Create and play notification sound
      const audio = new Audio('/sounds/notification.mp3'); // Adjust path as needed
      audio.volume = 0.5;
      audio.play().catch(err => {
        console.warn('Could not play notification sound:', err);
      });
    } catch (error) {
      console.warn('Notification sound error:', error);
    }
  };

  const addNotification = (notificationData: NotificationResponse): void => {
    const notification: Notification = {
      ...notificationData,
      read: false,
      dismissed: false
    };

    state.notifications.set(notification.id, notification);
    state.unreadNotifications.add(notification.id);

    // Show desktop notification if enabled and appropriate
    if (shouldShowNotification(notification.type)) {
      showDesktopNotification(notification);
      playNotificationSound();
    }
  };

  const markNotificationAsRead = (notificationId: string): void => {
    const notification = state.notifications.get(notificationId);
    if (notification) {
      notification.read = true;
      state.unreadNotifications.delete(notificationId);
    }
  };

  const markNotificationAsDismissed = (notificationId: string): void => {
    const notification = state.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      state.unreadNotifications.delete(notificationId);
    }
  };

  const markAllNotificationsAsRead = (): void => {
    for (const notification of state.notifications.values()) {
      notification.read = true;
    }
    state.unreadNotifications.clear();
  };

  const clearNotifications = (): void => {
    state.notifications.clear();
    state.unreadNotifications.clear();
  };

  const updateNotificationSettings = (settings: Partial<NotificationSettings>): void => {
    Object.assign(state.notificationSettings, settings);
    
    // Save to localStorage
    localStorage.setItem('notificationSettings', JSON.stringify(state.notificationSettings));
  };

  const loadNotificationSettings = (): void => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        Object.assign(state.notificationSettings, settings);
      }
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  };

  // =============================================================================
  // WEBSOCKET EVENT HANDLERS
  // =============================================================================

  const handleNotificationReceived = (data: NotificationResponse): void => {
    addNotification(data);
  };

  // =============================================================================
  // EVENT SETUP
  // =============================================================================

  const setupReadReceiptListeners = (): void => {
    socketService.on(WebSocketEvent.READ_RECEIPT_UPDATED, handleReadReceiptUpdate);
    socketService.on(WebSocketEvent.NOTIFICATION_RECEIVED, handleNotificationReceived);
  };

  const removeReadReceiptListeners = (): void => {
    socketService.off(WebSocketEvent.READ_RECEIPT_UPDATED, handleReadReceiptUpdate);
    socketService.off(WebSocketEvent.NOTIFICATION_RECEIVED, handleNotificationReceived);
  };

  // =============================================================================
  // INITIALIZATION
  // =============================================================================

  const initialize = async (): Promise<void> => {
    setupReadReceiptListeners();
    loadNotificationSettings();
    
    // Request notification permission if not already granted
    if (state.notificationSettings.desktopEnabled) {
      await requestNotificationPermission();
    }
  };

  const destroy = (): void => {
    removeReadReceiptListeners();
    clearNotifications();
  };

  // =============================================================================
  // RETURN PUBLIC API
  // =============================================================================

  return {
    // State
    state: readonly(state),
    
    // Computed
    unreadNotificationCount,
    hasUnreadNotifications,
    recentNotifications,
    
    // Getters
    getMessageReadStatus,
    getReadReceiptsForMessage,
    isMessageRead,
    getMessageDeliveryStats,
    
    // Read receipts actions
    markMessageAsRead,
    markRoomAsRead,
    
    // Notifications actions
    requestNotificationPermission,
    markNotificationAsRead,
    markNotificationAsDismissed,
    markAllNotificationsAsRead,
    clearNotifications,
    updateNotificationSettings,
    
    // Lifecycle
    initialize,
    destroy,
    
    // Event handlers (for external use)
    handleReadReceiptUpdate,
    handleNotificationReceived
  };
});
