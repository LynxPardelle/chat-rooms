import { Injectable, Logger } from '@nestjs/common';
import { WebSocketConfigService } from '../websocket.config';

export interface QueuedMessage {
  id: string;
  userId: string;
  eventType: string;
  payload: any;
  timestamp: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
}

export interface QueueStats {
  totalQueued: number;
  totalDelivered: number;
  totalExpired: number;
  currentQueueSize: number;
  averageDeliveryTime: number;
  failedDeliveries: number;
}

interface UserQueue {
  userId: string;
  messages: QueuedMessage[];
  isOnline: boolean;
  lastSeen: number;
  deliveryInProgress: boolean;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private userQueues = new Map<string, UserQueue>();
  private readonly maxQueueSize = 100;
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxRetries = 3;
  private deliveryCallbacks = new Map<string, (messages: QueuedMessage[]) => Promise<void>>();
  
  private stats: QueueStats = {
    totalQueued: 0,
    totalDelivered: 0,
    totalExpired: 0,
    currentQueueSize: 0,
    averageDeliveryTime: 0,
    failedDeliveries: 0,
  };

  constructor(private readonly configService: WebSocketConfigService) {
    // Cleanup expired messages periodically
    setInterval(() => this.cleanupExpiredMessages(), 60000); // Every minute
    
    // Update stats periodically
    setInterval(() => this.updateStats(), 5000); // Every 5 seconds
  }

  /**
   * Queue a message for a user who might be offline
   */
  async queueMessage(
    userId: string,
    eventType: string,
    payload: any,
    priority: QueuedMessage['priority'] = 'normal',
    ttl?: number,
  ): Promise<void> {
    try {
      const now = Date.now();
      const message: QueuedMessage = {
        id: `queue_${now}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        eventType,
        payload,
        timestamp: now,
        priority,
        attempts: 0,
        maxAttempts: this.maxRetries,
        expiresAt: now + (ttl || this.defaultTTL),
      };

      // Get or create user queue
      let userQueue = this.userQueues.get(userId);
      if (!userQueue) {
        userQueue = {
          userId,
          messages: [],
          isOnline: false,
          lastSeen: now,
          deliveryInProgress: false,
        };
        this.userQueues.set(userId, userQueue);
      }

      // Check queue size limit
      if (userQueue.messages.length >= this.maxQueueSize) {
        // Remove oldest low-priority message
        const removedIndex = userQueue.messages.findIndex(m => m.priority === 'low');
        if (removedIndex !== -1) {
          userQueue.messages.splice(removedIndex, 1);
          this.logger.warn(`Queue full for user ${userId}, removed low-priority message`);
        } else {
          // Remove oldest normal priority message
          const normalIndex = userQueue.messages.findIndex(m => m.priority === 'normal');
          if (normalIndex !== -1) {
            userQueue.messages.splice(normalIndex, 1);
            this.logger.warn(`Queue full for user ${userId}, removed normal-priority message`);
          } else {
            this.logger.error(`Queue full for user ${userId}, cannot queue critical/high priority message`);
            return;
          }
        }
      }

      // Insert message in priority order
      this.insertMessageInPriorityOrder(userQueue, message);
      this.stats.totalQueued++;

      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Queued ${eventType} for user ${userId}, queue size: ${userQueue.messages.length}`);
      }

      // If user is online, try immediate delivery
      if (userQueue.isOnline) {
        await this.deliverQueuedMessages(userId);
      }

    } catch (error) {
      this.logger.error(`Error queuing message for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Mark user as online and deliver queued messages
   */
  async markUserOnline(userId: string): Promise<void> {
    const userQueue = this.userQueues.get(userId);
    if (userQueue) {
      userQueue.isOnline = true;
      userQueue.lastSeen = Date.now();
      
      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`User ${userId} came online, delivering ${userQueue.messages.length} queued messages`);
      }

      await this.deliverQueuedMessages(userId);
    }
  }

  /**
   * Mark user as offline
   */
  markUserOffline(userId: string): void {
    const userQueue = this.userQueues.get(userId);
    if (userQueue) {
      userQueue.isOnline = false;
      userQueue.lastSeen = Date.now();
      
      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`User ${userId} went offline, ${userQueue.messages.length} messages in queue`);
      }
    }
  }

  /**
   * Register a delivery callback for a user
   */
  setDeliveryCallback(userId: string, callback: (messages: QueuedMessage[]) => Promise<void>): void {
    this.deliveryCallbacks.set(userId, callback);
  }

  /**
   * Remove delivery callback for a user
   */
  removeDeliveryCallback(userId: string): void {
    this.deliveryCallbacks.delete(userId);
  }

  /**
   * Get queue information for a user
   */
  getUserQueueInfo(userId: string): {
    queueSize: number;
    isOnline: boolean;
    lastSeen: number;
    oldestMessage?: number;
    priorityCounts: Record<string, number>;
  } {
    const userQueue = this.userQueues.get(userId);
    if (!userQueue) {
      return {
        queueSize: 0,
        isOnline: false,
        lastSeen: 0,
        priorityCounts: {},
      };
    }

    const priorityCounts = userQueue.messages.reduce((acc, msg) => {
      acc[msg.priority] = (acc[msg.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      queueSize: userQueue.messages.length,
      isOnline: userQueue.isOnline,
      lastSeen: userQueue.lastSeen,
      oldestMessage: userQueue.messages[0]?.timestamp,
      priorityCounts,
    };
  }

  /**
   * Get global queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Clear queue for a user (admin function)
   */
  clearUserQueue(userId: string, priority?: QueuedMessage['priority']): number {
    const userQueue = this.userQueues.get(userId);
    if (!userQueue) {
      return 0;
    }

    if (priority) {
      const initialLength = userQueue.messages.length;
      userQueue.messages = userQueue.messages.filter(m => m.priority !== priority);
      const removedCount = initialLength - userQueue.messages.length;
      
      this.logger.log(`Cleared ${removedCount} ${priority} priority messages for user ${userId}`);
      return removedCount;
    } else {
      const removedCount = userQueue.messages.length;
      userQueue.messages = [];
      this.userQueues.delete(userId);
      
      this.logger.log(`Cleared all ${removedCount} messages for user ${userId}`);
      return removedCount;
    }
  }

  /**
   * Get overview of all queues (admin function)
   */
  getQueueOverview(): {
    totalUsers: number;
    onlineUsers: number;
    totalQueuedMessages: number;
    queuesByPriority: Record<string, number>;
    oldestMessage: number | null;
  } {
    let totalMessages = 0;
    let onlineUsers = 0;
    let oldestMessage: number | null = null;
    const queuesByPriority: Record<string, number> = {};

    for (const userQueue of this.userQueues.values()) {
      if (userQueue.isOnline) {
        onlineUsers++;
      }

      totalMessages += userQueue.messages.length;

      for (const message of userQueue.messages) {
        queuesByPriority[message.priority] = (queuesByPriority[message.priority] || 0) + 1;
        
        if (!oldestMessage || message.timestamp < oldestMessage) {
          oldestMessage = message.timestamp;
        }
      }
    }

    return {
      totalUsers: this.userQueues.size,
      onlineUsers,
      totalQueuedMessages: totalMessages,
      queuesByPriority,
      oldestMessage,
    };
  }

  // Private methods

  private insertMessageInPriorityOrder(userQueue: UserQueue, message: QueuedMessage): void {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const messagePriority = priorityOrder[message.priority];

    // Find insertion point to maintain priority order
    let insertIndex = userQueue.messages.length;
    for (let i = 0; i < userQueue.messages.length; i++) {
      const existingPriority = priorityOrder[userQueue.messages[i].priority];
      if (messagePriority < existingPriority) {
        insertIndex = i;
        break;
      }
    }

    userQueue.messages.splice(insertIndex, 0, message);
  }

  private async deliverQueuedMessages(userId: string): Promise<void> {
    const userQueue = this.userQueues.get(userId);
    if (!userQueue || !userQueue.isOnline || userQueue.deliveryInProgress) {
      return;
    }

    if (userQueue.messages.length === 0) {
      return;
    }

    userQueue.deliveryInProgress = true;

    try {
      const callback = this.deliveryCallbacks.get(userId);
      if (!callback) {
        this.logger.warn(`No delivery callback registered for user ${userId}`);
        return;
      }

      // Batch messages for delivery (max 10 at a time)
      const batchSize = 10;
      const messagesToDeliver = userQueue.messages.splice(0, batchSize);

      const deliveryStartTime = Date.now();

      // Attempt delivery
      await callback(messagesToDeliver);

      // Update stats
      const deliveryTime = Date.now() - deliveryStartTime;
      this.stats.totalDelivered += messagesToDeliver.length;
      this.stats.averageDeliveryTime = (this.stats.averageDeliveryTime + deliveryTime) / 2;

      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Delivered ${messagesToDeliver.length} messages to user ${userId} in ${deliveryTime}ms`);
      }

      // If there are more messages, schedule next delivery
      if (userQueue.messages.length > 0) {
        // Small delay to prevent overwhelming the client
        setTimeout(() => this.deliverQueuedMessages(userId), 100);
      }

    } catch (error) {
      this.logger.error(`Failed to deliver messages to user ${userId}: ${error.message}`);
      this.stats.failedDeliveries++;

      // Handle delivery failure
      await this.handleDeliveryFailure(userId, error);

    } finally {
      userQueue.deliveryInProgress = false;
    }
  }

  private async handleDeliveryFailure(userId: string, error: Error): Promise<void> {
    const userQueue = this.userQueues.get(userId);
    if (!userQueue) {
      return;
    }

    // Mark user as offline if delivery failed
    userQueue.isOnline = false;

    // Increment retry attempts for failed messages
    // In a more sophisticated implementation, we would add failed messages back to queue
    // with incremented attempt counts and exponential backoff

    this.logger.warn(`Marking user ${userId} as offline due to delivery failure: ${error.message}`);
  }

  private cleanupExpiredMessages(): void {
    const now = Date.now();
    let totalExpired = 0;

    for (const [userId, userQueue] of this.userQueues.entries()) {
      const initialLength = userQueue.messages.length;
      
      userQueue.messages = userQueue.messages.filter(message => {
        if (message.expiresAt < now) {
          totalExpired++;
          return false;
        }
        return true;
      });

      const expiredCount = initialLength - userQueue.messages.length;
      if (expiredCount > 0 && this.configService.enableDetailedLogging) {
        this.logger.debug(`Expired ${expiredCount} messages for user ${userId}`);
      }

      // Remove empty queues for offline users
      if (userQueue.messages.length === 0 && !userQueue.isOnline) {
        this.userQueues.delete(userId);
      }
    }

    if (totalExpired > 0) {
      this.stats.totalExpired += totalExpired;
      this.logger.log(`Cleaned up ${totalExpired} expired messages`);
    }
  }

  private updateStats(): void {
    let currentQueueSize = 0;
    
    for (const userQueue of this.userQueues.values()) {
      currentQueueSize += userQueue.messages.length;
    }
    
    this.stats.currentQueueSize = currentQueueSize;
  }
}
