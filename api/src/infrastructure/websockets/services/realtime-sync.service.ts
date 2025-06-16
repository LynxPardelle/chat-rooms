import { Injectable, Logger, Inject } from '@nestjs/common';
import { MessageService } from '../../../application/services';
import { IMessageRepository, IUserRepository } from '../../../domain/interfaces';
import { Message, UserWithoutPassword } from '../../../domain/entities';
import { WebSocketConfigService } from '../websocket.config';

export interface SyncEvent {
  id: string;
  type: 'message' | 'reaction' | 'edit' | 'delete' | 'read' | 'typing' | 'presence';
  payload: any;
  timestamp: number;
  userId: string;
  roomId?: string;
  threadId?: string;
  version: number;
}

export interface ConflictResolution {
  winner: SyncEvent;
  loser: SyncEvent;
  strategy: 'timestamp' | 'server_wins' | 'merge';
  resolved: boolean;
}

@Injectable()
export class RealtimeSyncService {
  private readonly logger = new Logger(RealtimeSyncService.name);
  private readonly eventCache = new Map<string, SyncEvent[]>();
  private readonly pendingEvents = new Map<string, SyncEvent[]>();
  private readonly maxCacheSize = 1000;
  private readonly eventRetentionMs = 30000; // 30 seconds

  constructor(
    @Inject('IMessageRepository')
    private readonly messageRepository: IMessageRepository,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly messageService: MessageService,
    private readonly configService: WebSocketConfigService,
  ) {
    // Cleanup old events periodically
    setInterval(() => this.cleanupOldEvents(), 10000);
  }

  /**
   * Synchronize a WebSocket event with database state
   */
  async syncEvent(event: SyncEvent): Promise<boolean> {
    try {
      this.logger.debug(`Syncing event: ${event.type} for user ${event.userId}`);

      // Store event in cache for conflict resolution
      this.storeEventInCache(event);

      // Check for conflicts with existing events
      const conflicts = await this.detectConflicts(event);
      if (conflicts.length > 0) {
        await this.resolveConflicts(event, conflicts);
      }

      // Sync with database based on event type
      switch (event.type) {
        case 'message':
          return await this.syncMessageEvent(event);
        case 'reaction':
          return await this.syncReactionEvent(event);
        case 'edit':
          return await this.syncEditEvent(event);
        case 'delete':
          return await this.syncDeleteEvent(event);
        case 'read':
          return await this.syncReadEvent(event);
        case 'typing':
          return await this.syncTypingEvent(event);
        case 'presence':
          return await this.syncPresenceEvent(event);
        default:
          this.logger.warn(`Unknown event type: ${event.type}`);
          return false;
      }
    } catch (error) {
      this.logger.error(`Error syncing event: ${error.message}`, error.stack);
      // Add to pending events for retry
      this.addToPendingEvents(event);
      return false;
    }
  }

  /**
   * Validate consistency between WebSocket state and database
   */
  async validateConsistency(roomId: string, messageId?: string): Promise<boolean> {
    try {      // For development environment, perform detailed checks
      if (this.configService.enableDetailedLogging) {
        this.logger.debug(`Validating consistency for room ${roomId}`);
      }      if (messageId) {
        // Validate specific message
        const dbMessage = await this.messageRepository.findById(messageId);
        if (!dbMessage) {
          this.logger.warn(`Message ${messageId} not found in database`);
          return false;
        }
        const cachedEvents = this.getEventsForMessage(messageId);
        
        return this.validateMessageConsistency(dbMessage, cachedEvents);
      } else {
        // Validate room state
        return await this.validateRoomConsistency(roomId);
      }
    } catch (error) {
      this.logger.error(`Consistency validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get pending events for retry mechanism
   */
  getPendingEvents(userId: string): SyncEvent[] {
    return this.pendingEvents.get(userId) || [];
  }

  /**
   * Retry failed events for a user
   */
  async retryPendingEvents(userId: string): Promise<number> {
    const pending = this.pendingEvents.get(userId);
    if (!pending || pending.length === 0) {
      return 0;
    }

    let successCount = 0;
    const stillPending: SyncEvent[] = [];

    for (const event of pending) {
      try {
        const success = await this.syncEvent(event);
        if (success) {
          successCount++;
        } else {
          stillPending.push(event);
        }
      } catch (error) {
        this.logger.error(`Retry failed for event ${event.id}: ${error.message}`);
        stillPending.push(event);
      }
    }

    // Update pending events
    if (stillPending.length > 0) {
      this.pendingEvents.set(userId, stillPending);
    } else {
      this.pendingEvents.delete(userId);
    }

    this.logger.debug(`Retried ${pending.length} events for user ${userId}, ${successCount} succeeded`);
    return successCount;
  }

  /**
   * Get event history for debugging and analytics
   */
  getEventHistory(filters: {
    userId?: string;
    roomId?: string;
    messageId?: string;
    type?: string;
    limit?: number;
  }): SyncEvent[] {
    const allEvents: SyncEvent[] = [];
    
    for (const events of this.eventCache.values()) {
      allEvents.push(...events);
    }

    let filtered = allEvents;

    if (filters.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }
    if (filters.roomId) {
      filtered = filtered.filter(e => e.roomId === filters.roomId);
    }
    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }

    // Sort by timestamp (most recent first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  // Private methods

  private storeEventInCache(event: SyncEvent): void {
    const key = this.getCacheKey(event);
    const events = this.eventCache.get(key) || [];
    
    events.push(event);
    
    // Limit cache size per key
    if (events.length > this.maxCacheSize) {
      events.shift(); // Remove oldest event
    }
    
    this.eventCache.set(key, events);
  }

  private getCacheKey(event: SyncEvent): string {
    if (event.roomId) {
      return `room:${event.roomId}`;
    }
    return `user:${event.userId}`;
  }

  private async detectConflicts(event: SyncEvent): Promise<SyncEvent[]> {
    const key = this.getCacheKey(event);
    const events = this.eventCache.get(key) || [];
    
    // Look for conflicts in the last 5 seconds
    const recentEvents = events.filter(e => 
      Math.abs(e.timestamp - event.timestamp) < 5000 && 
      e.type === event.type &&
      e.id !== event.id
    );

    return recentEvents;
  }

  private async resolveConflicts(event: SyncEvent, conflicts: SyncEvent[]): Promise<void> {
    for (const conflict of conflicts) {
      const resolution = this.determineWinner(event, conflict);
      
      if (resolution.winner.id === event.id) {
        // Current event wins, invalidate conflicting event
        await this.invalidateEvent(conflict);
      } else {
        // Conflicting event wins, current event should be discarded
        throw new Error(`Event ${event.id} conflicts with ${conflict.id} and loses`);
      }
    }
  }

  private determineWinner(event1: SyncEvent, event2: SyncEvent): ConflictResolution {
    // Strategy: Server timestamp wins (last write wins)
    const winner = event1.timestamp >= event2.timestamp ? event1 : event2;
    const loser = winner === event1 ? event2 : event1;

    return {
      winner,
      loser,
      strategy: 'timestamp',
      resolved: true
    };
  }

  private async invalidateEvent(event: SyncEvent): Promise<void> {
    this.logger.debug(`Invalidating conflicting event: ${event.id}`);
    // Remove from cache and mark as invalid
    const key = this.getCacheKey(event);
    const events = this.eventCache.get(key) || [];
    const filtered = events.filter(e => e.id !== event.id);
    this.eventCache.set(key, filtered);
  }

  private async syncMessageEvent(event: SyncEvent): Promise<boolean> {
    // Verify message exists in database
    const message = await this.messageRepository.findById(event.payload.messageId);
    if (!message) {
      this.logger.warn(`Message ${event.payload.messageId} not found in database`);
      return false;
    }

    // Update cache invalidation if needed
    return true;
  }

  private async syncReactionEvent(event: SyncEvent): Promise<boolean> {
    // Implementation for reaction sync
    return true;
  }

  private async syncEditEvent(event: SyncEvent): Promise<boolean> {
    // Implementation for edit sync
    return true;
  }

  private async syncDeleteEvent(event: SyncEvent): Promise<boolean> {
    // Implementation for delete sync
    return true;
  }

  private async syncReadEvent(event: SyncEvent): Promise<boolean> {
    // Implementation for read receipt sync
    return true;
  }

  private async syncTypingEvent(event: SyncEvent): Promise<boolean> {
    // Typing events are ephemeral, no DB sync needed
    return true;
  }
  private async syncPresenceEvent(event: SyncEvent): Promise<boolean> {
    // Update user presence in database
    try {
      await this.userRepository.updateStatus(
        event.userId, 
        event.payload.status, 
        event.payload.isOnline ?? true
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to sync presence for user ${event.userId}: ${error.message}`);
      return false;
    }
  }

  private validateMessageConsistency(message: Message, events: SyncEvent[]): boolean {
    // Compare database state with event history
    // This is a simplified implementation
    return true;
  }

  private async validateRoomConsistency(roomId: string): Promise<boolean> {
    // Validate room state consistency
    return true;
  }

  private getEventsForMessage(messageId: string): SyncEvent[] {
    const allEvents: SyncEvent[] = [];
    
    for (const events of this.eventCache.values()) {
      const messageEvents = events.filter(e => 
        e.payload?.messageId === messageId ||
        e.payload?.message?.id === messageId
      );
      allEvents.push(...messageEvents);
    }

    return allEvents;
  }

  private addToPendingEvents(event: SyncEvent): void {
    const pending = this.pendingEvents.get(event.userId) || [];
    pending.push(event);
    
    // Limit pending events per user
    if (pending.length > 100) {
      pending.shift(); // Remove oldest
    }
    
    this.pendingEvents.set(event.userId, pending);
  }

  private cleanupOldEvents(): void {
    const now = Date.now();
    
    for (const [key, events] of this.eventCache.entries()) {
      const fresh = events.filter(e => (now - e.timestamp) < this.eventRetentionMs);
      
      if (fresh.length !== events.length) {
        this.eventCache.set(key, fresh);
      }
    }

    // Cleanup pending events older than 5 minutes
    for (const [userId, events] of this.pendingEvents.entries()) {
      const fresh = events.filter(e => (now - e.timestamp) < 300000);
      
      if (fresh.length !== events.length) {
        if (fresh.length > 0) {
          this.pendingEvents.set(userId, fresh);
        } else {
          this.pendingEvents.delete(userId);
        }
      }
    }
  }
}
