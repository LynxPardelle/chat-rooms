import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AnalyticsEvent {
  id: string;
  type: string;
  userId?: string;
  sessionId?: string;
  roomId?: string;
  messageId?: string;
  timestamp: number;
  data: Record<string, any>;
  metadata?: {
    userAgent?: string;
    ip?: string;
    country?: string;
    device?: string;
  };
}

export interface PerformanceMetric {
  id: string;
  type: 'response_time' | 'database_query' | 'websocket_latency' | 'api_call';
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  errorCode?: string;
  metadata?: Record<string, any>;
}

export interface UserEngagementMetric {
  userId: string;
  sessionId: string;
  messagesCount: number;
  roomsVisited: number;
  timeSpent: number; // in milliseconds
  lastActivity: number;
  features: {
    fileUpload: number;
    voiceMessage: number;
    reactions: number;
    mentions: number;
  };
}

export interface SystemHealthMetric {
  timestamp: number;
  cpu: number;
  memory: number;
  activeConnections: number;
  messagesPerSecond: number;
  errorRate: number;
  responseTime: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  
  // In-memory storage for events (in production, use Redis or database)
  private readonly events: AnalyticsEvent[] = [];
  private readonly performanceMetrics: PerformanceMetric[] = [];
  private readonly userEngagement = new Map<string, UserEngagementMetric>();
  private readonly systemHealth: SystemHealthMetric[] = [];
  
  // Configuration
  private readonly MAX_EVENTS = 10000;
  private readonly MAX_METRICS = 5000;
  private readonly CLEANUP_INTERVAL = 3600000; // 1 hour
  
  constructor(private readonly configService: ConfigService) {
    // Start cleanup interval
    setInterval(() => {
      this.cleanupOldData();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Track user event (message sent, login, etc.)
   */
  track(eventType: string, data: Record<string, any>, userId?: string, sessionId?: string): void {
    const event: AnalyticsEvent = {
      id: this.generateId(),
      type: eventType,
      userId,
      sessionId,
      roomId: data.roomId,
      messageId: data.messageId,
      timestamp: Date.now(),
      data,
      metadata: {
        userAgent: data.userAgent,
        ip: data.ip,
        device: this.detectDevice(data.userAgent)
      }
    };

    this.events.push(event);
    this.updateUserEngagement(event);
    
    // Cleanup if needed
    if (this.events.length > this.MAX_EVENTS) {
      this.events.splice(0, this.events.length - this.MAX_EVENTS);
    }

    this.logger.debug(`Event tracked: ${eventType} for user ${userId}`);
  }

  /**
   * Track performance metric
   */
  trackPerformance(
    type: PerformanceMetric['type'],
    operation: string,
    duration: number,
    success: boolean,
    errorCode?: string,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      type,
      operation,
      duration,
      timestamp: Date.now(),
      success,
      errorCode,
      metadata
    };

    this.performanceMetrics.push(metric);
    
    // Cleanup if needed
    if (this.performanceMetrics.length > this.MAX_METRICS) {
      this.performanceMetrics.splice(0, this.performanceMetrics.length - this.MAX_METRICS);
    }

    this.logger.debug(`Performance tracked: ${operation} took ${duration}ms`);
  }

  /**
   * Track system health metrics
   */
  trackSystemHealth(metrics: Omit<SystemHealthMetric, 'timestamp'>): void {
    const healthMetric: SystemHealthMetric = {
      ...metrics,
      timestamp: Date.now()
    };

    this.systemHealth.push(healthMetric);
    
    // Keep only last 24 hours of system health data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const validMetrics = this.systemHealth.filter(m => m.timestamp > cutoff);
    this.systemHealth.length = 0;
    this.systemHealth.push(...validMetrics);
  }

  /**
   * Get real-time dashboard metrics
   */
  getDashboardMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): any {
    const cutoff = this.getTimeCutoff(timeRange);
    const recentEvents = this.events.filter(e => e.timestamp > cutoff);
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    const recentHealth = this.systemHealth.filter(m => m.timestamp > cutoff);

    return {
      overview: {
        totalEvents: recentEvents.length,
        activeUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
        messagesCount: recentEvents.filter(e => e.type === 'message_sent').length,
        avgResponseTime: this.calculateAverageResponseTime(recentMetrics),
        errorRate: this.calculateErrorRate(recentMetrics)
      },
      userActivity: this.getUserActivityMetrics(recentEvents),
      performance: this.getPerformanceAnalytics(recentMetrics),
      systemHealth: this.getSystemHealthSummary(recentHealth),
      topEvents: this.getTopEvents(recentEvents),
      realtimeStats: this.getRealtimeStats()
    };
  }

  /**
   * Get historical data for charts
   */
  getHistoricalData(
    metric: 'messages' | 'users' | 'performance' | 'errors',
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h',
    granularity: 'minute' | 'hour' | 'day' = 'hour'
  ): any[] {
    const cutoff = this.getTimeCutoff(timeRange);
    const events = this.events.filter(e => e.timestamp > cutoff);
    const metrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);

    return this.aggregateDataByTime(events, metrics, metric, granularity);
  }

  /**
   * Export analytics data
   */
  exportData(
    format: 'json' | 'csv',
    timeRange: '24h' | '7d' | '30d' = '24h',
    dataType: 'events' | 'performance' | 'engagement' | 'all' = 'all'
  ): any {
    const cutoff = this.getTimeCutoff(timeRange);
    
    let data: any = {};
    
    if (dataType === 'events' || dataType === 'all') {
      data.events = this.events.filter(e => e.timestamp > cutoff);
    }
    
    if (dataType === 'performance' || dataType === 'all') {
      data.performance = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    }
    
    if (dataType === 'engagement' || dataType === 'all') {
      data.engagement = Array.from(this.userEngagement.values());
    }

    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }

  /**
   * Get user engagement analytics
   */
  getUserEngagementAnalytics(userId?: string): any {
    if (userId) {
      return this.userEngagement.get(userId) || null;
    }

    const allEngagement = Array.from(this.userEngagement.values());
    return {
      totalUsers: allEngagement.length,
      averageMessagesPerUser: allEngagement.reduce((sum, u) => sum + u.messagesCount, 0) / allEngagement.length,
      averageTimeSpent: allEngagement.reduce((sum, u) => sum + u.timeSpent, 0) / allEngagement.length,
      topUsers: allEngagement
        .sort((a, b) => b.messagesCount - a.messagesCount)
        .slice(0, 10),
      featureUsage: this.aggregateFeatureUsage(allEngagement)
    };
  }  /**
   * Get performance metrics for specific time range
   */
  public getPerformanceMetrics(timeRange: string, startDate?: string, endDate?: string): any {
    let cutoff = this.getTimeCutoff(timeRange);
    
    // Use provided date range if available
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      cutoff = Math.min(cutoff, start);
    }
    
    const metrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    const recentHealth = this.systemHealth.filter(m => m.timestamp > cutoff);
    
    return {
      cpuUsage: recentHealth.length > 0 ? recentHealth[recentHealth.length - 1].cpu : 0,
      memoryUsage: recentHealth.length > 0 ? recentHealth[recentHealth.length - 1].memory : 0,
      responseTime: this.calculateAverageResponseTime(metrics),
      errorRate: this.calculateErrorRate(metrics),
      throughput: metrics.length / ((Date.now() - cutoff) / 3600000), // per hour
      activeConnections: recentHealth.length > 0 ? recentHealth[recentHealth.length - 1].activeConnections : 0
    };
  }

  /**
   * Get user activity analytics data
   */
  public getUserActivityData(period: string, timeRange: string): any {
    const cutoff = this.getTimeCutoff(timeRange);
    const events = this.events.filter(e => e.timestamp > cutoff);
    
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean));
    const dailyActiveUsers = uniqueUsers.size;
    const monthlyActiveUsers = new Set(this.events.filter(e => 
      e.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000 && e.userId
    ).map(e => e.userId)).size;
    
    return {
      dailyActiveUsers,
      monthlyActiveUsers,
      userRegistrations: events.filter(e => e.type === 'user_registered').length,
      totalActiveUsers: uniqueUsers.size,
      averageSessionDuration: this.calculateAverageSessionDuration(events),
      peakConcurrentUsers: this.calculatePeakConcurrentUsers(events)
    };
  }

  /**
   * Get message analytics
   */
  public getMessageAnalytics(roomId?: string, timeRange?: string): any {
    const cutoff = timeRange ? this.getTimeCutoff(timeRange) : this.getTimeCutoff('24h');
    let events = this.events.filter(e => e.timestamp > cutoff && e.type === 'message_sent');
    
    if (roomId) {
      events = events.filter(e => e.roomId === roomId);
    }
    
    const roomCounts = new Map<string, number>();
    events.forEach(e => {
      if (e.roomId) {
        roomCounts.set(e.roomId, (roomCounts.get(e.roomId) || 0) + 1);
      }
    });
    
    const popularRooms = Array.from(roomCounts.entries())
      .map(([roomId, count]) => ({ roomId, messageCount: count }))
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10);
    
    return {
      totalMessages: events.length,
      messagesPerDay: this.calculateMessagesPerDay(events),
      popularRooms,
      averageMessageLength: this.calculateAverageMessageLength(events),
      messageTypes: this.getMessageTypeDistribution(events)
    };
  }

  // Private helper methods

  private updateUserEngagement(event: AnalyticsEvent): void {
    if (!event.userId || !event.sessionId) return;

    const key = `${event.userId}:${event.sessionId}`;
    let engagement = this.userEngagement.get(key);

    if (!engagement) {
      engagement = {
        userId: event.userId,
        sessionId: event.sessionId,
        messagesCount: 0,
        roomsVisited: 0,
        timeSpent: 0,
        lastActivity: event.timestamp,
        features: {
          fileUpload: 0,
          voiceMessage: 0,
          reactions: 0,
          mentions: 0
        }
      };
      this.userEngagement.set(key, engagement);
    }

    // Update engagement metrics based on event type
    switch (event.type) {
      case 'message_sent':
        engagement.messagesCount++;
        break;
      case 'room_joined':
        engagement.roomsVisited++;
        break;
      case 'file_uploaded':
        engagement.features.fileUpload++;
        break;
      case 'voice_message_sent':
        engagement.features.voiceMessage++;
        break;
      case 'reaction_added':
        engagement.features.reactions++;
        break;
      case 'user_mentioned':
        engagement.features.mentions++;
        break;
    }

    // Update time spent (rough calculation)
    if (engagement.lastActivity) {
      const timeDiff = event.timestamp - engagement.lastActivity;
      if (timeDiff < 300000) { // Less than 5 minutes = active session
        engagement.timeSpent += timeDiff;
      }
    }

    engagement.lastActivity = event.timestamp;
  }

  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    const apiMetrics = metrics.filter(m => m.type === 'api_call' || m.type === 'response_time');
    if (apiMetrics.length === 0) return 0;
    
    return apiMetrics.reduce((sum, m) => sum + m.duration, 0) / apiMetrics.length;
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    
    const errors = metrics.filter(m => !m.success).length;
    return (errors / metrics.length) * 100;
  }

  private calculateAverageSessionDuration(events: AnalyticsEvent[]): number {
    // Calculate average session duration for active users
    const userSessions = new Map<string, { start?: number, end?: number }>();
      events.forEach(e => {
      if (e.userId && e.type === 'user_logged_in') {
        userSessions.set(e.userId, { start: e.timestamp });
      } else if (e.userId && (e.type === 'user_logged_out' || e.type === 'session_expired')) {
        const session = userSessions.get(e.userId);
        if (session && session.start) {
          session.end = e.timestamp;
        }
      }
    });

    const durations = Array.from(userSessions.values())
      .map(s => s.end && s.start ? s.end - s.start : 0)
      .filter(d => d > 0);
    
    if (durations.length === 0) return 0;
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  }

  private calculatePeakConcurrentUsers(events: AnalyticsEvent[]): number {
    // Calculate peak concurrent users based on events
    const timeline = new Map<number, number>();
    
    events.forEach(e => {
      if (e.type === 'user_logged_in') {
        timeline.set(e.timestamp, (timeline.get(e.timestamp) || 0) + 1);
      } else if (e.type === 'user_logged_out' || e.type === 'session_expired') {
        timeline.set(e.timestamp, (timeline.get(e.timestamp) || 0) - 1);
      }
    });

    let maxUsers = 0;
    let currentUsers = 0;
    
    timeline.forEach(change => {
      currentUsers += change;
      if (currentUsers > maxUsers) {
        maxUsers = currentUsers;
      }
    });
    
    return maxUsers;
  }

  private calculateMessagesPerDay(events: AnalyticsEvent[]): number {
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const oneDayAgo = now - oneDayInMs;
    
    const recentEvents = events.filter(e => 
      e.type === 'message_sent' && e.timestamp > oneDayAgo
    );
    
    return recentEvents.length;
  }
  private calculateAverageMessageLength(events: AnalyticsEvent[]): number {
    const messageEvents = events.filter(e => e.type === 'message_sent');
    
    if (messageEvents.length === 0) return 0;
    
    // For now, use a default message length as metadata structure doesn't include messageLength
    // In a real implementation, this would come from the actual message content
    const averageLength = 50; // Default average message length
    
    return averageLength;
  }
  private getMessageTypeDistribution(events: AnalyticsEvent[]): any {
    const messageEvents = events.filter(e => e.type === 'message_sent');
    const typeDistribution = new Map<string, number>();
    
    messageEvents.forEach(e => {
      // For now, default to 'text' type as metadata doesn't include messageType
      const messageType = 'text';
      typeDistribution.set(messageType, (typeDistribution.get(messageType) || 0) + 1);
    });
    
    return Object.fromEntries(typeDistribution);
  }

  private getUserActivityMetrics(events: AnalyticsEvent[]): any {
    const userEvents = events.filter(e => e.userId);
    const uniqueUsers = new Set(userEvents.map(e => e.userId));
    
    return {
      activeUsers: uniqueUsers.size,
      newUsers: this.getNewUsersCount(events),
      topActiveUsers: this.getTopActiveUsers(userEvents),
      usersByHour: this.getUsersByHour(userEvents)
    };
  }


  private getSystemHealthSummary(health: SystemHealthMetric[]): any {
    if (health.length === 0) return null;

    const latest = health[health.length - 1];
    const average = {
      cpu: health.reduce((sum, h) => sum + h.cpu, 0) / health.length,
      memory: health.reduce((sum, h) => sum + h.memory, 0) / health.length,
      responseTime: health.reduce((sum, h) => sum + h.responseTime, 0) / health.length
    };

    return {
      current: latest,
      average,
      trend: this.calculateTrend(health)
    };
  }

  private getRealtimeStats(): any {
    const now = Date.now();
    const lastMinute = now - 60000;
    const recentEvents = this.events.filter(e => e.timestamp > lastMinute);

    return {
      eventsPerMinute: recentEvents.length,
      activeUsers: new Set(recentEvents.map(e => e.userId).filter(Boolean)).size,
      messagesPerMinute: recentEvents.filter(e => e.type === 'message_sent').length,
      timestamp: now
    };
  }

  private getTimeCutoff(timeRange: string): number {
    const now = Date.now();
    switch (timeRange) {
      case '1h': return now - 3600000;
      case '24h': return now - 86400000;
      case '7d': return now - 604800000;
      case '30d': return now - 2592000000;
      default: return now - 86400000;
    }
  }

  private aggregateDataByTime(
    events: AnalyticsEvent[],
    metrics: PerformanceMetric[],
    metricType: string,
    granularity: string
  ): any[] {
    // Implementation for aggregating data by time intervals
    // This would group data by hour/day/etc and return time series data
    return [];
  }

  private getTopEvents(events: AnalyticsEvent[]): any[] {
    const eventCounts = new Map<string, number>();
    events.forEach(e => {
      eventCounts.set(e.type, (eventCounts.get(e.type) || 0) + 1);
    });

    return Array.from(eventCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private cleanupOldData(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Remove old events
    const validEvents = this.events.filter(e => e.timestamp > cutoff);
    this.events.length = 0;
    this.events.push(...validEvents);
    
    // Remove old metrics
    const validMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    this.performanceMetrics.length = 0;
    this.performanceMetrics.push(...validMetrics);
    
    this.logger.debug('Cleaned up old analytics data');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectDevice(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  private getNewUsersCount(events: AnalyticsEvent[]): number {
    return events.filter(e => e.type === 'user_registered').length;
  }

  private getTopActiveUsers(events: AnalyticsEvent[]): any[] {
    const userCounts = new Map<string, number>();
    events.forEach(e => {
      if (e.userId) {
        userCounts.set(e.userId, (userCounts.get(e.userId) || 0) + 1);
      }
    });

    return Array.from(userCounts.entries())
      .map(([userId, count]) => ({ userId, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
  }

  private getUsersByHour(events: AnalyticsEvent[]): any[] {
    // Group users by hour for activity patterns
    return [];
  }

  private getOperationCounts(metrics: PerformanceMetric[]): any {
    const counts = new Map<string, number>();
    metrics.forEach(m => {
      counts.set(m.operation, (counts.get(m.operation) || 0) + 1);
    });
    return Object.fromEntries(counts);
  }

  private calculateTrend(health: SystemHealthMetric[]): string {
    if (health.length < 2) return 'stable';
    
    const recent = health.slice(-5);
    const older = health.slice(-10, -5);
    
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, h) => sum + h.cpu, 0) / recent.length;
    const olderAvg = older.reduce((sum, h) => sum + h.cpu, 0) / older.length;
    
    if (recentAvg > olderAvg * 1.1) return 'increasing';
    if (recentAvg < olderAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private aggregateFeatureUsage(engagement: UserEngagementMetric[]): any {
    const totals = {
      fileUpload: 0,
      voiceMessage: 0,
      reactions: 0,
      mentions: 0
    };

    engagement.forEach(e => {
      totals.fileUpload += e.features.fileUpload;
      totals.voiceMessage += e.features.voiceMessage;
      totals.reactions += e.features.reactions;
      totals.mentions += e.features.mentions;
    });

    return totals;
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion - in production, use a proper CSV library
    return JSON.stringify(data);
  }

  private getPerformanceAnalytics(metrics: PerformanceMetric[]): any {
    return {
      averageResponseTime: this.calculateAverageResponseTime(metrics),
      errorRate: this.calculateErrorRate(metrics),
      slowestOperations: metrics
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 5),
      operationCounts: this.getOperationCounts(metrics)
    };
  }
}
