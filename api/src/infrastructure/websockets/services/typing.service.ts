import { Injectable, Logger } from '@nestjs/common';

export interface TypingUser {
  userId: string;
  username: string;
  roomId: string;
  threadId?: string;
  timestamp: number;
  deviceId?: string;
}

export interface TypingEvent {
  roomId: string;
  threadId?: string;
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: number;
}

@Injectable()
export class TypingService {
  private readonly logger = new Logger(TypingService.name);
  private readonly typingUsers = new Map<string, TypingUser>(); // userId:roomId -> TypingUser
  private readonly roomTypingUsers = new Map<string, Set<string>>(); // roomId -> Set<userId>
  private readonly typingTimeouts = new Map<string, NodeJS.Timeout>(); // userId:roomId -> timeout
  
  // Configuration
  private readonly TYPING_TIMEOUT_MS = 3000; // 3 seconds auto-cleanup
  private readonly DEBOUNCE_MS = 500; // 500ms debounce
  private readonly lastTypingEvents = new Map<string, number>(); // userId:roomId -> timestamp

  /**
   * Start typing indicator for a user in a room
   */
  startTyping(userId: string, username: string, roomId: string, threadId?: string, deviceId?: string): TypingEvent | null {
    const typingKey = `${userId}:${roomId}${threadId ? `:${threadId}` : ''}`;
    const now = Date.now();
    
    // Check debounce
    const lastEvent = this.lastTypingEvents.get(typingKey);
    if (lastEvent && (now - lastEvent) < this.DEBOUNCE_MS) {
      return null; // Skip this event due to debouncing
    }
    
    this.lastTypingEvents.set(typingKey, now);
    
    // Clear existing timeout
    const existingTimeout = this.typingTimeouts.get(typingKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Add/update typing user
    const typingUser: TypingUser = {
      userId,
      username,
      roomId,
      threadId,
      timestamp: now,
      deviceId
    };
    
    this.typingUsers.set(typingKey, typingUser);
    
    // Add to room tracking
    if (!this.roomTypingUsers.has(roomId)) {
      this.roomTypingUsers.set(roomId, new Set());
    }
    this.roomTypingUsers.get(roomId)!.add(userId);
    
    // Set auto-cleanup timeout
    const timeout = setTimeout(() => {
      this.stopTyping(userId, roomId, threadId);
    }, this.TYPING_TIMEOUT_MS);
    
    this.typingTimeouts.set(typingKey, timeout);
    
    this.logger.debug(`User ${username} started typing in room ${roomId}${threadId ? ` thread ${threadId}` : ''}`);
    
    return {
      roomId,
      threadId,
      userId,
      username,
      isTyping: true,
      timestamp: now
    };
  }
  
  /**
   * Stop typing indicator for a user in a room
   */
  stopTyping(userId: string, roomId: string, threadId?: string): TypingEvent | null {
    const typingKey = `${userId}:${roomId}${threadId ? `:${threadId}` : ''}`;
    
    const typingUser = this.typingUsers.get(typingKey);
    if (!typingUser) {
      return null; // User wasn't typing
    }
    
    // Remove from tracking
    this.typingUsers.delete(typingKey);
    this.roomTypingUsers.get(roomId)?.delete(userId);
    
    // Clear timeout
    const timeout = this.typingTimeouts.get(typingKey);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(typingKey);
    }
    
    // Remove last event tracking
    this.lastTypingEvents.delete(typingKey);
    
    this.logger.debug(`User ${typingUser.username} stopped typing in room ${roomId}${threadId ? ` thread ${threadId}` : ''}`);
    
    return {
      roomId,
      threadId,
      userId,
      username: typingUser.username,
      isTyping: false,
      timestamp: Date.now()
    };
  }
  
  /**
   * Get all users currently typing in a room
   */
  getTypingUsersInRoom(roomId: string, threadId?: string): TypingUser[] {
    const users: TypingUser[] = [];
    const now = Date.now();
    
    this.typingUsers.forEach((typingUser, key) => {
      if (typingUser.roomId === roomId && typingUser.threadId === threadId) {
        // Check if typing session hasn't expired
        if ((now - typingUser.timestamp) < this.TYPING_TIMEOUT_MS) {
          users.push(typingUser);
        } else {
          // Auto-cleanup expired typing session
          this.stopTyping(typingUser.userId, roomId, threadId);
        }
      }
    });
    
    return users;
  }
  
  /**
   * Get all rooms where a user is currently typing
   */
  getUserTypingRooms(userId: string): string[] {
    const rooms: string[] = [];
    
    this.typingUsers.forEach((typingUser) => {
      if (typingUser.userId === userId) {
        rooms.push(typingUser.roomId);
      }
    });
    
    return rooms;
  }
  
  /**
   * Cleanup typing indicators for a user (on disconnect)
   */
  cleanupUserTyping(userId: string): TypingEvent[] {
    const events: TypingEvent[] = [];
    const keysToDelete: string[] = [];
    
    this.typingUsers.forEach((typingUser, key) => {
      if (typingUser.userId === userId) {
        events.push({
          roomId: typingUser.roomId,
          threadId: typingUser.threadId,
          userId,
          username: typingUser.username,
          isTyping: false,
          timestamp: Date.now()
        });
        keysToDelete.push(key);
      }
    });
    
    // Remove from all tracking
    keysToDelete.forEach(key => {
      const typingUser = this.typingUsers.get(key);
      if (typingUser) {
        this.typingUsers.delete(key);
        this.roomTypingUsers.get(typingUser.roomId)?.delete(userId);
        
        const timeout = this.typingTimeouts.get(key);
        if (timeout) {
          clearTimeout(timeout);
          this.typingTimeouts.delete(key);
        }
        
        this.lastTypingEvents.delete(key);
      }
    });
    
    this.logger.debug(`Cleaned up typing indicators for user ${userId}`);
    return events;
  }
  
  /**
   * Get typing statistics
   */
  getTypingStats(): {
    totalTypingUsers: number;
    typingUsersByRoom: Record<string, number>;
    averageTypingDuration: number;
  } {
    const stats = {
      totalTypingUsers: this.typingUsers.size,
      typingUsersByRoom: {} as Record<string, number>,
      averageTypingDuration: 0
    };
    
    const now = Date.now();
    let totalDuration = 0;
    
    this.typingUsers.forEach((typingUser) => {
      // Count by room
      if (!stats.typingUsersByRoom[typingUser.roomId]) {
        stats.typingUsersByRoom[typingUser.roomId] = 0;
      }
      stats.typingUsersByRoom[typingUser.roomId]++;
      
      // Calculate duration
      totalDuration += (now - typingUser.timestamp);
    });
    
    if (this.typingUsers.size > 0) {
      stats.averageTypingDuration = totalDuration / this.typingUsers.size;
    }
    
    return stats;
  }
  
  /**
   * Cleanup expired typing indicators
   */
  cleanupExpiredTyping(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    this.typingUsers.forEach((typingUser, key) => {
      if ((now - typingUser.timestamp) > this.TYPING_TIMEOUT_MS) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      const typingUser = this.typingUsers.get(key);
      if (typingUser) {
        this.stopTyping(typingUser.userId, typingUser.roomId, typingUser.threadId);
      }
    });
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned up ${expiredKeys.length} expired typing indicators`);
    }
  }
}
