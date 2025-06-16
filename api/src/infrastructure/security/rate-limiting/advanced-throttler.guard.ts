import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';
import { AppLoggerService } from '../../logging/app-logger.service';

export interface RateLimitConfig {
  ttl: number; // Time to live in seconds
  limit: number; // Number of requests
  blockDuration?: number; // Block duration in seconds if limit exceeded
  skipIf?: (context: ExecutionContext) => boolean;
  generateKey?: (context: ExecutionContext) => string;
  message?: string;
}

export interface RateLimitRule {
  name: string;
  config: RateLimitConfig;
  pattern?: RegExp; // URL pattern to match
  methods?: string[]; // HTTP methods to apply to
  userTypes?: string[]; // User types this applies to
}

@Injectable()
export class AdvancedThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new AppLoggerService('AdvancedThrottlerGuard');
  private readonly blockedIPs = new Map<string, number>(); // IP -> block expiry timestamp
  private readonly suspiciousActivity = new Map<string, number>(); // IP -> violation count

  protected async getTracker(req: Request): Promise<string> {
    // Use IP address as primary tracker
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Enhanced tracking for authenticated users
    const userId = (req as any).user?.id;
    if (userId) {
      return `user:${userId}:${ip}`;
    }
    
    return `ip:${ip}`;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    const path = request.url;
    const method = request.method;
    const userAgent = request.get('User-Agent');
    const userId = (request as any).user?.id;

    // Log security event
    this.logger.logSecurity('Rate limit exceeded', {
      eventType: 'rate_limit',
      severity: 'medium',
      ip,
      path,
      method,
      userAgent,
      userId,
      blocked: true,
    });

    // Track suspicious activity
    this.trackSuspiciousActivity(ip);

    throw new ThrottlerException('Rate limit exceeded. Please try again later.');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip || request.connection.remoteAddress || 'unknown';

    // Check if IP is currently blocked
    if (this.isBlocked(ip)) {
      this.logger.logSecurityCritical('Blocked IP attempted access', {
        eventType: 'suspicious_activity',
        severity: 'high',
        ip,
        path: request.url,
        method: request.method,
        userAgent: request.get('User-Agent'),
        blocked: true,
        reason: 'IP temporarily blocked due to rate limit violations',
      });

      throw new HttpException(
        'Access temporarily blocked due to suspicious activity',
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    try {
      return await super.canActivate(context);
    } catch (error) {
      if (error instanceof ThrottlerException) {
        await this.throwThrottlingException(context);
      }
      throw error;
    }
  }

  private trackSuspiciousActivity(ip: string): void {
    const currentCount = this.suspiciousActivity.get(ip) || 0;
    const newCount = currentCount + 1;
    
    this.suspiciousActivity.set(ip, newCount);

    // Block IP if too many violations
    if (newCount >= 5) {
      const blockDuration = this.calculateBlockDuration(newCount);
      const blockExpiry = Date.now() + blockDuration;
      
      this.blockedIPs.set(ip, blockExpiry);
      
      this.logger.logSecurityCritical('IP blocked due to repeated rate limit violations', {
        eventType: 'suspicious_activity',
        severity: 'critical',
        ip,
        violationCount: newCount,
        blockDuration: blockDuration / 1000, // in seconds
        blocked: true,
      });

      // Clean up old entries periodically
      setTimeout(() => this.cleanupExpiredBlocks(), 60000); // 1 minute
    }
  }

  private calculateBlockDuration(violationCount: number): number {
    // Progressive blocking: longer blocks for repeat offenders
    const baseBlockTime = 5 * 60 * 1000; // 5 minutes
    const multiplier = Math.min(violationCount - 4, 8); // Cap at 8x
    return baseBlockTime * multiplier;
  }

  private isBlocked(ip: string): boolean {
    const blockExpiry = this.blockedIPs.get(ip);
    if (!blockExpiry) return false;

    if (Date.now() > blockExpiry) {
      this.blockedIPs.delete(ip);
      this.suspiciousActivity.delete(ip);
      return false;
    }

    return true;
  }

  private cleanupExpiredBlocks(): void {
    const now = Date.now();
    for (const [ip, expiry] of this.blockedIPs.entries()) {
      if (now > expiry) {
        this.blockedIPs.delete(ip);
        this.suspiciousActivity.delete(ip);
      }
    }
  }

  // Method to manually unblock an IP (for admin use)
  unblockIP(ip: string): boolean {
    const wasBlocked = this.blockedIPs.has(ip);
    this.blockedIPs.delete(ip);
    this.suspiciousActivity.delete(ip);
    
    if (wasBlocked) {
      this.logger.logSecurity('IP manually unblocked', {
        eventType: 'authorization',
        severity: 'low',
        ip,
        blocked: false,
      });
    }
    
    return wasBlocked;
  }
  // Get current status for monitoring
  getBlockedIPs(): Array<{ ip: string; expiresAt: Date; violationCount: number }> {
    const result: Array<{ ip: string; expiresAt: Date; violationCount: number }> = [];
    for (const [ip, expiry] of this.blockedIPs.entries()) {
      result.push({
        ip,
        expiresAt: new Date(expiry),
        violationCount: this.suspiciousActivity.get(ip) || 0,
      });
    }
    return result;
  }

  getSuspiciousIPs(): Array<{ ip: string; violationCount: number }> {
    const result: Array<{ ip: string; violationCount: number }> = [];
    for (const [ip, count] of this.suspiciousActivity.entries()) {
      if (!this.blockedIPs.has(ip) && count > 0) {
        result.push({ ip, violationCount: count });
      }
    }
    return result;
  }
}
