import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, MongoClientOptions } from 'mongodb';
import * as crypto from 'crypto';

export interface DatabaseSecurityConfig {
  enableTLS: boolean;
  tlsCertificatePath?: string;
  enableAuditLogging: boolean;
  enableQueryLogging: boolean;
  maxConnectionPoolSize: number;
  connectionTimeout: number;
  enableIPWhitelist: boolean;
  allowedIPs?: string[];
  enableQueryValidation: boolean;
  enableAccessLogging: boolean;
}

export interface DatabaseSecurityValidation {
  isSecure: boolean;
  violations: string[];
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface QuerySecurityResult {
  isValid: boolean;
  sanitizedQuery?: any;
  violations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ConnectionSecurityInfo {
  isSecure: boolean;
  tlsEnabled: boolean;
  authenticationMethod: string;
  connectionSource: string;
  timestamp: Date;
  userId?: string;
}

@Injectable()
export class DatabaseSecurityService {
  private readonly logger = new Logger(DatabaseSecurityService.name);
  private readonly securityConfig: DatabaseSecurityConfig;
  private readonly dangerousOperators: Set<string>;
  private readonly allowedCollections: Set<string>;
  private readonly suspiciousPatterns: RegExp[];

  constructor(private configService: ConfigService) {
    this.securityConfig = {
      enableTLS: this.configService.get<boolean>('database.security.enableTLS', true),
      tlsCertificatePath: this.configService.get<string>('database.security.tlsCertificatePath'),
      enableAuditLogging: this.configService.get<boolean>('database.security.enableAuditLogging', true),
      enableQueryLogging: this.configService.get<boolean>('database.security.enableQueryLogging', true),
      maxConnectionPoolSize: this.configService.get<number>('database.security.maxConnectionPoolSize', 10),
      connectionTimeout: this.configService.get<number>('database.security.connectionTimeout', 30000),
      enableIPWhitelist: this.configService.get<boolean>('database.security.enableIPWhitelist', false),
      allowedIPs: this.configService.get<string[]>('database.security.allowedIPs', []),
      enableQueryValidation: this.configService.get<boolean>('database.security.enableQueryValidation', true),
      enableAccessLogging: this.configService.get<boolean>('database.security.enableAccessLogging', true),
    };

    // Dangerous MongoDB operators that should be restricted
    this.dangerousOperators = new Set([
      '$where',
      '$regex',
      '$expr',
      '$function',
      '$accumulator',
      '$jsonSchema'
    ]);

    // Allowed collections for the application
    this.allowedCollections = new Set([
      'users',
      'messages',
      'rooms',
      'attachments',
      'sessions',
      'audit_logs'
    ]);

    // Patterns that indicate potential injection attempts
    this.suspiciousPatterns = [
      /javascript:/i,
      /eval\s*\(/i,
      /function\s*\(/i,
      /constructor/i,
      /prototype/i,
      /__proto__/i,
      /\$ne\s*:\s*null/i,
      /\$regex\s*:\s*\.\*/i,
    ];
  }

  /**
   * Validates database security configuration
   */
  async validateDatabaseSecurity(): Promise<DatabaseSecurityValidation> {
    const violations: string[] = [];
    const recommendations: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    try {
      // Check TLS configuration
      if (!this.securityConfig.enableTLS) {
        violations.push('TLS/SSL encryption is disabled for database connections');
        riskLevel = 'HIGH';
        recommendations.push('Enable TLS encryption for all database connections');
      }

      // Check audit logging
      if (!this.securityConfig.enableAuditLogging) {
        violations.push('Database audit logging is disabled');
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        recommendations.push('Enable comprehensive audit logging for security compliance');
      }

      // Check connection pool size
      if (this.securityConfig.maxConnectionPoolSize > 50) {
        violations.push(`Connection pool size (${this.securityConfig.maxConnectionPoolSize}) is too large`);
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
        recommendations.push('Limit connection pool size to prevent resource exhaustion');
      }

      // Check IP whitelist in production
      const environment = this.configService.get<string>('NODE_ENV');
      if (environment === 'production' && !this.securityConfig.enableIPWhitelist) {
        violations.push('IP whitelist is disabled in production environment');
        riskLevel = 'HIGH';
        recommendations.push('Enable IP whitelist for production database access');
      }

      // Check query validation
      if (!this.securityConfig.enableQueryValidation) {
        violations.push('Query validation is disabled');
        riskLevel = 'CRITICAL';
        recommendations.push('Enable query validation to prevent injection attacks');
      }

      // Test database connection security
      const connectionSecurity = await this.testConnectionSecurity();
      if (!connectionSecurity.isSecure) {
        violations.push('Database connection security test failed');
        riskLevel = 'CRITICAL';
        recommendations.push('Review and fix database connection security configuration');
      }

      return {
        isSecure: violations.length === 0,
        violations,
        recommendations,
        riskLevel,
      };
    } catch (error) {
      this.logger.error('Database security validation failed:', error);
      return {
        isSecure: false,
        violations: [`Security validation failed: ${error.message}`],
        recommendations: ['Review database security configuration and connection'],
        riskLevel: 'CRITICAL',
      };
    }
  }

  /**
   * Validates and sanitizes MongoDB queries for security
   */
  validateQuery(query: any, collection?: string): QuerySecurityResult {
    const violations: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    try {
      // Validate collection access
      if (collection && !this.allowedCollections.has(collection)) {
        violations.push(`Access to collection '${collection}' is not allowed`);
        riskLevel = 'HIGH';
      }

      // Check for dangerous operators
      const dangerousOps = this.findDangerousOperators(query);
      if (dangerousOps.length > 0) {
        violations.push(`Dangerous operators detected: ${dangerousOps.join(', ')}`);
        riskLevel = 'CRITICAL';
      }

      // Check for suspicious patterns
      const queryString = JSON.stringify(query);
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(queryString)) {
          violations.push(`Suspicious pattern detected: ${pattern.source}`);
          if (riskLevel !== 'CRITICAL') riskLevel = 'HIGH';
        }
      }      // Validate query structure
      const structureValidation = this.validateQueryStructure(query);
      if (!structureValidation.isValid) {
        violations.push(...structureValidation.violations);
        if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      }

      // Sanitize query if valid
      const sanitizedQuery = violations.length === 0 ? this.sanitizeQuery(query) : undefined;

      return {
        isValid: violations.length === 0,
        sanitizedQuery,
        violations,
        riskLevel,
      };
    } catch (error) {
      this.logger.error('Query validation failed:', error);
      return {
        isValid: false,
        violations: [`Query validation error: ${error.message}`],
        riskLevel: 'HIGH',
      };
    }
  }

  /**
   * Logs database access for security monitoring
   */
  async logDatabaseAccess(
    operation: string,
    collection: string,
    query: any,
    userId?: string,
    clientIP?: string
  ): Promise<void> {
    if (!this.securityConfig.enableAccessLogging) {
      return;
    }

    try {
      const accessLog = {
        timestamp: new Date().toISOString(),
        operation,
        collection,
        query: this.sanitizeQueryForLogging(query),
        userId: userId || 'anonymous',
        clientIP: clientIP || 'unknown',
        queryHash: this.generateQueryHash(query),
        sessionId: this.generateSessionId(),
      };

      this.logger.log(`Database access: ${JSON.stringify(accessLog)}`);

      // In a real implementation, you might want to store this in a separate audit collection
      // await this.auditCollection.insertOne(accessLog);
    } catch (error) {
      this.logger.error('Failed to log database access:', error);
    }
  }

  /**
   * Monitors for anomalous database activity
   */
  async detectAnomalousActivity(
    operation: string,
    collection: string,
    userId?: string
  ): Promise<{ isAnomalous: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    try {
      // Check for unusual operation patterns
      if (operation === 'deleteMany' || operation === 'updateMany') {
        reasons.push(`Potentially dangerous bulk operation: ${operation}`);
      }

      // Check for access to sensitive collections
      const sensitiveCollections = ['users', 'sessions', 'audit_logs'];
      if (sensitiveCollections.includes(collection)) {
        reasons.push(`Access to sensitive collection: ${collection}`);
      }

      // Check for anonymous access to protected resources
      if (!userId && collection !== 'public') {
        reasons.push('Anonymous access to protected collection');
      }

      // Additional anomaly detection logic could include:
      // - Unusual time-based access patterns
      // - High-volume queries from single user
      // - Geographic anomalies
      // - Failed authentication attempts

      return {
        isAnomalous: reasons.length > 0,
        reasons,
      };
    } catch (error) {
      this.logger.error('Anomaly detection failed:', error);
      return {
        isAnomalous: true,
        reasons: ['Anomaly detection system error'],
      };
    }
  }

  /**
   * Generates secure connection options for MongoDB
   */
  getSecureConnectionOptions(): MongoClientOptions {
    const options: MongoClientOptions = {
      maxPoolSize: this.securityConfig.maxConnectionPoolSize,
      serverSelectionTimeoutMS: this.securityConfig.connectionTimeout,
      socketTimeoutMS: this.securityConfig.connectionTimeout,
      minPoolSize: 2,
      maxIdleTimeMS: 300000, // 5 minutes
      waitQueueTimeoutMS: 30000,
      retryWrites: true,
      retryReads: true,
    };

    // Enable TLS if configured
    if (this.securityConfig.enableTLS) {
      options.tls = true;
      options.tlsInsecure = false; // Require valid certificates
      
      if (this.securityConfig.tlsCertificatePath) {
        options.tlsCertificateKeyFile = this.securityConfig.tlsCertificatePath;
      }
    }

    // Add authentication options
    options.authSource = 'admin';
    options.authMechanism = 'SCRAM-SHA-256';

    return options;
  }

  private async testConnectionSecurity(): Promise<ConnectionSecurityInfo> {
    try {
      // This would be implemented to test actual connection security
      // For now, return a basic security check
      return {
        isSecure: this.securityConfig.enableTLS,
        tlsEnabled: this.securityConfig.enableTLS,
        authenticationMethod: 'SCRAM-SHA-256',
        connectionSource: 'application',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Connection security test failed:', error);
      return {
        isSecure: false,
        tlsEnabled: false,
        authenticationMethod: 'unknown',
        connectionSource: 'unknown',
        timestamp: new Date(),
      };
    }
  }

  private findDangerousOperators(obj: any, path: string = ''): string[] {
    const dangerous: string[] = [];

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (this.dangerousOperators.has(key)) {
          dangerous.push(currentPath);
        }
        
        if (typeof value === 'object') {
          dangerous.push(...this.findDangerousOperators(value, currentPath));
        }
      }
    }

    return dangerous;
  }

  private validateQueryStructure(query: any): { isValid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check query depth to prevent deeply nested injection attacks
    const maxDepth = 10;
    const depth = this.calculateObjectDepth(query);
    if (depth > maxDepth) {
      violations.push(`Query depth (${depth}) exceeds maximum allowed (${maxDepth})`);
    }

    // Check for prototype pollution attempts
    if (this.hasPrototypePollution(query)) {
      violations.push('Prototype pollution attempt detected');
    }

    // Validate field names
    const invalidFields = this.findInvalidFieldNames(query);
    if (invalidFields.length > 0) {
      violations.push(`Invalid field names detected: ${invalidFields.join(', ')}`);
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }

  private calculateObjectDepth(obj: any, currentDepth: number = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const value of Object.values(obj)) {
      const depth = this.calculateObjectDepth(value, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private hasPrototypePollution(obj: any): boolean {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const dangerousKeys = ['__proto__', 'prototype', 'constructor'];
    
    for (const key of Object.keys(obj)) {
      if (dangerousKeys.includes(key)) {
        return true;
      }
      
      if (typeof obj[key] === 'object' && this.hasPrototypePollution(obj[key])) {
        return true;
      }
    }

    return false;
  }

  private findInvalidFieldNames(obj: any, path: string = ''): string[] {
    const invalid: string[] = [];
    
    if (typeof obj !== 'object' || obj === null) {
      return invalid;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check for invalid characters in field names
      if (/[<>\"']/.test(key)) {
        invalid.push(currentPath);
      }
      
      // Check for potential script injection in field names
      if (/script|javascript|eval|function/i.test(key)) {
        invalid.push(currentPath);
      }
      
      if (typeof value === 'object') {
        invalid.push(...this.findInvalidFieldNames(value, currentPath));
      }
    }

    return invalid;
  }

  private sanitizeQuery(query: any): any {
    // Deep clone to avoid mutation
    const sanitized = JSON.parse(JSON.stringify(query));
    
    // Remove any remaining dangerous operators
    this.removeDangerousOperators(sanitized);
    
    // Sanitize string values
    this.sanitizeStringValues(sanitized);
    
    return sanitized;
  }

  private removeDangerousOperators(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key of Object.keys(obj)) {
      if (this.dangerousOperators.has(key)) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        this.removeDangerousOperators(obj[key]);
      }
    }
  }

  private sanitizeStringValues(obj: any): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous content from strings
        obj[key] = value
          .replace(/javascript:/gi, '')
          .replace(/eval\s*\(/gi, '')
          .replace(/function\s*\(/gi, '')
          .replace(/<script/gi, '');
      } else if (typeof value === 'object') {
        this.sanitizeStringValues(value);
      }
    }
  }

  private sanitizeQueryForLogging(query: any): any {
    // Create a sanitized version for logging (remove sensitive data)
    const sanitized = JSON.parse(JSON.stringify(query));
    
    // Remove password fields
    this.removeSensitiveFields(sanitized, ['password', 'token', 'secret', 'key']);
    
    return sanitized;
  }

  private removeSensitiveFields(obj: any, sensitiveFields: string[]): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const field of sensitiveFields) {
      if (obj.hasOwnProperty(field)) {
        obj[field] = '[REDACTED]';
      }
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        this.removeSensitiveFields(value, sensitiveFields);
      }
    }
  }

  private generateQueryHash(query: any): string {
    const queryString = JSON.stringify(query, Object.keys(query).sort());
    return crypto.createHash('sha256').update(queryString).digest('hex').slice(0, 16);
  }

  private generateSessionId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Gets database security metrics for monitoring
   */
  async getSecurityMetrics(): Promise<{
    totalQueries: number;
    blockedQueries: number;
    suspiciousActivity: number;
    lastSecurityCheck: Date;
    riskLevel: string;
  }> {
    // In a real implementation, these metrics would be stored and tracked
    return {
      totalQueries: 0,
      blockedQueries: 0,
      suspiciousActivity: 0,
      lastSecurityCheck: new Date(),
      riskLevel: 'LOW',
    };
  }
  /**
   * Performs automated security health check
   */
  async performSecurityHealthCheck(): Promise<{
    overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    checks: Array<{ name: string; status: 'PASS' | 'FAIL'; details: string }>;
  }> {
    const checks: Array<{ name: string; status: 'PASS' | 'FAIL'; details: string }> = [];
    
    // Check TLS configuration
    checks.push({
      name: 'TLS Configuration',
      status: this.securityConfig.enableTLS ? 'PASS' : 'FAIL',
      details: this.securityConfig.enableTLS ? 'TLS enabled' : 'TLS disabled - security risk',
    });

    // Check audit logging
    checks.push({
      name: 'Audit Logging',
      status: this.securityConfig.enableAuditLogging ? 'PASS' : 'FAIL',
      details: this.securityConfig.enableAuditLogging ? 'Audit logging enabled' : 'Audit logging disabled',
    });

    // Check query validation
    checks.push({
      name: 'Query Validation',
      status: this.securityConfig.enableQueryValidation ? 'PASS' : 'FAIL',
      details: this.securityConfig.enableQueryValidation ? 'Query validation active' : 'Query validation disabled - injection risk',
    });

    const failedChecks = checks.filter(check => check.status === 'FAIL').length;
    let overall: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    
    if (failedChecks === 0) {
      overall = 'HEALTHY';
    } else if (failedChecks <= 1) {
      overall = 'WARNING';
    } else {
      overall = 'CRITICAL';
    }

    return { overall, checks };
  }
}
