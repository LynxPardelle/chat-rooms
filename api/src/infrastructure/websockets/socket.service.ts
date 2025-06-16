import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { WebSocketConfigService } from './websocket.config';

interface ConnectedUser {
  socketId: string;
  userId: string;
  username: string;
  joinedAt: Date;
  lastActivity: Date;
  lastHeartbeat?: Date;
}

interface RoomState {
  users: Map<string, ConnectedUser>;
  typingUsers: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

interface RateLimitState {
  messageCount: number;
  joinCount: number;
  typingCount: number;
  lastReset: Date;
}

interface ConnectionMetrics {
  totalConnections: number;
  totalDisconnections: number;
  totalMessagesProcessed: number;
  totalRoomsCreated: number;
  rateLimitViolations: number;
}

@Injectable()
export class SocketService implements OnModuleDestroy {
  private readonly logger = new Logger(SocketService.name);
  
  // Maps to track state
  private readonly connectedUsers = new Map<string, ConnectedUser>(); // socketId -> user
  private readonly userSockets = new Map<string, string>(); // userId -> socketId
  private readonly roomStates = new Map<string, RoomState>(); // roomId -> state
  private readonly rateLimits = new Map<string, RateLimitState>(); // socketId -> limits
  
  // Metrics
  private readonly metrics: ConnectionMetrics = {
    totalConnections: 0,
    totalDisconnections: 0,
    totalMessagesProcessed: 0,
    totalRoomsCreated: 0,
    rateLimitViolations: 0,
  };

  // Cleanup intervals
  private cleanupInterval: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(private readonly wsConfigService: WebSocketConfigService) {
    const config = this.wsConfigService.config;
    
    // Clean up inactive connections
    this.cleanupInterval = setInterval(
      () => this.cleanupInactiveConnections(), 
      config.rateLimit.cleanupIntervalMs
    );

    // Start heartbeat if enabled
    if (this.wsConfigService.enableHeartbeat) {
      this.startHeartbeat();
    }

    this.logger.log('SocketService initialized with enhanced configuration');
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
  // Connection management
  addConnection(socketId: string, userId: string, username: string): void {
    const user: ConnectedUser = {
      socketId,
      userId,
      username,
      joinedAt: new Date(),
      lastActivity: new Date(),
      lastHeartbeat: new Date(),
    };

    this.connectedUsers.set(socketId, user);
    this.userSockets.set(userId, socketId);
    this.initializeRateLimit(socketId);
    this.metrics.totalConnections++;

    this.logger.log(`User connected: ${username} (${userId}) on socket ${socketId}`);
    
    if (this.wsConfigService.enableDetailedLogging) {
      this.logger.debug(`Total connections: ${this.connectedUsers.size}`);
    }
  }
  removeConnection(socketId: string): ConnectedUser | null {
    const user = this.connectedUsers.get(socketId);
    if (!user) return null;

    // Remove from all rooms
    this.removeUserFromAllRooms(socketId);
    
    // Clean up maps
    this.connectedUsers.delete(socketId);
    this.userSockets.delete(user.userId);
    this.rateLimits.delete(socketId);
    this.metrics.totalDisconnections++;

    this.logger.log(`User disconnected: ${user.username} (${user.userId})`);
    
    if (this.wsConfigService.enableDetailedLogging) {
      this.logger.debug(`Total connections: ${this.connectedUsers.size}`);
    }
    
    return user;
  }

  updateUserActivity(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      user.lastActivity = new Date();
    }
  }
  // Room management
  joinRoom(socketId: string, roomId: string): boolean {
    const user = this.connectedUsers.get(socketId);
    if (!user) return false;

    if (!this.roomStates.has(roomId)) {
      this.roomStates.set(roomId, {
        users: new Map(),
        typingUsers: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      });
      this.metrics.totalRoomsCreated++;
    }

    const roomState = this.roomStates.get(roomId)!;
    roomState.users.set(socketId, user);
    roomState.lastActivity = new Date();
    
    this.updateUserActivity(socketId);
    this.logger.log(`User ${user.username} joined room ${roomId}`);
    
    if (this.wsConfigService.enableDetailedLogging) {
      this.logger.debug(`Room ${roomId} now has ${roomState.users.size} users`);
    }
    
    return true;
  }

  leaveRoom(socketId: string, roomId: string): boolean {
    const roomState = this.roomStates.get(roomId);
    if (!roomState) return false;

    const user = roomState.users.get(socketId);
    if (!user) return false;

    roomState.users.delete(socketId);
    roomState.typingUsers.delete(user.userId);

    // Clean up empty rooms
    if (roomState.users.size === 0) {
      this.roomStates.delete(roomId);
      this.logger.log(`Room ${roomId} cleaned up (empty)`);
    }

    this.updateUserActivity(socketId);
    this.logger.log(`User ${user.username} left room ${roomId}`);
    
    return true;
  }

  private removeUserFromAllRooms(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (!user) return;

    for (const [roomId, roomState] of this.roomStates.entries()) {
      if (roomState.users.has(socketId)) {
        roomState.users.delete(socketId);
        roomState.typingUsers.delete(user.userId);
        
        if (roomState.users.size === 0) {
          this.roomStates.delete(roomId);
        }
      }
    }
  }

  // Typing management
  setUserTyping(socketId: string, roomId: string, isTyping: boolean): boolean {
    const user = this.connectedUsers.get(socketId);
    const roomState = this.roomStates.get(roomId);
    
    if (!user || !roomState || !roomState.users.has(socketId)) {
      return false;
    }

    if (isTyping) {
      roomState.typingUsers.add(user.userId);
    } else {
      roomState.typingUsers.delete(user.userId);
    }

    this.updateUserActivity(socketId);
    return true;
  }

  getTypingUsers(roomId: string): string[] {
    const roomState = this.roomStates.get(roomId);
    return roomState ? Array.from(roomState.typingUsers) : [];
  }
  // Rate limiting
  checkRateLimit(socketId: string, eventType: 'message' | 'join' | 'typing'): boolean {
    const rateLimitState = this.rateLimits.get(socketId);
    if (!rateLimitState) return false;

    const config = this.wsConfigService.config.rateLimit;
    const now = new Date();
    const timeSinceReset = now.getTime() - rateLimitState.lastReset.getTime();

    // Reset counters if window has passed
    if (timeSinceReset >= config.windowMs) {
      rateLimitState.messageCount = 0;
      rateLimitState.joinCount = 0;
      rateLimitState.typingCount = 0;
      rateLimitState.lastReset = now;
    }

    // Check limits based on event type
    switch (eventType) {
      case 'message':
        if (rateLimitState.messageCount >= config.maxMessagesPerWindow) {
          this.logger.warn(`Rate limit exceeded for socket ${socketId}: messages`);
          this.metrics.rateLimitViolations++;
          return false;
        }
        rateLimitState.messageCount++;
        this.metrics.totalMessagesProcessed++;
        break;
      
      case 'join':
        if (rateLimitState.joinCount >= config.maxJoinsPerWindow) {
          this.logger.warn(`Rate limit exceeded for socket ${socketId}: joins`);
          this.metrics.rateLimitViolations++;
          return false;
        }
        rateLimitState.joinCount++;
        break;
      
      case 'typing':
        if (rateLimitState.typingCount >= config.maxTypingEventsPerWindow) {
          this.logger.warn(`Rate limit exceeded for socket ${socketId}: typing`);
          this.metrics.rateLimitViolations++;
          return false;
        }
        rateLimitState.typingCount++;
        break;
    }

    return true;
  }

  private initializeRateLimit(socketId: string): void {
    this.rateLimits.set(socketId, {
      messageCount: 0,
      joinCount: 0,
      typingCount: 0,
      lastReset: new Date(),
    });
  }

  // Utility methods
  getRoomUsers(roomId: string): ConnectedUser[] {
    const roomState = this.roomStates.get(roomId);
    return roomState ? Array.from(roomState.users.values()) : [];
  }

  getUserRooms(userId: string): string[] {
    const rooms: string[] = [];
    const socketId = this.userSockets.get(userId);
    
    if (socketId) {
      for (const [roomId, roomState] of this.roomStates.entries()) {
        if (roomState.users.has(socketId)) {
          rooms.push(roomId);
        }
      }
    }
    
    return rooms;
  }

  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  getRoomsCount(): number {
    return this.roomStates.size;
  }

  getSocketByUserId(userId: string): string | undefined {
    return this.userSockets.get(userId);
  }

  getUserBySocketId(socketId: string): ConnectedUser | undefined {
    return this.connectedUsers.get(socketId);
  }
  // Cleanup inactive connections
  private cleanupInactiveConnections(): void {
    const now = new Date();
    const config = this.wsConfigService.config.rateLimit;
    
    let cleanedCount = 0;
    
    for (const [socketId, user] of this.connectedUsers.entries()) {
      const timeSinceActivity = now.getTime() - user.lastActivity.getTime();
      
      if (timeSinceActivity > config.inactiveThresholdMs) {
        this.removeConnection(socketId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} inactive connections`);
    }
    
    // Also cleanup empty rooms that are old
    this.cleanupEmptyRooms();
  }

  private cleanupEmptyRooms(): void {
    const now = new Date();
    const ROOM_CLEANUP_THRESHOLD = 60 * 60 * 1000; // 1 hour
    
    let cleanedRooms = 0;
    
    for (const [roomId, roomState] of this.roomStates.entries()) {
      const timeSinceActivity = now.getTime() - roomState.lastActivity.getTime();
      
      if (roomState.users.size === 0 && timeSinceActivity > ROOM_CLEANUP_THRESHOLD) {
        this.roomStates.delete(roomId);
        cleanedRooms++;
      }
    }
    
    if (cleanedRooms > 0 && this.wsConfigService.enableDetailedLogging) {
      this.logger.debug(`Cleaned up ${cleanedRooms} empty rooms`);
    }
  }
  // Stats for monitoring
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeRooms: this.roomStates.size,
      totalTypingUsers: Array.from(this.roomStates.values())
        .reduce((total, room) => total + room.typingUsers.size, 0),
      timestamp: new Date(),
    };
  }

  getDetailedStats() {
    const roomStats = Array.from(this.roomStates.entries()).map(([roomId, room]) => ({
      roomId,
      userCount: room.users.size,
      typingUsers: room.typingUsers.size,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
    }));

    return {
      connections: {
        current: this.connectedUsers.size,
        total: this.metrics.totalConnections,
        totalDisconnections: this.metrics.totalDisconnections,
      },
      rooms: {
        active: this.roomStates.size,
        totalCreated: this.metrics.totalRoomsCreated,
        details: roomStats,
      },
      messages: {
        totalProcessed: this.metrics.totalMessagesProcessed,
      },
      rateLimiting: {
        violations: this.metrics.rateLimitViolations,
      },
      config: this.wsConfigService.config.rateLimit,
    };
  }

  // Heartbeat functionality
  private startHeartbeat(): void {
    const intervalMs = this.wsConfigService.heartbeatIntervalMs;
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);

    this.logger.log(`Heartbeat started with ${intervalMs}ms interval`);
  }

  private sendHeartbeat(): void {
    const now = new Date();
    let staleConnections = 0;
    
    for (const [socketId, user] of this.connectedUsers.entries()) {
      const timeSinceLastHeartbeat = user.lastHeartbeat 
        ? now.getTime() - user.lastHeartbeat.getTime()
        : 0;
      
      // If no heartbeat response in 2 intervals, mark as stale
      if (timeSinceLastHeartbeat > this.wsConfigService.heartbeatIntervalMs * 2) {
        staleConnections++;
      }
    }
    
    if (this.wsConfigService.enableDetailedLogging && staleConnections > 0) {
      this.logger.debug(`Heartbeat check: ${staleConnections} stale connections detected`);
    }
  }

  updateHeartbeat(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      user.lastHeartbeat = new Date();
    }
  }
}
