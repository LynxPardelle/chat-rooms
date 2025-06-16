import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WebSocketConfigService } from '../websocket.config';

export interface BroadcastEvent {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  targetUsers?: string[];
  targetRooms?: string[];
  excludeUsers?: string[];
  batchable?: boolean;
}

export interface BroadcastStats {
  totalEventsSent: number;
  eventsPerSecond: number;
  averageLatency: number;
  batchedEvents: number;
  droppedEvents: number;
  connectedClients: number;
  roomsActive: number;
}

interface BatchedEvent {
  type: string;
  events: BroadcastEvent[];
  targetUsers: Set<string>;
  timestamp: number;
}

interface UserSubscription {
  userId: string;
  socketId: string;
  subscribedEvents: Set<string>;
  rooms: Set<string>;
  isActive: boolean;
  lastSeen: number;
}

@Injectable()
export class BroadcastingService {
  private readonly logger = new Logger(BroadcastingService.name);
  private server: Server;
  private userSubscriptions = new Map<string, UserSubscription>();
  private roomMemberships = new Map<string, Set<string>>(); // roomId -> Set<userId>
  private eventBatches = new Map<string, BatchedEvent>(); // batchKey -> BatchedEvent
  private batchTimeout = 100; // ms
  private stats: BroadcastStats = {
    totalEventsSent: 0,
    eventsPerSecond: 0,
    averageLatency: 0,
    batchedEvents: 0,
    droppedEvents: 0,
    connectedClients: 0,
    roomsActive: 0,
  };

  constructor(private readonly configService: WebSocketConfigService) {
    // Process batched events periodically
    setInterval(() => this.processBatches(), this.batchTimeout);
    
    // Update stats periodically
    setInterval(() => this.updateStats(), 1000);
  }

  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Register a user connection and their subscriptions
   */
  registerUser(userId: string, socketId: string, socket: Socket): void {
    const subscription: UserSubscription = {
      userId,
      socketId,
      subscribedEvents: new Set([
        'message:created',
        'message:updated',
        'message:deleted',
        'user:presence',
        'room:user:joined',
        'room:user:left',
      ]),
      rooms: new Set(),
      isActive: true,
      lastSeen: Date.now(),
    };

    this.userSubscriptions.set(userId, subscription);
    this.updateStats();

    if (this.configService.enableDetailedLogging) {
      this.logger.debug(`Registered user ${userId} with socket ${socketId}`);
    }
  }

  /**
   * Unregister a user connection
   */
  unregisterUser(userId: string): void {
    const subscription = this.userSubscriptions.get(userId);
    if (subscription) {
      // Remove from all rooms
      for (const roomId of subscription.rooms) {
        this.leaveRoom(userId, roomId);
      }
      
      this.userSubscriptions.delete(userId);
      this.updateStats();

      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Unregistered user ${userId}`);
      }
    }
  }

  /**
   * Add user to a room
   */
  joinRoom(userId: string, roomId: string): void {
    const subscription = this.userSubscriptions.get(userId);
    if (!subscription) {
      this.logger.warn(`Cannot add user ${userId} to room ${roomId}: user not registered`);
      return;
    }

    subscription.rooms.add(roomId);
    
    if (!this.roomMemberships.has(roomId)) {
      this.roomMemberships.set(roomId, new Set());
    }
    this.roomMemberships.get(roomId)!.add(userId);

    this.updateStats();
  }

  /**
   * Remove user from a room
   */
  leaveRoom(userId: string, roomId: string): void {
    const subscription = this.userSubscriptions.get(userId);
    if (subscription) {
      subscription.rooms.delete(roomId);
    }

    const roomMembers = this.roomMemberships.get(roomId);
    if (roomMembers) {
      roomMembers.delete(userId);
      
      // Clean up empty rooms
      if (roomMembers.size === 0) {
        this.roomMemberships.delete(roomId);
      }
    }

    this.updateStats();
  }

  /**
   * Update user's event subscriptions
   */
  updateSubscriptions(userId: string, events: string[]): void {
    const subscription = this.userSubscriptions.get(userId);
    if (subscription) {
      subscription.subscribedEvents = new Set(events);
      
      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Updated subscriptions for user ${userId}: ${events.join(', ')}`);
      }
    }
  }

  /**
   * Broadcast an event to relevant recipients
   */
  async broadcast(event: BroadcastEvent): Promise<void> {
    if (!this.server) {
      this.logger.error('Server not set, cannot broadcast event');
      return;
    }

    try {
      const startTime = Date.now();
      
      // Determine recipients
      const recipients = this.determineRecipients(event);
      
      if (recipients.size === 0) {
        if (this.configService.enableDetailedLogging) {
          this.logger.debug(`No recipients for event ${event.type}`);
        }
        return;
      }

      // Check if event should be batched
      if (event.batchable && event.priority !== 'critical') {
        await this.addToBatch(event, recipients);
      } else {
        await this.sendEventDirectly(event, recipients);
      }

      // Update stats
      this.stats.totalEventsSent++;
      const latency = Date.now() - startTime;
      this.stats.averageLatency = (this.stats.averageLatency + latency) / 2;

    } catch (error) {
      this.logger.error(`Error broadcasting event ${event.type}: ${error.message}`);
      this.stats.droppedEvents++;
    }
  }

  /**
   * Send a direct message to specific users
   */
  async sendToUsers(userIds: string[], eventType: string, payload: any): Promise<void> {
    const event: BroadcastEvent = {
      id: `direct_${Date.now()}_${Math.random()}`,
      type: eventType,
      payload,
      timestamp: Date.now(),
      priority: 'high',
      targetUsers: userIds,
    };

    await this.broadcast(event);
  }

  /**
   * Send a message to all users in a room
   */
  async sendToRoom(roomId: string, eventType: string, payload: any, excludeUsers?: string[]): Promise<void> {
    const event: BroadcastEvent = {
      id: `room_${Date.now()}_${Math.random()}`,
      type: eventType,
      payload,
      timestamp: Date.now(),
      priority: 'normal',
      targetRooms: [roomId],
      excludeUsers,
    };

    await this.broadcast(event);
  }

  /**
   * Get broadcasting statistics
   */
  getStats(): BroadcastStats {
    return { ...this.stats };
  }

  /**
   * Get room information
   */
  getRoomInfo(roomId: string): {
    memberCount: number;
    members: string[];
    isActive: boolean;
  } {
    const members = this.roomMemberships.get(roomId) || new Set();
    
    return {
      memberCount: members.size,
      members: Array.from(members),
      isActive: members.size > 0,
    };
  }

  /**
   * Get user subscription info
   */
  getUserInfo(userId: string): UserSubscription | null {
    return this.userSubscriptions.get(userId) || null;
  }

  // Private methods

  private determineRecipients(event: BroadcastEvent): Set<string> {
    const recipients = new Set<string>();

    // If specific target users are specified
    if (event.targetUsers && event.targetUsers.length > 0) {
      for (const userId of event.targetUsers) {
        if (this.shouldReceiveEvent(userId, event.type)) {
          recipients.add(userId);
        }
      }
    }

    // If target rooms are specified
    if (event.targetRooms && event.targetRooms.length > 0) {
      for (const roomId of event.targetRooms) {
        const roomMembers = this.roomMemberships.get(roomId) || new Set();
        for (const userId of roomMembers) {
          if (this.shouldReceiveEvent(userId, event.type)) {
            recipients.add(userId);
          }
        }
      }
    }

    // If no specific targets, broadcast to all subscribed users
    if (!event.targetUsers && !event.targetRooms) {
      for (const [userId] of this.userSubscriptions) {
        if (this.shouldReceiveEvent(userId, event.type)) {
          recipients.add(userId);
        }
      }
    }

    // Remove excluded users
    if (event.excludeUsers) {
      for (const userId of event.excludeUsers) {
        recipients.delete(userId);
      }
    }

    return recipients;
  }

  private shouldReceiveEvent(userId: string, eventType: string): boolean {
    const subscription = this.userSubscriptions.get(userId);
    if (!subscription || !subscription.isActive) {
      return false;
    }

    return subscription.subscribedEvents.has(eventType);
  }

  private async addToBatch(event: BroadcastEvent, recipients: Set<string>): Promise<void> {
    const batchKey = `${event.type}_${event.priority}`;
    
    let batch = this.eventBatches.get(batchKey);
    if (!batch) {
      batch = {
        type: event.type,
        events: [],
        targetUsers: new Set(),
        timestamp: Date.now(),
      };
      this.eventBatches.set(batchKey, batch);
    }

    batch.events.push(event);
    for (const userId of recipients) {
      batch.targetUsers.add(userId);
    }

    // If batch is getting large, process it immediately
    if (batch.events.length >= 10) {
      await this.processBatch(batchKey, batch);
      this.eventBatches.delete(batchKey);
    }
  }

  private async sendEventDirectly(event: BroadcastEvent, recipients: Set<string>): Promise<void> {
    const socketIds: string[] = [];
    
    for (const userId of recipients) {
      const subscription = this.userSubscriptions.get(userId);
      if (subscription && subscription.isActive) {
        socketIds.push(subscription.socketId);
      }
    }

    if (socketIds.length > 0) {
      // Send to specific sockets
      for (const socketId of socketIds) {
        this.server.to(socketId).emit(event.type, event.payload);
      }

      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Sent ${event.type} to ${socketIds.length} recipients`);
      }
    }
  }

  private async processBatches(): Promise<void> {
    const now = Date.now();
    
    for (const [batchKey, batch] of this.eventBatches.entries()) {
      // Process batches older than timeout
      if (now - batch.timestamp >= this.batchTimeout) {
        await this.processBatch(batchKey, batch);
        this.eventBatches.delete(batchKey);
      }
    }
  }

  private async processBatch(batchKey: string, batch: BatchedEvent): Promise<void> {
    if (batch.events.length === 0) {
      return;
    }

    try {
      // Combine similar events or send them as a batch
      const batchPayload = {
        type: 'batch',
        events: batch.events.map(e => ({
          type: e.type,
          payload: e.payload,
          timestamp: e.timestamp,
        })),
        count: batch.events.length,
      };

      const socketIds: string[] = [];
      for (const userId of batch.targetUsers) {
        const subscription = this.userSubscriptions.get(userId);
        if (subscription && subscription.isActive) {
          socketIds.push(subscription.socketId);
        }
      }

      if (socketIds.length > 0) {
        for (const socketId of socketIds) {
          this.server.to(socketId).emit('event:batch', batchPayload);
        }

        this.stats.batchedEvents += batch.events.length;

        if (this.configService.enableDetailedLogging) {
          this.logger.debug(`Sent batch of ${batch.events.length} events to ${socketIds.length} recipients`);
        }
      }

    } catch (error) {
      this.logger.error(`Error processing batch ${batchKey}: ${error.message}`);
      this.stats.droppedEvents += batch.events.length;
    }
  }

  private updateStats(): void {
    this.stats.connectedClients = this.userSubscriptions.size;
    this.stats.roomsActive = this.roomMemberships.size;
    
    // Calculate events per second (simple moving average)
    // This would be more accurate with a proper time window
    this.stats.eventsPerSecond = this.stats.totalEventsSent / Math.max(1, Date.now() / 1000);
  }
}
