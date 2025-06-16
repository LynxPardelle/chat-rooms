import { Injectable, Logger } from '@nestjs/common';

export interface ReadReceipt {
  messageId: string;
  userId: string;
  username: string;
  readAt: number;
  roomId: string;
  threadId?: string;
  deviceId?: string;
}

export interface DeliveryReceipt {
  messageId: string;
  userId: string;
  deliveredAt: number;
  roomId: string;
  threadId?: string;
  deviceId?: string;
}

export interface MessageReadStatus {
  messageId: string;
  totalRecipients: number;
  deliveredTo: number;
  readBy: number;
  deliveryReceipts: DeliveryReceipt[];
  readReceipts: ReadReceipt[];
  isFullyRead: boolean;
  isFullyDelivered: boolean;
}

@Injectable()
export class ReadReceiptService {
  private readonly logger = new Logger(ReadReceiptService.name);
  
  // Storage for read receipts: messageId -> userId -> ReadReceipt
  private readonly readReceipts = new Map<string, Map<string, ReadReceipt>>();
  
  // Storage for delivery receipts: messageId -> userId -> DeliveryReceipt
  private readonly deliveryReceipts = new Map<string, Map<string, DeliveryReceipt>>();
  
  // Track message recipients: messageId -> Set<userId>
  private readonly messageRecipients = new Map<string, Set<string>>();
  
  // Track user's last read message per room: userId:roomId -> messageId
  private readonly userLastRead = new Map<string, string>();
  
  // Performance optimization: cache read status
  private readonly readStatusCache = new Map<string, MessageReadStatus>();
  private readonly CACHE_TTL = 60000; // 1 minute
  private readonly cacheTimestamps = new Map<string, number>();

  /**
   * Mark a message as delivered to a user
   */
  markAsDelivered(
    messageId: string,
    userId: string,
    roomId: string,
    threadId?: string,
    deviceId?: string
  ): DeliveryReceipt {
    if (!this.deliveryReceipts.has(messageId)) {
      this.deliveryReceipts.set(messageId, new Map());
    }
    
    const deliveryReceipt: DeliveryReceipt = {
      messageId,
      userId,
      deliveredAt: Date.now(),
      roomId,
      threadId,
      deviceId
    };
    
    this.deliveryReceipts.get(messageId)!.set(userId, deliveryReceipt);
    
    // Invalidate cache for this message
    this.invalidateCache(messageId);
    
    this.logger.debug(`Message ${messageId} marked as delivered to user ${userId}`);
    return deliveryReceipt;
  }
  
  /**
   * Mark a message as read by a user
   */
  markAsRead(
    messageId: string,
    userId: string,
    username: string,
    roomId: string,
    threadId?: string,
    deviceId?: string
  ): ReadReceipt {
    if (!this.readReceipts.has(messageId)) {
      this.readReceipts.set(messageId, new Map());
    }
    
    const readReceipt: ReadReceipt = {
      messageId,
      userId,
      username,
      readAt: Date.now(),
      roomId,
      threadId,
      deviceId
    };
    
    this.readReceipts.get(messageId)!.set(userId, readReceipt);
    
    // Update user's last read message for the room
    const roomKey = `${userId}:${roomId}${threadId ? `:${threadId}` : ''}`;
    this.userLastRead.set(roomKey, messageId);
    
    // Auto-mark as delivered if not already
    if (!this.deliveryReceipts.get(messageId)?.has(userId)) {
      this.markAsDelivered(messageId, userId, roomId, threadId, deviceId);
    }
    
    // Invalidate cache for this message
    this.invalidateCache(messageId);
    
    this.logger.debug(`Message ${messageId} marked as read by user ${username}`);
    return readReceipt;
  }
  
  /**
   * Set recipients for a message (who should receive it)
   */
  setMessageRecipients(messageId: string, recipientIds: string[]): void {
    this.messageRecipients.set(messageId, new Set(recipientIds));
    this.invalidateCache(messageId);
  }
  
  /**
   * Get read status for a message
   */
  getMessageReadStatus(messageId: string): MessageReadStatus {
    // Check cache first
    const cached = this.readStatusCache.get(messageId);
    const cacheTime = this.cacheTimestamps.get(messageId);
    
    if (cached && cacheTime && (Date.now() - cacheTime) < this.CACHE_TTL) {
      return cached;
    }
    
    const recipients = this.messageRecipients.get(messageId) || new Set();
    const deliveryMap = this.deliveryReceipts.get(messageId) || new Map();
    const readMap = this.readReceipts.get(messageId) || new Map();
    
    const deliveryReceipts = Array.from(deliveryMap.values());
    const readReceipts = Array.from(readMap.values());
    
    const status: MessageReadStatus = {
      messageId,
      totalRecipients: recipients.size,
      deliveredTo: deliveryReceipts.length,
      readBy: readReceipts.length,
      deliveryReceipts,
      readReceipts,
      isFullyDelivered: recipients.size > 0 && deliveryReceipts.length >= recipients.size,
      isFullyRead: recipients.size > 0 && readReceipts.length >= recipients.size
    };
    
    // Cache the result
    this.readStatusCache.set(messageId, status);
    this.cacheTimestamps.set(messageId, Date.now());
    
    return status;
  }
  
  /**
   * Get all read receipts for a message
   */
  getReadReceipts(messageId: string): ReadReceipt[] {
    const readMap = this.readReceipts.get(messageId);
    return readMap ? Array.from(readMap.values()) : [];
  }
  
  /**
   * Get all delivery receipts for a message
   */
  getDeliveryReceipts(messageId: string): DeliveryReceipt[] {
    const deliveryMap = this.deliveryReceipts.get(messageId);
    return deliveryMap ? Array.from(deliveryMap.values()) : [];
  }
  
  /**
   * Get user's last read message in a room
   */
  getUserLastReadMessage(userId: string, roomId: string, threadId?: string): string | null {
    const roomKey = `${userId}:${roomId}${threadId ? `:${threadId}` : ''}`;
    return this.userLastRead.get(roomKey) || null;
  }
  
  /**
   * Get all unread messages for a user in a room
   */
  getUnreadMessages(userId: string, roomId: string, allMessageIds: string[], threadId?: string): string[] {
    const lastReadMessageId = this.getUserLastReadMessage(userId, roomId, threadId);
    
    if (!lastReadMessageId) {
      return allMessageIds; // All messages are unread
    }
    
    const lastReadIndex = allMessageIds.indexOf(lastReadMessageId);
    if (lastReadIndex === -1) {
      return allMessageIds; // Last read message not found, assume all unread
    }
    
    // Return messages after the last read message
    return allMessageIds.slice(lastReadIndex + 1);
  }
  
  /**
   * Mark multiple messages as read (bulk operation)
   */
  markMultipleAsRead(
    messageIds: string[],
    userId: string,
    username: string,
    roomId: string,
    threadId?: string,
    deviceId?: string
  ): ReadReceipt[] {
    const receipts: ReadReceipt[] = [];
    
    messageIds.forEach(messageId => {
      const receipt = this.markAsRead(messageId, userId, username, roomId, threadId, deviceId);
      receipts.push(receipt);
    });
    
    return receipts;
  }
  
  /**
   * Get read status for multiple messages (bulk operation)
   */
  getMultipleMessageReadStatus(messageIds: string[]): Map<string, MessageReadStatus> {
    const statusMap = new Map<string, MessageReadStatus>();
    
    messageIds.forEach(messageId => {
      statusMap.set(messageId, this.getMessageReadStatus(messageId));
    });
    
    return statusMap;
  }
  
  /**
   * Cleanup read receipts for a user (on user deletion)
   */
  cleanupUserReceipts(userId: string): void {
    // Remove from read receipts
    this.readReceipts.forEach((userMap, messageId) => {
      if (userMap.has(userId)) {
        userMap.delete(userId);
        this.invalidateCache(messageId);
      }
      if (userMap.size === 0) {
        this.readReceipts.delete(messageId);
      }
    });
    
    // Remove from delivery receipts
    this.deliveryReceipts.forEach((userMap, messageId) => {
      if (userMap.has(userId)) {
        userMap.delete(userId);
        this.invalidateCache(messageId);
      }
      if (userMap.size === 0) {
        this.deliveryReceipts.delete(messageId);
      }
    });
    
    // Remove user's last read tracking
    const keysToDelete: string[] = [];
    this.userLastRead.forEach((messageId, key) => {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.userLastRead.delete(key));
    
    this.logger.debug(`Cleaned up read receipts for user ${userId}`);
  }
  
  /**
   * Cleanup receipts for a message (on message deletion)
   */
  cleanupMessageReceipts(messageId: string): void {
    this.readReceipts.delete(messageId);
    this.deliveryReceipts.delete(messageId);
    this.messageRecipients.delete(messageId);
    this.invalidateCache(messageId);
    
    // Remove from user last read if this was the last read message
    const keysToDelete: string[] = [];
    this.userLastRead.forEach((lastMessageId, key) => {
      if (lastMessageId === messageId) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.userLastRead.delete(key));
    
    this.logger.debug(`Cleaned up receipts for message ${messageId}`);
  }
  
  /**
   * Get statistics about read receipts
   */
  getReadReceiptStats(): {
    totalMessages: number;
    totalReadReceipts: number;
    totalDeliveryReceipts: number;
    averageReadRate: number;
    averageDeliveryRate: number;
  } {
    let totalReadReceipts = 0;
    let totalDeliveryReceipts = 0;
    let totalRecipients = 0;
    
    this.readReceipts.forEach(userMap => {
      totalReadReceipts += userMap.size;
    });
    
    this.deliveryReceipts.forEach(userMap => {
      totalDeliveryReceipts += userMap.size;
    });
    
    this.messageRecipients.forEach(recipients => {
      totalRecipients += recipients.size;
    });
    
    return {
      totalMessages: this.messageRecipients.size,
      totalReadReceipts,
      totalDeliveryReceipts,
      averageReadRate: totalRecipients > 0 ? (totalReadReceipts / totalRecipients) * 100 : 0,
      averageDeliveryRate: totalRecipients > 0 ? (totalDeliveryReceipts / totalRecipients) * 100 : 0
    };
  }
  
  /**
   * Invalidate cache for a message
   */
  private invalidateCache(messageId: string): void {
    this.readStatusCache.delete(messageId);
    this.cacheTimestamps.delete(messageId);
  }
  
  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.cacheTimestamps.forEach((timestamp, messageId) => {
      if ((now - timestamp) > this.CACHE_TTL) {
        expiredKeys.push(messageId);
      }
    });
    
    expiredKeys.forEach(key => {
      this.readStatusCache.delete(key);
      this.cacheTimestamps.delete(key);
    });
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}
