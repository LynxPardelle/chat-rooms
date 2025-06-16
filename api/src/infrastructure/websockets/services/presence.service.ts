import { Injectable, Logger, Inject } from '@nestjs/common';
import { IUserRepository } from '../../../domain/interfaces';
import { UserStatus } from '../../../domain/types';
import { WebSocketConfigService } from '../websocket.config';

export interface UserPresence {
  userId: string;
  status: UserStatus;
  isOnline: boolean;
  lastSeen: number;
  lastActivity: number;
  deviceId?: string;
  location?: string;
  customStatus?: string;
  activityType?: 'typing' | 'reading' | 'idle' | 'active';
}

export interface PresenceEvent {
  userId: string;
  previousPresence: UserPresence;
  currentPresence: UserPresence;
  timestamp: number;
  changeType: 'status' | 'activity' | 'online' | 'offline';
}

export interface PresenceStats {
  totalUsers: number;
  onlineUsers: number;
  usersByStatus: Record<UserStatus, number>;
  averageSessionDuration: number;
  totalPresenceChanges: number;
}

interface DevicePresence {
  deviceId: string;
  userId: string;
  isOnline: boolean;
  lastSeen: number;
  userAgent?: string;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private userPresences = new Map<string, UserPresence>();
  private devicePresences = new Map<string, DevicePresence>(); // deviceId -> DevicePresence
  private userDevices = new Map<string, Set<string>>(); // userId -> Set<deviceId>
  private presenceHistory = new Map<string, PresenceEvent[]>(); // userId -> recent events
  private readonly historyLimit = 10;
  private readonly inactivityThreshold = 5 * 60 * 1000; // 5 minutes
  private readonly idleThreshold = 10 * 60 * 1000; // 10 minutes
  
  private stats: PresenceStats = {
    totalUsers: 0,
    onlineUsers: 0,
    usersByStatus: {
      online: 0,
      away: 0,
      busy: 0,
      offline: 0,
    },
    averageSessionDuration: 0,
    totalPresenceChanges: 0,
  };

  private presenceChangeCallbacks = new Set<(event: PresenceEvent) => void>();

  constructor(
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
    private readonly configService: WebSocketConfigService,
  ) {
    // Update presence statuses periodically
    setInterval(() => this.updatePresenceStatuses(), 30000); // Every 30 seconds
    
    // Update stats periodically
    setInterval(() => this.updateStats(), 10000); // Every 10 seconds
    
    // Cleanup old presence history
    setInterval(() => this.cleanupPresenceHistory(), 60000); // Every minute
  }

  /**
   * Register a user's presence
   */  async setUserOnline(
    userId: string,
    deviceId: string,
    status: UserStatus = UserStatus.ONLINE,
    customStatus?: string,
  ): Promise<void> {
    const now = Date.now();
    
    // Update device presence
    this.devicePresences.set(deviceId, {
      deviceId,
      userId,
      isOnline: true,
      lastSeen: now,
    });

    // Add device to user's device list
    if (!this.userDevices.has(userId)) {
      this.userDevices.set(userId, new Set());
    }
    this.userDevices.get(userId)!.add(deviceId);

    // Get previous presence
    const previousPresence = this.userPresences.get(userId);
    
    // Update user presence
    const currentPresence: UserPresence = {
      userId,
      status,
      isOnline: true,
      lastSeen: now,
      lastActivity: now,
      deviceId,
      customStatus,
      activityType: 'active',
    };

    this.userPresences.set(userId, currentPresence);

    // Persist to database
    try {
      await this.userRepository.updateStatus(userId, status, true);
    } catch (error) {
      this.logger.error(`Failed to update user status in database: ${error.message}`);
    }

    // Emit presence change event
    if (previousPresence) {
      await this.emitPresenceChange(previousPresence, currentPresence, 'online');
    }

    this.updateStats();

    if (this.configService.enableDetailedLogging) {
      this.logger.debug(`User ${userId} came online with status ${status} from device ${deviceId}`);
    }
  }

  /**
   * Update user's status
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
    customStatus?: string,
  ): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence) {
      this.logger.warn(`Cannot update status for user ${userId}: not found`);
      return;
    }

    const previousPresence = { ...presence };
    presence.status = status;
    presence.lastActivity = Date.now();
    
    if (customStatus !== undefined) {
      presence.customStatus = customStatus;
    }

    // Persist to database
    try {
      await this.userRepository.updateStatus(userId, status, presence.isOnline);
    } catch (error) {
      this.logger.error(`Failed to update user status in database: ${error.message}`);
    }

    // Emit presence change event
    await this.emitPresenceChange(previousPresence, presence, 'status');

    this.updateStats();

    if (this.configService.enableDetailedLogging) {
      this.logger.debug(`User ${userId} updated status to ${status}`);
    }
  }

  /**
   * Update user's activity
   */
  updateUserActivity(
    userId: string,
    activityType: UserPresence['activityType'] = 'active',
  ): void {
    const presence = this.userPresences.get(userId);
    if (!presence) {
      return;
    }

    const previousActivity = presence.activityType;
    presence.lastActivity = Date.now();
    presence.activityType = activityType;

    // Only emit event if activity type changed
    if (previousActivity !== activityType) {
      const previousPresence = { ...presence, activityType: previousActivity };
      this.emitPresenceChange(previousPresence, presence, 'activity');
    }

    if (this.configService.enableDetailedLogging && previousActivity !== activityType) {
      this.logger.debug(`User ${userId} activity changed from ${previousActivity} to ${activityType}`);
    }
  }

  /**
   * Set user offline
   */
  async setUserOffline(userId: string, deviceId?: string): Promise<void> {
    const presence = this.userPresences.get(userId);
    if (!presence) {
      return;
    }

    // Remove specific device or all devices
    if (deviceId) {
      this.devicePresences.delete(deviceId);
      const userDeviceSet = this.userDevices.get(userId);
      if (userDeviceSet) {
        userDeviceSet.delete(deviceId);
        
        // If user still has other devices online, don't mark as offline
        if (userDeviceSet.size > 0) {
          return;
        }
      }
    } else {
      // Remove all devices for user
      const userDeviceSet = this.userDevices.get(userId);
      if (userDeviceSet) {
        for (const dId of userDeviceSet) {
          this.devicePresences.delete(dId);
        }
        userDeviceSet.clear();
      }
    }

    const previousPresence = { ...presence };
    presence.isOnline = false;
    presence.lastSeen = Date.now();
    presence.activityType = undefined;

    // Persist to database
    try {
      await this.userRepository.updateStatus(userId, presence.status, false);
    } catch (error) {
      this.logger.error(`Failed to update user offline status in database: ${error.message}`);
    }

    // Emit presence change event
    await this.emitPresenceChange(previousPresence, presence, 'offline');

    this.updateStats();

    if (this.configService.enableDetailedLogging) {
      this.logger.debug(`User ${userId} went offline`);
    }
  }

  /**
   * Get user's current presence
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.userPresences.get(userId) || null;
  }

  /**
   * Get presence for multiple users
   */
  getMultipleUserPresences(userIds: string[]): Map<string, UserPresence> {
    const presences = new Map<string, UserPresence>();
    
    for (const userId of userIds) {
      const presence = this.userPresences.get(userId);
      if (presence) {
        presences.set(userId, presence);
      }
    }
    
    return presences;
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): UserPresence[] {
    return Array.from(this.userPresences.values()).filter(p => p.isOnline);
  }

  /**
   * Get users by status
   */
  getUsersByStatus(status: UserStatus): UserPresence[] {
    return Array.from(this.userPresences.values()).filter(p => p.status === status);
  }

  /**
   * Get presence history for a user
   */
  getUserPresenceHistory(userId: string): PresenceEvent[] {
    return this.presenceHistory.get(userId) || [];
  }

  /**
   * Get presence statistics
   */
  getStats(): PresenceStats {
    return { ...this.stats };
  }

  /**
   * Register a callback for presence changes
   */
  onPresenceChange(callback: (event: PresenceEvent) => void): void {
    this.presenceChangeCallbacks.add(callback);
  }

  /**
   * Remove a presence change callback
   */
  offPresenceChange(callback: (event: PresenceEvent) => void): void {
    this.presenceChangeCallbacks.delete(callback);
  }

  /**
   * Bulk update presences (for synchronization)
   */
  async bulkUpdatePresences(presences: { userId: string; status: UserStatus; isOnline: boolean }[]): Promise<void> {
    for (const update of presences) {
      const existing = this.userPresences.get(update.userId);
      if (existing) {
        const previousPresence = { ...existing };
        existing.status = update.status;
        existing.isOnline = update.isOnline;
        existing.lastSeen = Date.now();
        
        await this.emitPresenceChange(previousPresence, existing, 'status');
      }
    }
    
    this.updateStats();
  }

  /**
   * Clean up inactive users (admin function)
   */
  cleanupInactiveUsers(inactiveThresholdMs?: number): number {
    const threshold = inactiveThresholdMs || this.inactivityThreshold;
    const now = Date.now();
    let cleanedUp = 0;

    for (const [userId, presence] of this.userPresences.entries()) {
      if (presence.isOnline && (now - presence.lastActivity) > threshold) {
        this.setUserOffline(userId);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      this.logger.log(`Cleaned up ${cleanedUp} inactive users`);
    }

    return cleanedUp;
  }

  // Private methods

  private async emitPresenceChange(
    previousPresence: UserPresence,
    currentPresence: UserPresence,
    changeType: PresenceEvent['changeType'],
  ): Promise<void> {
    const event: PresenceEvent = {
      userId: currentPresence.userId,
      previousPresence,
      currentPresence,
      timestamp: Date.now(),
      changeType,
    };

    // Add to history
    this.addToPresenceHistory(event);

    // Emit to callbacks
    for (const callback of this.presenceChangeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        this.logger.error(`Error in presence change callback: ${error.message}`);
      }
    }

    this.stats.totalPresenceChanges++;
  }

  private addToPresenceHistory(event: PresenceEvent): void {
    let history = this.presenceHistory.get(event.userId);
    if (!history) {
      history = [];
      this.presenceHistory.set(event.userId, history);
    }

    history.push(event);
    
    // Limit history size
    if (history.length > this.historyLimit) {
      history.shift();
    }
  }

  private updatePresenceStatuses(): void {
    const now = Date.now();
    
    for (const [userId, presence] of this.userPresences.entries()) {
      if (!presence.isOnline) {
        continue;
      }

      const timeSinceActivity = now - presence.lastActivity;
      let newStatus = presence.status;      // Auto-update status based on activity
      if (timeSinceActivity > this.idleThreshold && presence.status === UserStatus.ONLINE) {
        newStatus = UserStatus.AWAY;
      } else if (timeSinceActivity > this.inactivityThreshold && presence.status === UserStatus.AWAY) {
        // Mark as offline if inactive too long
        this.setUserOffline(userId);
        continue;
      }

      // Update status if changed
      if (newStatus !== presence.status) {
        this.updateUserStatus(userId, newStatus);
      }
    }
  }

  private updateStats(): void {
    let onlineCount = 0;
    const statusCounts: Record<UserStatus, number> = {
      online: 0,
      away: 0,
      busy: 0,
      offline: 0,
    };

    for (const presence of this.userPresences.values()) {
      if (presence.isOnline) {
        onlineCount++;
      }
      statusCounts[presence.status]++;
    }

    this.stats.totalUsers = this.userPresences.size;
    this.stats.onlineUsers = onlineCount;
    this.stats.usersByStatus = statusCounts;
  }

  private cleanupPresenceHistory(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [userId, history] of this.presenceHistory.entries()) {
      const filtered = history.filter(event => event.timestamp > cutoff);
      
      if (filtered.length !== history.length) {
        if (filtered.length > 0) {
          this.presenceHistory.set(userId, filtered);
        } else {
          this.presenceHistory.delete(userId);
        }
      }
    }
  }
}
