/**
 * @fileoverview Advanced Security Type Definitions
 * @description Enterprise-grade security types for authentication, authorization,
 * guards, threat detection, and security monitoring
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { EnhancedUser } from './enhanced-entities.types';
import type { AuthenticationState, UserSession } from './advanced-services.types';

// =============================================================================
// ROUTE GUARDS AND NAVIGATION SECURITY
// =============================================================================

/**
 * Route Guard Types
 */
export type RouteGuardType = 
  | 'auth' 
  | 'guest' 
  | 'role' 
  | 'permission' 
  | 'subscription' 
  | 'maintenance' 
  | 'security' 
  | 'rate_limit' 
  | 'geo_restriction';

/**
 * Route Guard Result
 */
export interface RouteGuardResult {
  /** Guard execution result */
  allowed: boolean;
  /** Redirection path if access denied */
  redirectTo?: string;
  /** Reason for denial */
  reason?: string;
  /** Error details */
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  /** Required actions to gain access */
  requiredActions?: Array<{
    type: 'login' | 'verify_email' | 'upgrade_subscription' | 'accept_terms' | 'complete_profile';
    description: string;
    url?: string;
  }>;
  /** Temporary access information */
  temporaryAccess?: {
    granted: boolean;
    expiresAt: Date;
    limitations: string[];
  };
}

/**
 * Route Guard Context
 */
export interface RouteGuardContext {
  /** Target route information */
  route: {
    path: string;
    name?: string;
    params: Record<string, string>;
    query: Record<string, string>;
    meta?: Record<string, any>;
  };
  /** Current user information */
  user?: EnhancedUser | null;
  /** Current session information */
  session?: UserSession | null;
  /** Authentication state */
  authState: AuthenticationState;
  /** Request metadata */
  request: {
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    deviceId?: string;
  };
  /** Additional context data */
  context?: Record<string, any>;
}

/**
 * Route Guard Configuration
 */
export interface RouteGuardConfig {
  /** Guard type */
  type: RouteGuardType;
  /** Guard priority (higher = executed first) */
  priority: number;
  /** Required roles for role-based guards */
  requiredRoles?: string[];
  /** Required permissions for permission-based guards */
  requiredPermissions?: string[];
  /** Required subscription level */
  requiredSubscription?: string;
  /** Allow temporary access */
  allowTemporaryAccess?: boolean;
  /** Rate limiting configuration */
  rateLimit?: {
    maxAttempts: number;
    windowMs: number;
    blockDurationMs: number;
  };
  /** Geo-restriction configuration */
  geoRestriction?: {
    allowedCountries?: string[];
    blockedCountries?: string[];
    allowedRegions?: string[];
    blockedRegions?: string[];
  };
  /** Custom validation function */
  customValidator?: (context: RouteGuardContext) => Promise<RouteGuardResult>;
  /** Error handling configuration */
  errorHandling?: {
    showNotification: boolean;
    logEvent: boolean;
    redirectOnError: boolean;
  };
}

/**
 * Route Guard Interface
 */
export interface RouteGuardInterface {
  /** Guard configuration */
  readonly config: RouteGuardConfig;
  /** Guard name for identification */
  readonly name: string;
  /** Guard type */
  readonly type: RouteGuardType;

  /** Execute guard validation */
  canActivate(context: RouteGuardContext): Promise<RouteGuardResult>;
  /** Check if guard applies to route */
  appliesTo(route: RouteGuardContext['route']): boolean;
  /** Get guard priority */
  getPriority(): number;
}

// =============================================================================
// AUTHENTICATION AND AUTHORIZATION
// =============================================================================

/**
 * Permission Structure
 */
export interface Permission {
  /** Unique permission identifier */
  id: string;
  /** Permission name */
  name: string;
  /** Permission description */
  description: string;
  /** Permission category */
  category: string;
  /** Resource this permission applies to */
  resource: string;
  /** Actions allowed by this permission */
  actions: string[];
  /** Permission scope */
  scope: 'global' | 'organization' | 'team' | 'project' | 'resource';
  /** Permission conditions */
  conditions?: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than';
    value: any;
  }>;
  /** Permission metadata */
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
  };
}

/**
 * Role Structure
 */
export interface Role {
  /** Unique role identifier */
  id: string;
  /** Role name */
  name: string;
  /** Role description */
  description: string;
  /** Role level (higher = more permissions) */
  level: number;
  /** Permissions granted by this role */
  permissions: Permission[];
  /** Role inheritance hierarchy */
  inherits?: string[];
  /** Role scope */
  scope: 'global' | 'organization' | 'team' | 'project';
  /** Role constraints */
  constraints?: {
    /** Maximum number of users with this role */
    maxUsers?: number;
    /** Role expiration */
    expiresAt?: Date;
    /** Geographic restrictions */
    geoRestrictions?: string[];
    /** Time-based restrictions */
    timeRestrictions?: Array<{
      days: number[];
      startTime: string;
      endTime: string;
      timezone: string;
    }>;
  };
  /** Role metadata */
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
    tags: string[];
  };
}

/**
 * Access Control List Entry
 */
export interface ACLEntry {
  /** Subject (user, role, or group) */
  subject: {
    type: 'user' | 'role' | 'group';
    id: string;
  };
  /** Resource being protected */
  resource: {
    type: string;
    id: string;
    attributes?: Record<string, any>;
  };
  /** Granted permissions */
  permissions: string[];
  /** Access conditions */
  conditions?: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  /** Entry expiration */
  expiresAt?: Date;
  /** Entry metadata */
  metadata?: {
    grantedBy: string;
    grantedAt: Date;
    reason: string;
  };
}

/**
 * Access Control Decision
 */
export interface AccessControlDecision {
  /** Access granted or denied */
  granted: boolean;
  /** Decision reason */
  reason: string;
  /** Applied permissions */
  permissions: string[];
  /** Decision conditions */
  conditions?: Record<string, any>;
  /** Decision metadata */
  metadata: {
    decisionTime: Date;
    evaluatedRules: number;
    decisionPath: string[];
    riskScore?: number;
  };
}

/**
 * Authorization Context
 */
export interface AuthorizationContext {
  /** Subject requesting access */
  subject: {
    user: EnhancedUser;
    session: UserSession;
    roles: Role[];
    permissions: Permission[];
  };
  /** Resource being accessed */
  resource: {
    type: string;
    id: string;
    attributes: Record<string, any>;
    owner?: string;
  };
  /** Action being performed */
  action: string;
  /** Request context */
  request: {
    timestamp: Date;
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    method?: string;
    url?: string;
  };
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Authorization Service Interface
 */
export interface AuthorizationServiceInterface {
  /** Check if user has permission */
  hasPermission(
    userId: string, 
    resource: string, 
    action: string, 
    context?: Record<string, any>
  ): Promise<boolean>;

  /** Make access control decision */
  authorize(context: AuthorizationContext): Promise<AccessControlDecision>;

  /** Get user roles */
  getUserRoles(userId: string): Promise<Role[]>;

  /** Get user permissions */
  getUserPermissions(userId: string): Promise<Permission[]>;

  /** Grant role to user */
  grantRole(userId: string, roleId: string, expiresAt?: Date): Promise<void>;

  /** Revoke role from user */
  revokeRole(userId: string, roleId: string): Promise<void>;

  /** Grant permission to user */
  grantPermission(userId: string, permissionId: string, expiresAt?: Date): Promise<void>;

  /** Revoke permission from user */
  revokePermission(userId: string, permissionId: string): Promise<void>;

  /** Check role hierarchy */
  hasRole(userId: string, roleId: string): Promise<boolean>;

  /** Get effective permissions (combined from roles and direct grants) */
  getEffectivePermissions(userId: string): Promise<Permission[]>;
}

// =============================================================================
// SECURITY MONITORING AND THREAT DETECTION
// =============================================================================

/**
 * Security Threat Level
 */
export type SecurityThreatLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security Event Type
 */
export type SecurityEventType = 
  | 'login_attempt' 
  | 'login_failure' 
  | 'brute_force' 
  | 'account_lockout' 
  | 'privilege_escalation' 
  | 'suspicious_activity' 
  | 'data_access' 
  | 'data_modification' 
  | 'security_violation' 
  | 'malware_detected' 
  | 'injection_attempt' 
  | 'rate_limit_violation'
  | 'geo_anomaly'
  | 'device_anomaly'
  | 'time_anomaly'
  | 'behavioral_anomaly';

/**
 * Security Event
 */
export interface SecurityEvent {
  /** Unique event identifier */
  id: string;
  /** Event type */
  type: SecurityEventType;
  /** Threat level */
  threatLevel: SecurityThreatLevel;
  /** Event title */
  title: string;
  /** Event description */
  description: string;
  /** Event timestamp */
  timestamp: Date;
  /** User involved in the event */
  user?: {
    id: string;
    username: string;
    email: string;
  };
  /** Request information */
  request?: {
    ipAddress: string;
    userAgent: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  /** Event source */
  source: {
    component: string;
    location: string;
    version: string;
  };
  /** Event context and metadata */
  context: {
    sessionId?: string;
    deviceId?: string;
    location?: string;
    riskScore: number;
    anomalyScore?: number;
    triggeredRules: string[];
    additionalData: Record<string, any>;
  };
  /** Event status */
  status: 'open' | 'investigating' | 'resolved' | 'false_positive' | 'ignored';
  /** Response actions taken */
  actions?: Array<{
    type: 'block_ip' | 'lock_account' | 'require_mfa' | 'log_event' | 'notify_admin' | 'quarantine';
    timestamp: Date;
    details: Record<string, any>;
  }>;
  /** Event correlation */
  correlation?: {
    relatedEvents: string[];
    incidentId?: string;
    attackPattern?: string;
  };
}

/**
 * Security Rule
 */
export interface SecurityRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule category */
  category: string;
  /** Rule priority */
  priority: number;
  /** Rule enabled status */
  enabled: boolean;
  /** Rule conditions */
  conditions: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'greater_than' | 'less_than' | 'in_range';
    value: any;
    weight: number;
  }>;
  /** Rule threshold */
  threshold: {
    score: number;
    timeWindow: number;
    occurrenceCount: number;
  };
  /** Rule actions */
  actions: Array<{
    type: string;
    configuration: Record<string, any>;
  }>;
  /** Rule metadata */
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
    tags: string[];
  };
}

/**
 * Risk Assessment
 */
export interface RiskAssessment {
  /** Overall risk score (0-100) */
  score: number;
  /** Risk level */
  level: 'low' | 'medium' | 'high' | 'critical';
  /** Risk factors */
  factors: Array<{
    name: string;
    score: number;
    weight: number;
    description: string;
  }>;
  /** Assessment timestamp */
  timestamp: Date;
  /** Assessment validity period */
  validUntil: Date;
  /** Confidence level */
  confidence: number;
  /** Recommendations */
  recommendations: Array<{
    action: string;
    priority: 'low' | 'medium' | 'high';
    description: string;
    estimatedImpact: number;
  }>;
}

/**
 * Security Metrics
 */
export interface SecurityMetrics {
  /** Metrics time period */
  period: {
    start: Date;
    end: Date;
  };
  /** Authentication metrics */
  authentication: {
    totalAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    blockedAttempts: number;
    averageRiskScore: number;
  };
  /** Threat detection metrics */
  threats: {
    totalEvents: number;
    eventsByLevel: Record<SecurityThreatLevel, number>;
    eventsByType: Record<SecurityEventType, number>;
    resolvedThreats: number;
    falsePositives: number;
  };
  /** Access control metrics */
  access: {
    authorizationChecks: number;
    accessDenials: number;
    privilegeEscalations: number;
    permissionChanges: number;
  };
  /** Performance metrics */
  performance: {
    averageResponseTime: number;
    securityRuleEvaluations: number;
    riskAssessments: number;
  };
}

/**
 * Security Monitor Interface
 */
export interface SecurityMonitorInterface {
  /** Record security event */
  recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<SecurityEvent>;

  /** Get security events */
  getEvents(filter?: {
    startDate?: Date;
    endDate?: Date;
    types?: SecurityEventType[];
    threatLevels?: SecurityThreatLevel[];
    userId?: string;
    status?: SecurityEvent['status'];
    limit?: number;
  }): Promise<SecurityEvent[]>;

  /** Assess risk for user/session */
  assessRisk(context: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    action?: string;
    resource?: string;
  }): Promise<RiskAssessment>;

  /** Get security metrics */
  getMetrics(period: { start: Date; end: Date }): Promise<SecurityMetrics>;

  /** Add security rule */
  addRule(rule: Omit<SecurityRule, 'id' | 'metadata'>): Promise<SecurityRule>;

  /** Update security rule */
  updateRule(ruleId: string, updates: Partial<SecurityRule>): Promise<SecurityRule>;

  /** Delete security rule */
  deleteRule(ruleId: string): Promise<void>;

  /** Get security rules */
  getRules(): Promise<SecurityRule[]>;

  /** Evaluate security rules for context */
  evaluateRules(context: Record<string, any>): Promise<{
    triggeredRules: SecurityRule[];
    totalScore: number;
    recommendedActions: string[];
  }>;
}

// =============================================================================
// ENCRYPTION AND DATA PROTECTION
// =============================================================================

/**
 * Encryption Algorithm
 */
export type EncryptionAlgorithm = 'AES-256-GCM' | 'AES-128-GCM' | 'ChaCha20-Poly1305' | 'RSA-OAEP';

/**
 * Encryption Key
 */
export interface EncryptionKey {
  /** Key identifier */
  id: string;
  /** Key algorithm */
  algorithm: EncryptionAlgorithm;
  /** Key size in bits */
  keySize: number;
  /** Key usage purposes */
  usage: ('encrypt' | 'decrypt' | 'sign' | 'verify')[];
  /** Key creation timestamp */
  createdAt: Date;
  /** Key expiration timestamp */
  expiresAt?: Date;
  /** Key status */
  status: 'active' | 'inactive' | 'revoked' | 'expired';
  /** Key metadata */
  metadata?: {
    version: number;
    rotationCount: number;
    lastUsed?: Date;
  };
}

/**
 * Encrypted Data
 */
export interface EncryptedData {
  /** Encrypted content */
  data: string;
  /** Encryption algorithm used */
  algorithm: EncryptionAlgorithm;
  /** Key identifier used */
  keyId: string;
  /** Initialization vector */
  iv: string;
  /** Authentication tag */
  tag?: string;
  /** Encryption timestamp */
  encryptedAt: Date;
}

/**
 * Encryption Service Interface
 */
export interface EncryptionServiceInterface {
  /** Encrypt data */
  encrypt(data: string, keyId?: string): Promise<EncryptedData>;

  /** Decrypt data */
  decrypt(encryptedData: EncryptedData): Promise<string>;

  /** Generate encryption key */
  generateKey(algorithm: EncryptionAlgorithm, usage: EncryptionKey['usage']): Promise<EncryptionKey>;

  /** Rotate encryption key */
  rotateKey(keyId: string): Promise<EncryptionKey>;

  /** Get encryption key */
  getKey(keyId: string): Promise<EncryptionKey>;

  /** Revoke encryption key */
  revokeKey(keyId: string): Promise<void>;

  /** Hash data (one-way) */
  hash(data: string, algorithm?: 'SHA-256' | 'SHA-512' | 'bcrypt' | 'argon2'): Promise<string>;

  /** Verify hash */
  verifyHash(data: string, hash: string): Promise<boolean>;
}

// =============================================================================
// SECURITY CONFIGURATION
// =============================================================================

/**
 * Security Configuration
 */
export interface SecurityConfig {
  /** Authentication configuration */
  authentication: {
    /** Enable multi-factor authentication */
    mfaRequired: boolean;
    /** Password policy */
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
      forbidCommonPasswords: boolean;
      maxAge: number; // days
    };
    /** Session configuration */
    session: {
      timeout: number; // minutes
      maxConcurrentSessions: number;
      requireReauthentication: string[]; // actions requiring re-auth
    };
    /** Account lockout policy */
    lockout: {
      maxFailedAttempts: number;
      lockoutDuration: number; // minutes
      progressiveLockout: boolean;
    };
  };
  /** Authorization configuration */
  authorization: {
    /** Default access policy */
    defaultPolicy: 'deny' | 'allow';
    /** Permission caching TTL */
    cacheTtl: number; // seconds
    /** Enable role inheritance */
    roleInheritance: boolean;
  };
  /** Monitoring configuration */
  monitoring: {
    /** Enable security event logging */
    eventLogging: boolean;
    /** Event retention period */
    eventRetention: number; // days
    /** Real-time threat detection */
    realTimeDetection: boolean;
    /** Risk assessment frequency */
    riskAssessmentInterval: number; // minutes
  };
  /** Encryption configuration */
  encryption: {
    /** Default encryption algorithm */
    defaultAlgorithm: EncryptionAlgorithm;
    /** Key rotation interval */
    keyRotationInterval: number; // days
    /** Enable data encryption at rest */
    encryptAtRest: boolean;
    /** Enable data encryption in transit */
    encryptInTransit: boolean;
  };
  /** Network security */
  network: {
    /** Allowed IP ranges */
    allowedIpRanges: string[];
    /** Blocked IP ranges */
    blockedIpRanges: string[];
    /** Enable geo-blocking */
    geoBlocking: boolean;
    /** Rate limiting */
    rateLimit: {
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests: boolean;
    };
  };
  /** Content security */
  contentSecurity: {
    /** Content Security Policy */
    csp: string;
    /** Enable XSS protection */
    xssProtection: boolean;
    /** Enable content type sniffing protection */
    noSniff: boolean;
    /** Enable clickjacking protection */
    frameOptions: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  };
}
