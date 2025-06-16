import { Injectable, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdvancedThrottlerGuard } from './advanced-throttler.guard';
import { AppLoggerService } from '../../logging/app-logger.service';
import { RedisCacheService } from '../../cache/redis-cache.service';

export interface RateLimitStatus {
  blockedIPs: Array<{ ip: string; expiresAt: Date; violationCount: number }>;
  suspiciousIPs: Array<{ ip: string; violationCount: number }>;
  totalBlocked: number;
  totalSuspicious: number;
  distributedBlocked?: number; // For Redis-backed rate limiting
}

export interface RateLimitMetrics {
  timestamp: Date;
  totalRequests: number;
  blockedRequests: number;
  allowedRequests: number;
  blockRate: number; // percentage
  topOffendingIPs: Array<{ ip: string; violationCount: number }>;
  distributedMetrics?: any; // For multi-instance deployments
}

export interface SlidingWindowConfig {
  windowSize: number; // in seconds
  maxRequests: number;
  keyPrefix: string;
}

@Injectable()
export class RateLimitingService {
  private readonly logger = new AppLoggerService('RateLimitingService');
  private readonly metrics = new Map<string, number>(); // endpoint -> request count
  private readonly requestHistory: Array<{ timestamp: Date; allowed: boolean; ip: string }> = [];
  private readonly maxHistorySize = 10000;

  constructor(
    private readonly configService: ConfigService,
    private readonly throttlerGuard: AdvancedThrottlerGuard,
    @Optional() private readonly cacheService?: RedisCacheService,
  ) {
    // Clean up metrics periodically
    setInterval(() => this.cleanupMetrics(), 300000); // 5 minutes
  }

  /**
   * Sliding window rate limiting using Redis
   */
  async checkSlidingWindow(
    identifier: string,
    config: SlidingWindowConfig,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (!this.cacheService) {
      // Fallback to in-memory rate limiting
      return this.checkInMemoryWindow(identifier, config);
    }

    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - (config.windowSize * 1000);

    try {
      // Use Redis ZRANGEBYSCORE to count requests in window
      const requestCount = await this.cacheService.incrementCounter(
        `${key}:count`,
        config.windowSize
      );

      const allowed = requestCount <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - requestCount);
      const resetTime = now + (config.windowSize * 1000);

      // Log if limit exceeded
      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for ${identifier}: ${requestCount}/${config.maxRequests}`);
      }

      return { allowed, remaining, resetTime };
    } catch (error) {
      this.logger.error(`Error in sliding window check: ${error.message}`);
      // Fallback to allowing the request
      return { allowed: true, remaining: config.maxRequests, resetTime: now };
    }
  }

  /**
   * Fallback in-memory sliding window
   */
  private checkInMemoryWindow(
    identifier: string,
    config: SlidingWindowConfig,
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const key = `${config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - (config.windowSize * 1000);

    // Clean old entries and count current requests
    let requests = this.metrics.get(key) || 0;
    
    const allowed = requests < config.maxRequests;
    if (allowed) {
      this.metrics.set(key, requests + 1);
    }

    const remaining = Math.max(0, config.maxRequests - requests - (allowed ? 1 : 0));
    const resetTime = now + (config.windowSize * 1000);

    return { allowed, remaining, resetTime };
  }

  /**
   * Adaptive rate limiting based on server load
   */
  async checkAdaptiveLimit(
    identifier: string,
    baseConfig: SlidingWindowConfig,
    serverLoad: number, // 0-1 scale
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number; adjustedLimit: number }> {
    // Adjust limits based on server load
    const loadFactor = Math.max(0.1, 1 - serverLoad); // Reduce limits when load is high
    const adjustedLimit = Math.floor(baseConfig.maxRequests * loadFactor);

    const adaptiveConfig: SlidingWindowConfig = {
      ...baseConfig,
      maxRequests: adjustedLimit,
    };

    const result = await this.checkSlidingWindow(identifier, adaptiveConfig);
    
    return {
      ...result,
      adjustedLimit,
    };
  }

  /**
   * Whitelist trusted users with higher limits
   */
  async checkWithWhitelist(
    identifier: string,
    config: SlidingWindowConfig,
    isTrusted: boolean = false,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    if (isTrusted) {
      // Trusted users get 5x the normal limit
      const trustedConfig: SlidingWindowConfig = {
        ...config,
        maxRequests: config.maxRequests * 5,
        keyPrefix: `${config.keyPrefix}:trusted`,
      };
      return this.checkSlidingWindow(identifier, trustedConfig);
    }

    return this.checkSlidingWindow(identifier, config);
  }

  /**
   * Get current rate limiting status
   */
  getStatus(): RateLimitStatus {
    const blockedIPs = this.throttlerGuard.getBlockedIPs();
    const suspiciousIPs = this.throttlerGuard.getSuspiciousIPs();

    return {
      blockedIPs,
      suspiciousIPs,
      totalBlocked: blockedIPs.length,
      totalSuspicious: suspiciousIPs.length,
    };
  }

  /**
   * Get rate limiting metrics for monitoring
   */
  getMetrics(timeWindow = 3600000): RateLimitMetrics { // Default 1 hour
    const now = Date.now();
    const windowStart = now - timeWindow;

    const recentRequests = this.requestHistory.filter(
      req => req.timestamp.getTime() > windowStart
    );

    const totalRequests = recentRequests.length;
    const blockedRequests = recentRequests.filter(req => !req.allowed).length;
    const allowedRequests = totalRequests - blockedRequests;
    const blockRate = totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;

    // Get top offending IPs
    const ipViolations = new Map<string, number>();
    recentRequests
      .filter(req => !req.allowed)
      .forEach(req => {
        ipViolations.set(req.ip, (ipViolations.get(req.ip) || 0) + 1);
      });

    const topOffendingIPs = Array.from(ipViolations.entries())
      .map(([ip, violationCount]) => ({ ip, violationCount }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);

    return {
      timestamp: new Date(),
      totalRequests,
      blockedRequests,
      allowedRequests,
      blockRate,
      topOffendingIPs,
    };
  }

  /**
   * Record a request for metrics
   */
  recordRequest(ip: string, allowed: boolean, endpoint?: string): void {
    // Add to history
    this.requestHistory.push({
      timestamp: new Date(),
      allowed,
      ip,
    });

    // Maintain history size
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.splice(0, this.requestHistory.length - this.maxHistorySize);
    }

    // Update endpoint metrics
    if (endpoint) {
      const key = `${endpoint}:${allowed ? 'allowed' : 'blocked'}`;
      this.metrics.set(key, (this.metrics.get(key) || 0) + 1);
    }

    // Log blocked requests
    if (!allowed) {
      this.logger.logSecurity('Request blocked by rate limiting', {
        eventType: 'rate_limit',
        severity: 'medium',
        ip,
        endpoint,
        blocked: true,
      });
    }
  }

  /**
   * Manually unblock an IP address
   */
  unblockIP(ip: string): boolean {
    const wasBlocked = this.throttlerGuard.unblockIP(ip);
    
    if (wasBlocked) {
      this.logger.logSecurity('IP manually unblocked via service', {
        eventType: 'authorization',
        severity: 'low',
        ip,
        blocked: false,
        reason: 'Manual intervention',
      });
    }

    return wasBlocked;
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const disabled = this.configService.get<boolean>('DISABLE_RATE_LIMITING');
    
    return !(isDevelopment && disabled);
  }

  /**
   * Get configuration information
   */
  getConfig(): Record<string, any> {
    return {
      enabled: this.isEnabled(),
      defaultTTL: this.configService.get<number>('THROTTLE_TTL') || 60000,
      defaultLimit: this.configService.get<number>('THROTTLE_LIMIT') || 100,
      authTTL: this.configService.get<number>('AUTH_THROTTLE_TTL') || 300000,
      authLimit: this.configService.get<number>('AUTH_THROTTLE_LIMIT') || 5,
      wsTTL: this.configService.get<number>('WS_THROTTLE_TTL') || 10000,
      wsLimit: this.configService.get<number>('WS_THROTTLE_LIMIT') || 50,
      uploadTTL: this.configService.get<number>('UPLOAD_THROTTLE_TTL') || 3600000,
      uploadLimit: this.configService.get<number>('UPLOAD_THROTTLE_LIMIT') || 10,
    };
  }

  /**
   * Get endpoint-specific metrics
   */
  getEndpointMetrics(): Record<string, { allowed: number; blocked: number; total: number; blockRate: number }> {
    const endpoints = new Map<string, { allowed: number; blocked: number }>();

    for (const [key, count] of this.metrics.entries()) {
      const [endpoint, status] = key.split(':');
      if (!endpoints.has(endpoint)) {
        endpoints.set(endpoint, { allowed: 0, blocked: 0 });
      }

      const metrics = endpoints.get(endpoint)!;
      if (status === 'allowed') {
        metrics.allowed = count;
      } else {
        metrics.blocked = count;
      }
    }

    const result: Record<string, { allowed: number; blocked: number; total: number; blockRate: number }> = {};
    for (const [endpoint, metrics] of endpoints.entries()) {
      const total = metrics.allowed + metrics.blocked;
      const blockRate = total > 0 ? (metrics.blocked / total) * 100 : 0;
      
      result[endpoint] = {
        ...metrics,
        total,
        blockRate,
      };
    }

    return result;
  }

  /**
   * Alert on suspicious patterns
   */
  checkForAnomalies(): Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }> {
    const anomalies: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }> = [];
    const metrics = this.getMetrics();

    // High block rate
    if (metrics.blockRate > 50) {
      anomalies.push({
        type: 'high_block_rate',
        description: `Unusually high block rate: ${metrics.blockRate.toFixed(2)}%`,
        severity: 'high',
      });
    }

    // Many blocked IPs
    const status = this.getStatus();
    if (status.totalBlocked > 20) {
      anomalies.push({
        type: 'many_blocked_ips',
        description: `High number of blocked IPs: ${status.totalBlocked}`,
        severity: 'medium',
      });
    }

    // Suspicious pattern: many requests from few IPs
    if (metrics.topOffendingIPs.length > 0) {
      const topOffender = metrics.topOffendingIPs[0];
      if (topOffender.violationCount > 100) {
        anomalies.push({
          type: 'aggressive_ip',
          description: `IP ${topOffender.ip} has ${topOffender.violationCount} violations`,
          severity: 'high',
        });
      }
    }

    return anomalies;
  }

  private cleanupMetrics(): void {
    // Keep only recent metrics (last 24 hours worth)
    const oneDayAgo = Date.now() - 86400000;
    
    // Clean up request history
    const cutoff = this.requestHistory.findIndex(
      req => req.timestamp.getTime() > oneDayAgo
    );
    if (cutoff > 0) {
      this.requestHistory.splice(0, cutoff);
    }

    this.logger.logSecurity('Rate limiting metrics cleaned up', {
      eventType: 'suspicious_activity',
      severity: 'low',
      details: {
        remainingHistoryEntries: this.requestHistory.length,
        totalMetrics: this.metrics.size,
      },
    });
  }
}
