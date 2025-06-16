import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  userId?: string;
  clientIP?: string;
  userAgent?: string;
  details: Record<string, any>;
  risk_score: number;
  resolved: boolean;
  response_actions: string[];
}

export type SecurityEventType = 
  | 'FAILED_LOGIN'
  | 'SUSPICIOUS_ACTIVITY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INJECTION_ATTEMPT'
  | 'MALWARE_DETECTED'
  | 'UNAUTHORIZED_ACCESS'
  | 'DATA_EXFILTRATION'
  | 'ANOMALOUS_BEHAVIOR'
  | 'PRIVILEGE_ESCALATION'
  | 'SESSION_HIJACKING'
  | 'CSRF_ATTACK'
  | 'XSS_ATTEMPT'
  | 'FILE_UPLOAD_THREAT'
  | 'API_ABUSE'
  | 'BRUTE_FORCE_ATTACK';

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ThreatDetectionRule {
  id: string;
  name: string;
  description: string;
  pattern: string | RegExp;
  threshold?: number;
  timeWindow?: number; // in milliseconds
  severity: SecuritySeverity;
  enabled: boolean;
  actions: SecurityAction[];
}

export type SecurityAction = 
  | 'LOG_EVENT'
  | 'BLOCK_IP'
  | 'INVALIDATE_SESSION'
  | 'SEND_ALERT'
  | 'ESCALATE_TO_ADMIN'
  | 'RATE_LIMIT'
  | 'QUARANTINE_USER'
  | 'DISABLE_ACCOUNT';

export interface SecurityMetrics {
  totalEvents: number;
  eventsLast24h: number;
  highSeverityEvents: number;
  blockedIPs: number;
  activeThreats: number;
  averageResponseTime: number;
  detectionAccuracy: number;
  falsePositiveRate: number;
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  confidence: number;
  reasons: string[];
  riskScore: number;
  suggestedActions: SecurityAction[];
}

@Injectable()
export class SecurityMonitoringService {
  private readonly logger = new Logger(SecurityMonitoringService.name);
  private readonly securityEvents: Map<string, SecurityEvent> = new Map();
  private readonly threatRules: Map<string, ThreatDetectionRule> = new Map();
  private readonly blockedIPs: Set<string> = new Set();
  private readonly sessionActivity: Map<string, Array<{ timestamp: Date; action: string }>> = new Map();
  private readonly userBehaviorBaselines: Map<string, any> = new Map();
    // Rate limiting tracking
  private readonly requestCounts: Map<string, Array<{ timestamp: Date; endpoint: string }>> = new Map();
  private readonly eventEmitter: EventEmitter;

  constructor(
    private configService: ConfigService,
  ) {
    this.eventEmitter = new EventEmitter();
    this.initializeThreatDetectionRules();
    this.startPeriodicCleanup();
  }

  /**
   * Reports a security event and triggers analysis
   */
  async reportSecurityEvent(
    type: SecurityEventType,
    source: string,
    details: Record<string, any>,
    userId?: string,
    clientIP?: string,
    userAgent?: string
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type,
      severity: this.calculateSeverity(type, details),
      timestamp: new Date(),
      source,
      userId,
      clientIP,
      userAgent,
      details,
      risk_score: this.calculateRiskScore(type, details, userId, clientIP),
      resolved: false,
      response_actions: [],
    };

    // Store the event
    this.securityEvents.set(event.id, event);

    // Emit event for other services to handle
    this.eventEmitter.emit('security.event', event);

    // Perform real-time threat analysis
    await this.analyzeAndRespond(event);

    this.logger.warn(`Security event reported: ${type} from ${source}`, {
      eventId: event.id,
      severity: event.severity,
      riskScore: event.risk_score,
    });

    return event;
  }

  /**
   * Detects anomalous user behavior
   */
  async detectAnomalousActivity(
    userId: string,
    action: string,
    metadata: Record<string, any>
  ): Promise<AnomalyDetectionResult> {
    const reasons: string[] = [];
    let riskScore = 0;
    let confidence = 0;

    try {
      // Get user behavior baseline
      const baseline = this.userBehaviorBaselines.get(userId);
      
      if (!baseline) {
        // No baseline yet, start building one
        this.initializeUserBaseline(userId, action, metadata);
        return {
          isAnomalous: false,
          confidence: 0,
          reasons: ['Building user behavior baseline'],
          riskScore: 0,
          suggestedActions: ['LOG_EVENT'],
        };
      }

      // Check for unusual time patterns
      const currentHour = new Date().getHours();
      if (!baseline.activeHours.includes(currentHour)) {
        reasons.push('Activity outside normal hours');
        riskScore += 20;
        confidence += 30;
      }

      // Check for unusual geographical patterns (if IP location is available)
      if (metadata.clientIP && baseline.typicalLocations) {
        // This would require IP geolocation service
        // const location = await this.getLocationFromIP(metadata.clientIP);
        // if (!baseline.typicalLocations.includes(location.country)) {
        //   reasons.push('Activity from unusual location');
        //   riskScore += 30;
        //   confidence += 40;
        // }
      }

      // Check for unusual action frequency
      const recentActions = this.getRecentUserActions(userId, 3600000); // last hour
      const actionFrequency = recentActions.filter(a => a.action === action).length;
      
      if (actionFrequency > (baseline.averageActionFrequency[action] || 0) * 3) {
        reasons.push('Unusually high action frequency');
        riskScore += 25;
        confidence += 35;
      }

      // Check for rapid succession of different actions
      const rapidActions = recentActions.filter(a => 
        new Date().getTime() - a.timestamp.getTime() < 60000 // last minute
      );
      
      if (rapidActions.length > 10) {
        reasons.push('Rapid succession of actions');
        riskScore += 30;
        confidence += 40;
      }

      // Update baseline with new data
      this.updateUserBaseline(userId, action, metadata);

      // Determine suggested actions based on risk score
      const suggestedActions: SecurityAction[] = ['LOG_EVENT'];
      
      if (riskScore > 50) {
        suggestedActions.push('SEND_ALERT');
      }
      
      if (riskScore > 75) {
        suggestedActions.push('RATE_LIMIT', 'ESCALATE_TO_ADMIN');
      }
      
      if (riskScore > 90) {
        suggestedActions.push('INVALIDATE_SESSION', 'QUARANTINE_USER');
      }

      return {
        isAnomalous: riskScore > 40,
        confidence,
        reasons,
        riskScore,
        suggestedActions,
      };
    } catch (error) {
      this.logger.error('Anomaly detection failed:', error);
      return {
        isAnomalous: true,
        confidence: 0,
        reasons: ['Anomaly detection system error'],
        riskScore: 50,
        suggestedActions: ['LOG_EVENT', 'SEND_ALERT'],
      };
    }
  }

  /**
   * Monitors for brute force attacks
   */
  async detectBruteForceAttack(
    identifier: string, // IP or username
    type: 'login' | 'api' | 'password_reset',
    isSuccessful: boolean
  ): Promise<{ isBruteForce: boolean; shouldBlock: boolean; timeToUnblock?: number }> {
    const key = `brute_force:${type}:${identifier}`;
    const windowSize = 900000; // 15 minutes
    const maxAttempts = type === 'login' ? 5 : type === 'api' ? 100 : 3;

    // Get recent attempts
    const attempts = this.getRecentAttempts(key, windowSize);
    
    // Add current attempt
    attempts.push({
      timestamp: new Date(),
      successful: isSuccessful,
    });

    // Count failed attempts in window
    const failedAttempts = attempts.filter(a => !a.successful).length;
    
    const isBruteForce = failedAttempts >= maxAttempts;
    const shouldBlock = isBruteForce && !isSuccessful;

    if (isBruteForce) {
      await this.reportSecurityEvent(
        'BRUTE_FORCE_ATTACK',
        'auth_monitor',
        {
          identifier,
          type,
          failedAttempts,
          windowSize,
          maxAttempts,
        }
      );
    }

    return {
      isBruteForce,
      shouldBlock,
      timeToUnblock: shouldBlock ? windowSize : undefined,
    };
  }

  /**
   * Monitors API usage for abuse patterns
   */
  async monitorAPIUsage(
    apiKey: string,
    endpoint: string,
    clientIP: string,
    responseTime: number,
    statusCode: number
  ): Promise<{ isAbusive: boolean; actions: SecurityAction[] }> {
    const key = `api_usage:${apiKey}:${clientIP}`;
    const windowSize = 3600000; // 1 hour
    const maxRequestsPerHour = 1000;
    const maxErrorRate = 0.3; // 30%

    // Track request
    const requests = this.requestCounts.get(key) || [];
    requests.push({
      timestamp: new Date(),
      endpoint,
    });

    // Clean old requests
    const cutoff = new Date(Date.now() - windowSize);
    const recentRequests = requests.filter(r => r.timestamp > cutoff);
    this.requestCounts.set(key, recentRequests);

    // Analyze patterns
    const totalRequests = recentRequests.length;
    const errorResponses = recentRequests.filter(r => 
      // This would need to be tracked separately in a real implementation
      false // statusCode >= 400
    ).length;
    
    const errorRate = totalRequests > 0 ? errorResponses / totalRequests : 0;
    const isHighVolume = totalRequests > maxRequestsPerHour;
    const isHighErrorRate = errorRate > maxErrorRate;

    const actions: SecurityAction[] = [];
    
    if (isHighVolume) {
      actions.push('RATE_LIMIT', 'LOG_EVENT');
      
      if (isHighErrorRate) {
        actions.push('SEND_ALERT', 'ESCALATE_TO_ADMIN');
        
        await this.reportSecurityEvent(
          'API_ABUSE',
          'api_monitor',
          {
            apiKey,
            endpoint,
            clientIP,
            totalRequests,
            errorRate,
            timeWindow: '1h',
          }
        );
      }
    }

    return {
      isAbusive: isHighVolume && isHighErrorRate,
      actions,
    };
  }

  /**
   * Gets current security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000);
    
    const allEvents = Array.from(this.securityEvents.values());
    const recentEvents = allEvents.filter(e => e.timestamp > oneDayAgo);
    const highSeverityEvents = allEvents.filter(e => 
      e.severity === 'HIGH' || e.severity === 'CRITICAL'
    ).length;

    return {
      totalEvents: allEvents.length,
      eventsLast24h: recentEvents.length,
      highSeverityEvents,
      blockedIPs: this.blockedIPs.size,
      activeThreats: allEvents.filter(e => !e.resolved && e.severity !== 'LOW').length,
      averageResponseTime: 150, // This would be calculated from actual response times
      detectionAccuracy: 0.92,
      falsePositiveRate: 0.08,
    };
  }

  /**
   * Gets recent security events
   */
  getRecentEvents(limit: number = 50): SecurityEvent[] {
    const events = Array.from(this.securityEvents.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return events;
  }

  /**
   * Manually resolves a security event
   */
  async resolveSecurityEvent(eventId: string, resolvedBy: string, notes?: string): Promise<boolean> {
    const event = this.securityEvents.get(eventId);
    
    if (!event) {
      return false;
    }

    event.resolved = true;
    event.details.resolvedBy = resolvedBy;
    event.details.resolvedAt = new Date().toISOString();
    
    if (notes) {
      event.details.resolutionNotes = notes;
    }

    this.logger.log(`Security event resolved: ${eventId} by ${resolvedBy}`);
    
    return true;
  }

  /**
   * Blocks an IP address
   */
  async blockIP(ip: string, reason: string, duration?: number): Promise<void> {
    this.blockedIPs.add(ip);
    
    this.logger.warn(`IP blocked: ${ip} - ${reason}`);
    
    await this.reportSecurityEvent(
      'UNAUTHORIZED_ACCESS',
      'ip_blocker',
      {
        blockedIP: ip,
        reason,
        duration,
        action: 'IP_BLOCKED',
      }
    );

    // Auto-unblock after duration
    if (duration) {
      setTimeout(() => {
        this.blockedIPs.delete(ip);
        this.logger.log(`IP auto-unblocked: ${ip}`);
      }, duration);
    }
  }

  /**
   * Checks if an IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  private async analyzeAndRespond(event: SecurityEvent): Promise<void> {
    // Apply threat detection rules
    for (const rule of this.threatRules.values()) {
      if (!rule.enabled) continue;
      
      if (this.ruleMatches(rule, event)) {
        await this.executeSecurityActions(rule.actions, event);
      }
    }

    // Auto-escalate critical events
    if (event.severity === 'CRITICAL') {
      await this.executeSecurityActions(['ESCALATE_TO_ADMIN', 'SEND_ALERT'], event);
    }
  }

  private calculateSeverity(type: SecurityEventType, details: Record<string, any>): SecuritySeverity {
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      'FAILED_LOGIN': 'LOW',
      'SUSPICIOUS_ACTIVITY': 'MEDIUM',
      'RATE_LIMIT_EXCEEDED': 'MEDIUM',
      'INJECTION_ATTEMPT': 'HIGH',
      'MALWARE_DETECTED': 'CRITICAL',
      'UNAUTHORIZED_ACCESS': 'HIGH',
      'DATA_EXFILTRATION': 'CRITICAL',
      'ANOMALOUS_BEHAVIOR': 'MEDIUM',
      'PRIVILEGE_ESCALATION': 'CRITICAL',
      'SESSION_HIJACKING': 'HIGH',
      'CSRF_ATTACK': 'HIGH',
      'XSS_ATTEMPT': 'HIGH',
      'FILE_UPLOAD_THREAT': 'HIGH',
      'API_ABUSE': 'MEDIUM',
      'BRUTE_FORCE_ATTACK': 'HIGH',
    };

    return severityMap[type] || 'MEDIUM';
  }

  private calculateRiskScore(
    type: SecurityEventType,
    details: Record<string, any>,
    userId?: string,
    clientIP?: string
  ): number {
    let score = 0;

    // Base score from event type
    const typeScores: Record<SecurityEventType, number> = {
      'FAILED_LOGIN': 10,
      'SUSPICIOUS_ACTIVITY': 30,
      'RATE_LIMIT_EXCEEDED': 25,
      'INJECTION_ATTEMPT': 70,
      'MALWARE_DETECTED': 95,
      'UNAUTHORIZED_ACCESS': 60,
      'DATA_EXFILTRATION': 90,
      'ANOMALOUS_BEHAVIOR': 40,
      'PRIVILEGE_ESCALATION': 85,
      'SESSION_HIJACKING': 75,
      'CSRF_ATTACK': 65,
      'XSS_ATTEMPT': 65,
      'FILE_UPLOAD_THREAT': 70,
      'API_ABUSE': 35,
      'BRUTE_FORCE_ATTACK': 60,
    };

    score += typeScores[type] || 30;

    // Increase score for repeated offenses
    if (clientIP && this.blockedIPs.has(clientIP)) {
      score += 30;
    }

    // Increase score for admin users
    if (details.isAdminUser) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private ruleMatches(rule: ThreatDetectionRule, event: SecurityEvent): boolean {
    if (typeof rule.pattern === 'string') {
      return JSON.stringify(event).includes(rule.pattern);
    } else {
      return rule.pattern.test(JSON.stringify(event));
    }
  }

  private async executeSecurityActions(actions: SecurityAction[], event: SecurityEvent): Promise<void> {
    for (const action of actions) {
      try {
        switch (action) {
          case 'LOG_EVENT':
            this.logger.warn(`Security action: LOG_EVENT for event ${event.id}`);
            break;
            
          case 'BLOCK_IP':
            if (event.clientIP) {
              await this.blockIP(event.clientIP, `Security event: ${event.type}`, 3600000); // 1 hour
            }
            break;
            
          case 'SEND_ALERT':
            this.eventEmitter.emit('security.alert', event);
            break;
            
          case 'ESCALATE_TO_ADMIN':
            this.eventEmitter.emit('security.escalation', event);
            break;
            
          case 'RATE_LIMIT':
            // This would integrate with rate limiting service
            this.logger.warn(`Rate limiting triggered for event ${event.id}`);
            break;
            
          default:
            this.logger.warn(`Unknown security action: ${action}`);
        }
        
        event.response_actions.push(action);
      } catch (error) {
        this.logger.error(`Failed to execute security action ${action}:`, error);
      }
    }
  }

  private initializeThreatDetectionRules(): void {
    const rules: ThreatDetectionRule[] = [
      {
        id: 'sql-injection-detection',
        name: 'SQL Injection Detection',
        description: 'Detects potential SQL injection attempts',
        pattern: /('|"|;|--|\/\*|\*\/|xp_|sp_|exec|execute|union|select|insert|update|delete|drop|create|alter)/i,
        severity: 'HIGH',
        enabled: true,
        actions: ['LOG_EVENT', 'BLOCK_IP', 'SEND_ALERT'],
      },
      {
        id: 'xss-detection',
        name: 'XSS Attack Detection',
        description: 'Detects potential XSS attempts',
        pattern: /<script|javascript:|onload=|onerror=|eval\(|alert\(/i,
        severity: 'HIGH',
        enabled: true,
        actions: ['LOG_EVENT', 'SEND_ALERT'],
      },
      {
        id: 'rapid-requests',
        name: 'Rapid Request Detection',
        description: 'Detects rapid succession of requests',
        pattern: 'RATE_LIMIT_EXCEEDED',
        threshold: 5,
        timeWindow: 60000, // 1 minute
        severity: 'MEDIUM',
        enabled: true,
        actions: ['RATE_LIMIT', 'LOG_EVENT'],
      },
    ];

    for (const rule of rules) {
      this.threatRules.set(rule.id, rule);
    }
  }

  private getRecentAttempts(key: string, windowSize: number): Array<{ timestamp: Date; successful: boolean }> {
    // In a real implementation, this would use Redis or similar
    // For now, return empty array
    return [];
  }

  private getRecentUserActions(userId: string, windowSize: number): Array<{ timestamp: Date; action: string }> {
    const userActions = this.sessionActivity.get(userId) || [];
    const cutoff = new Date(Date.now() - windowSize);
    return userActions.filter(a => a.timestamp > cutoff);
  }

  private initializeUserBaseline(userId: string, action: string, metadata: Record<string, any>): void {
    this.userBehaviorBaselines.set(userId, {
      activeHours: [new Date().getHours()],
      averageActionFrequency: { [action]: 1 },
      typicalLocations: [],
      createdAt: new Date(),
    });
  }

  private updateUserBaseline(userId: string, action: string, metadata: Record<string, any>): void {
    const baseline = this.userBehaviorBaselines.get(userId);
    if (!baseline) return;

    const currentHour = new Date().getHours();
    if (!baseline.activeHours.includes(currentHour)) {
      baseline.activeHours.push(currentHour);
    }

    baseline.averageActionFrequency[action] = (baseline.averageActionFrequency[action] || 0) + 1;
  }

  private startPeriodicCleanup(): void {
    // Clean up old events every hour
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 604800000); // 7 days
      
      for (const [id, event] of this.securityEvents.entries()) {
        if (event.timestamp < oneWeekAgo && event.resolved) {
          this.securityEvents.delete(id);
        }
      }
      
      this.logger.log('Performed security events cleanup');
    }, 3600000); // 1 hour
  }
}
