import { Injectable, Logger } from '@nestjs/common';

export interface NotificationData {
  id: string;
  type: 'message' | 'mention' | 'reaction' | 'system' | 'typing' | 'presence';
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp: number;
  userId: string;
  roomId?: string;
  messageId?: string;
  senderId?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface UserNotificationSettings {
  userId: string;
  webPushEnabled: boolean;
  desktopEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  mentions: boolean;
  directMessages: boolean;
  roomMessages: boolean;
  reactions: boolean;
  systemUpdates: boolean;
  quietHours?: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
  mutedRooms: Set<string>;
  mutedUsers: Set<string>;
}

export interface WebPushSubscription {
  userId: string;
  deviceId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  userAgent?: string;
  lastUsed: number;
  isActive: boolean;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  // Store user notification settings
  private readonly userSettings = new Map<string, UserNotificationSettings>();
  
  // Store WebPush subscriptions: userId -> deviceId -> subscription
  private readonly webPushSubscriptions = new Map<string, Map<string, WebPushSubscription>>();
  
  // Queue for notifications that need to be sent
  private readonly notificationQueue = new Map<string, NotificationData[]>(); // userId -> notifications
  
  // Track sent notifications to avoid duplicates
  private readonly sentNotifications = new Map<string, Set<string>>(); // userId -> Set<notificationId>
  private readonly SENT_TRACKING_TTL = 300000; // 5 minutes
  
  // Rate limiting for notifications
  private readonly userNotificationCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 50; // max notifications per minute per user

  /**
   * Initialize default notification settings for a user
   */
  initializeUserSettings(userId: string): UserNotificationSettings {
    const defaultSettings: UserNotificationSettings = {
      userId,
      webPushEnabled: false,
      desktopEnabled: true,
      soundEnabled: true,
      vibrationEnabled: true,
      mentions: true,
      directMessages: true,
      roomMessages: true,
      reactions: true,
      systemUpdates: true,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      },
      mutedRooms: new Set(),
      mutedUsers: new Set()
    };
    
    this.userSettings.set(userId, defaultSettings);
    this.logger.debug(`Initialized notification settings for user ${userId}`);
    return defaultSettings;
  }
  
  /**
   * Update user notification settings
   */
  updateUserSettings(userId: string, settings: Partial<UserNotificationSettings>): UserNotificationSettings {
    const currentSettings = this.userSettings.get(userId) || this.initializeUserSettings(userId);
    const updatedSettings = { ...currentSettings, ...settings };
    
    this.userSettings.set(userId, updatedSettings);
    this.logger.debug(`Updated notification settings for user ${userId}`);
    return updatedSettings;
  }
  
  /**
   * Get user notification settings
   */
  getUserSettings(userId: string): UserNotificationSettings {
    return this.userSettings.get(userId) || this.initializeUserSettings(userId);
  }
  
  /**
   * Subscribe user to WebPush notifications
   */
  subscribeToWebPush(
    userId: string,
    deviceId: string,
    subscription: WebPushSubscription['subscription'],
    userAgent?: string
  ): void {
    if (!this.webPushSubscriptions.has(userId)) {
      this.webPushSubscriptions.set(userId, new Map());
    }
    
    const webPushSub: WebPushSubscription = {
      userId,
      deviceId,
      subscription,
      userAgent,
      lastUsed: Date.now(),
      isActive: true
    };
    
    this.webPushSubscriptions.get(userId)!.set(deviceId, webPushSub);
    
    // Update user settings to enable WebPush
    this.updateUserSettings(userId, { webPushEnabled: true });
    
    this.logger.debug(`User ${userId} subscribed to WebPush on device ${deviceId}`);
  }
  
  /**
   * Unsubscribe user from WebPush notifications
   */
  unsubscribeFromWebPush(userId: string, deviceId?: string): void {
    if (deviceId) {
      // Remove specific device
      this.webPushSubscriptions.get(userId)?.delete(deviceId);
      this.logger.debug(`User ${userId} unsubscribed device ${deviceId} from WebPush`);
    } else {
      // Remove all devices
      this.webPushSubscriptions.delete(userId);
      this.updateUserSettings(userId, { webPushEnabled: false });
      this.logger.debug(`User ${userId} unsubscribed all devices from WebPush`);
    }
  }
  
  /**
   * Create and queue a notification
   */
  createNotification(notificationData: Omit<NotificationData, 'id' | 'timestamp'>): NotificationData | null {
    const notification: NotificationData = {
      ...notificationData,
      id: this.generateNotificationId(),
      timestamp: Date.now()
    };
    
    // Check if user should receive this notification
    if (!this.shouldSendNotification(notification)) {
      return null;
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(notification.userId)) {
      this.logger.warn(`Rate limit exceeded for user ${notification.userId}`);
      return null;
    }
    
    // Add to queue
    if (!this.notificationQueue.has(notification.userId)) {
      this.notificationQueue.set(notification.userId, []);
    }
    this.notificationQueue.get(notification.userId)!.push(notification);
    
    this.logger.debug(`Created notification ${notification.id} for user ${notification.userId}`);
    return notification;
  }
  
  /**
   * Get pending notifications for a user
   */
  getPendingNotifications(userId: string): NotificationData[] {
    return this.notificationQueue.get(userId) || [];
  }
  
  /**
   * Mark notifications as sent
   */
  markNotificationsAsSent(userId: string, notificationIds: string[]): void {
    // Remove from queue
    const queue = this.notificationQueue.get(userId);
    if (queue) {
      const filteredQueue = queue.filter(n => !notificationIds.includes(n.id));
      this.notificationQueue.set(userId, filteredQueue);
    }
    
    // Track as sent to avoid duplicates
    if (!this.sentNotifications.has(userId)) {
      this.sentNotifications.set(userId, new Set());
    }
    notificationIds.forEach(id => {
      this.sentNotifications.get(userId)!.add(id);
    });
    
    // Cleanup sent tracking after TTL
    setTimeout(() => {
      const sentSet = this.sentNotifications.get(userId);
      if (sentSet) {
        notificationIds.forEach(id => sentSet.delete(id));
      }
    }, this.SENT_TRACKING_TTL);
    
    this.logger.debug(`Marked ${notificationIds.length} notifications as sent for user ${userId}`);
  }
  
  /**
   * Check if notification was already sent (duplicate prevention)
   */
  wasNotificationSent(userId: string, notificationId: string): boolean {
    return this.sentNotifications.get(userId)?.has(notificationId) || false;
  }
  
  /**
   * Mute a room for a user
   */
  muteRoom(userId: string, roomId: string): void {
    const settings = this.getUserSettings(userId);
    settings.mutedRooms.add(roomId);
    this.userSettings.set(userId, settings);
    this.logger.debug(`User ${userId} muted room ${roomId}`);
  }
  
  /**
   * Unmute a room for a user
   */
  unmuteRoom(userId: string, roomId: string): void {
    const settings = this.getUserSettings(userId);
    settings.mutedRooms.delete(roomId);
    this.userSettings.set(userId, settings);
    this.logger.debug(`User ${userId} unmuted room ${roomId}`);
  }
  
  /**
   * Mute a user for another user
   */
  muteUser(userId: string, mutedUserId: string): void {
    const settings = this.getUserSettings(userId);
    settings.mutedUsers.add(mutedUserId);
    this.userSettings.set(userId, settings);
    this.logger.debug(`User ${userId} muted user ${mutedUserId}`);
  }
  
  /**
   * Unmute a user for another user
   */
  unmuteUser(userId: string, mutedUserId: string): void {
    const settings = this.getUserSettings(userId);
    settings.mutedUsers.delete(mutedUserId);
    this.userSettings.set(userId, settings);
    this.logger.debug(`User ${userId} unmuted user ${mutedUserId}`);
  }
  
  /**
   * Get WebPush subscriptions for a user
   */
  getUserWebPushSubscriptions(userId: string): WebPushSubscription[] {
    const deviceMap = this.webPushSubscriptions.get(userId);
    return deviceMap ? Array.from(deviceMap.values()).filter(sub => sub.isActive) : [];
  }
  
  /**
   * Cleanup inactive subscriptions and old notifications
   */
  cleanup(): void {
    const now = Date.now();
    const SUBSCRIPTION_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
    const NOTIFICATION_TTL = 24 * 60 * 60 * 1000; // 24 hours
    
    // Cleanup old subscriptions
    this.webPushSubscriptions.forEach((deviceMap, userId) => {
      const devicesToDelete: string[] = [];
      deviceMap.forEach((subscription, deviceId) => {
        if ((now - subscription.lastUsed) > SUBSCRIPTION_TTL) {
          devicesToDelete.push(deviceId);
        }
      });
      devicesToDelete.forEach(deviceId => deviceMap.delete(deviceId));
      if (deviceMap.size === 0) {
        this.webPushSubscriptions.delete(userId);
      }
    });
    
    // Cleanup old notifications from queue
    this.notificationQueue.forEach((notifications, userId) => {
      const filteredNotifications = notifications.filter(
        n => (now - n.timestamp) < NOTIFICATION_TTL
      );
      if (filteredNotifications.length !== notifications.length) {
        this.notificationQueue.set(userId, filteredNotifications);
      }
    });
    
    this.logger.debug('Completed notification service cleanup');
  }
  
  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    totalUsers: number;
    totalSubscriptions: number;
    pendingNotifications: number;
    notificationsByType: Record<string, number>;
  } {
    let totalSubscriptions = 0;
    let pendingNotifications = 0;
    const notificationsByType: Record<string, number> = {};
    
    this.webPushSubscriptions.forEach(deviceMap => {
      totalSubscriptions += deviceMap.size;
    });
    
    this.notificationQueue.forEach(notifications => {
      pendingNotifications += notifications.length;
      notifications.forEach(n => {
        notificationsByType[n.type] = (notificationsByType[n.type] || 0) + 1;
      });
    });
    
    return {
      totalUsers: this.userSettings.size,
      totalSubscriptions,
      pendingNotifications,
      notificationsByType
    };
  }
  
  /**
   * Check if user should receive a notification based on settings
   */
  private shouldSendNotification(notification: NotificationData): boolean {
    const settings = this.getUserSettings(notification.userId);
    
    // Check if notifications are enabled for this type
    switch (notification.type) {
      case 'mention':
        if (!settings.mentions) return false;
        break;
      case 'message':
        if (notification.roomId && !settings.roomMessages) return false;
        if (!notification.roomId && !settings.directMessages) return false;
        break;
      case 'reaction':
        if (!settings.reactions) return false;
        break;
      case 'system':
        if (!settings.systemUpdates) return false;
        break;
    }
    
    // Check if room is muted
    if (notification.roomId && settings.mutedRooms.has(notification.roomId)) {
      return false;
    }
    
    // Check if sender is muted
    if (notification.senderId && settings.mutedUsers.has(notification.senderId)) {
      return false;
    }
    
    // Check quiet hours
    if (settings.quietHours?.enabled && this.isInQuietHours(settings.quietHours)) {
      return notification.priority === 'urgent';
    }
    
    return true;
  }
  
  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(quietHours: NonNullable<UserNotificationSettings['quietHours']>): boolean {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { startTime, endTime } = quietHours;
    
    if (startTime <= endTime) {
      // Same day (e.g., 09:00 to 17:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Crosses midnight (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }
  
  /**
   * Check rate limiting for user notifications
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.userNotificationCounts.get(userId);
    
    if (!userLimit || (now - userLimit.resetTime) > this.RATE_LIMIT_WINDOW) {
      // Reset or initialize counter
      this.userNotificationCounts.set(userId, { count: 1, resetTime: now });
      return true;
    }
    
    if (userLimit.count >= this.RATE_LIMIT_MAX) {
      return false; // Rate limit exceeded
    }
    
    userLimit.count++;
    return true;
  }
  
  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
