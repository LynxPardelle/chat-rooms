/**
 * @fileoverview Advanced Services Type Definitions
 * @description Enterprise-grade type definitions for AuthService, SocketService, 
 * and other core services with comprehensive error handling and enterprise features
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { EnhancedUser } from './enhanced-entities.types';
import type { EnterpriseAppConfig } from './enterprise-config.types';
import type { WebSocketServiceInterface } from './websocket-enterprise.types';

// =============================================================================
// AUTHENTICATION SERVICE TYPES
// =============================================================================

/**
 * Authentication States
 */
export type AuthenticationState = 
  | 'unauthenticated' 
  | 'authenticating' 
  | 'authenticated' 
  | 'refreshing' 
  | 'expired' 
  | 'error' 
  | 'locked';

/**
 * Authentication Factors
 */
export type AuthenticationFactor = 'password' | 'totp' | 'sms' | 'email' | 'biometric' | 'hardware_key';

/**
 * JWT Token Structure
 */
export interface JWTTokens {
  /** Access token for API requests */
  accessToken: string;
  /** Refresh token for token renewal */
  refreshToken: string;
  /** Token expiration timestamps */
  expiresAt: {
    access: Date;
    refresh: Date;
  };
  /** Token metadata */
  metadata?: {
    issued: Date;
    issuer: string;
    scope: string[];
    tokenId: string;
  };
}

/**
 * Login Request Payload
 */
export interface LoginRequest {
  /** User credentials */
  email: string;
  password: string;
  /** Multi-factor authentication code */
  mfaCode?: string;
  /** Remember login session */
  rememberMe?: boolean;
  /** Device information for tracking */
  deviceInfo?: {
    fingerprint: string;
    userAgent: string;
    platform: string;
    location?: string;
  };
  /** Login context */
  context?: {
    source: 'web' | 'mobile' | 'desktop' | 'api';
    referrer?: string;
    campaignId?: string;
  };
}

/**
 * Registration Request Payload
 */
export interface RegisterRequest {
  /** Basic user information */
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  /** Agreement confirmations */
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingOptIn?: boolean;
  /** Registration context */
  inviteCode?: string;
  referralCode?: string;
  source?: string;
  /** Device information */
  deviceInfo?: LoginRequest['deviceInfo'];
}

/**
 * Password Reset Request
 */
export interface PasswordResetRequest {
  /** User email address */
  email: string;
  /** Reset context */
  context?: {
    source: string;
    userAgent: string;
    ipAddress?: string;
  };
}

/**
 * Password Change Request
 */
export interface PasswordChangeRequest {
  /** Current password for verification */
  currentPassword: string;
  /** New password */
  newPassword: string;
  /** Force logout from other devices */
  revokeOtherSessions?: boolean;
}

/**
 * Multi-Factor Authentication Setup
 */
export interface MFASetupRequest {
  /** MFA method type */
  method: AuthenticationFactor;
  /** Method-specific configuration */
  config: {
    /** For TOTP: secret key */
    secret?: string;
    /** For SMS/Email: contact information */
    contact?: string;
    /** For Hardware Key: device registration */
    deviceId?: string;
  };
  /** Verification code for setup confirmation */
  verificationCode: string;
}

/**
 * Session Information
 */
export interface UserSession {
  /** Unique session identifier */
  sessionId: string;
  /** User associated with session */
  user: EnhancedUser;
  /** JWT tokens */
  tokens: JWTTokens;
  /** Device information */
  device: {
    id: string;
    name: string;
    type: 'web' | 'mobile' | 'desktop' | 'tablet';
    os: string;
    browser?: string;
    location?: string;
    ipAddress?: string;
  };
  /** Session timestamps */
  timestamps: {
    created: Date;
    lastActivity: Date;
    lastLogin: Date;
    expiresAt: Date;
  };
  /** Session security */
  security: {
    mfaVerified: boolean;
    riskScore: number;
    trustLevel: 'low' | 'medium' | 'high';
    flags: string[];
  };
  /** Session permissions */
  permissions: {
    scope: string[];
    restrictions: string[];
    temporaryElevations: Array<{
      permission: string;
      expiresAt: Date;
      reason: string;
    }>;
  };
}

/**
 * Authentication Error Types
 */
export interface AuthenticationError {
  /** Error type classification */
  type: 'invalid_credentials' | 'account_locked' | 'mfa_required' | 'password_expired' | 
        'account_disabled' | 'rate_limited' | 'session_expired' | 'insufficient_permissions' | 
        'verification_required' | 'security_violation';
  /** Human-readable error message */
  message: string;
  /** Error code for programmatic handling */
  code: string;
  /** Additional error details */
  details?: {
    /** Retry information */
    retryAfter?: number;
    /** Required actions */
    requiredActions?: string[];
    /** Security context */
    securityContext?: Record<string, any>;
  };
  /** Timestamp of error occurrence */
  timestamp: Date;
}

/**
 * Account Security Events
 */
export interface SecurityEvent {
  /** Event type */
  type: 'login_success' | 'login_failed' | 'password_changed' | 'mfa_enabled' | 
        'mfa_disabled' | 'account_locked' | 'suspicious_activity' | 'token_refresh' | 
        'session_terminated' | 'security_violation';
  /** Event description */
  description: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event context */
  context: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    deviceId?: string;
    riskScore?: number;
    additionalData?: Record<string, any>;
  };
  /** Event severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Event status */
  status: 'resolved' | 'investigating' | 'confirmed_threat' | 'false_positive';
}

/**
 * Authentication Service Interface
 */
export interface AuthServiceInterface {
  /** Current authentication state */
  readonly state: AuthenticationState;
  /** Current user session */
  readonly session: UserSession | null;
  /** Current user (shorthand) */
  readonly user: EnhancedUser | null;
  /** Authentication status check */
  readonly isAuthenticated: boolean;
  /** Token validity check */
  readonly hasValidToken: boolean;

  /** User authentication */
  login(credentials: LoginRequest): Promise<UserSession>;
  /** User registration */
  register(userData: RegisterRequest): Promise<UserSession>;
  /** User logout */
  logout(options?: { 
    revokeRefreshToken?: boolean; 
    terminateAllSessions?: boolean;
  }): Promise<void>;

  /** Token management */
  refreshToken(): Promise<JWTTokens>;
  /** Token validation */
  validateToken(token?: string): Promise<boolean>;
  /** Token revocation */
  revokeToken(tokenId?: string): Promise<void>;

  /** Password management */
  changePassword(request: PasswordChangeRequest): Promise<void>;
  /** Password reset initiation */
  requestPasswordReset(request: PasswordResetRequest): Promise<void>;
  /** Password reset completion */
  resetPassword(token: string, newPassword: string): Promise<void>;

  /** Multi-factor authentication */
  setupMFA(request: MFASetupRequest): Promise<void>;
  /** Disable MFA */
  disableMFA(password: string): Promise<void>;
  /** Verify MFA code */
  verifyMFA(code: string, method: AuthenticationFactor): Promise<boolean>;

  /** Session management */
  getCurrentSession(): Promise<UserSession>;
  /** Get all user sessions */
  getUserSessions(): Promise<UserSession[]>;
  /** Terminate specific session */
  terminateSession(sessionId: string): Promise<void>;
  /** Terminate all other sessions */
  terminateOtherSessions(): Promise<void>;

  /** Security and monitoring */
  getSecurityEvents(limit?: number): Promise<SecurityEvent[]>;
  /** Update user profile */
  updateProfile(updates: Partial<EnhancedUser>): Promise<EnhancedUser>;
  /** Account verification */
  verifyAccount(token: string): Promise<void>;
  /** Resend verification */
  resendVerification(): Promise<void>;

  /** Permission checks */
  hasPermission(permission: string): boolean;
  /** Role checks */
  hasRole(role: string): boolean;
  /** Scope checks */
  hasScope(scope: string): boolean;

  /** Event listeners */
  onStateChange(callback: (state: AuthenticationState) => void): void;
  onSessionUpdate(callback: (session: UserSession | null) => void): void;
  onSecurityEvent(callback: (event: SecurityEvent) => void): void;
  onError(callback: (error: AuthenticationError) => void): void;
}

// =============================================================================
// API SERVICE TYPES
// =============================================================================

/**
 * HTTP Request Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * API Request Configuration
 */
export interface ApiRequestConfig {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request parameters */
  params?: Record<string, any>;
  /** Request body */
  data?: any;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Retry configuration */
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    baseDelay: number;
    maxDelay: number;
  };
  /** Cache configuration */
  cache?: {
    enabled: boolean;
    ttl: number;
    key?: string;
    strategy: 'memory' | 'localStorage' | 'sessionStorage';
  };
  /** Request metadata */
  metadata?: {
    tags: string[];
    priority: 'low' | 'normal' | 'high' | 'critical';
    source: string;
    correlationId?: string;
  };
}

/**
 * API Response Structure
 */
export interface ApiResponse<T = any> {
  /** Response data */
  data: T;
  /** Response status code */
  status: number;
  /** Response status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Request configuration used */
  config: ApiRequestConfig;
  /** Response metadata */
  metadata?: {
    requestId: string;
    duration: number;
    fromCache: boolean;
    timestamp: Date;
  };
}

/**
 * API Error Structure
 */
export interface ApiError {
  /** Error message */
  message: string;
  /** HTTP status code */
  status?: number;
  /** Error code */
  code?: string;
  /** Request configuration */
  config?: ApiRequestConfig;
  /** Additional error details */
  details?: Record<string, any>;
  /** Error timestamp */
  timestamp: Date;
  /** Error source */
  source: 'network' | 'server' | 'client' | 'timeout' | 'abort';
}

/**
 * Request Interceptor
 */
export interface RequestInterceptor {
  /** Interceptor name for debugging */
  name: string;
  /** Request transformation function */
  transform: (config: ApiRequestConfig) => Promise<ApiRequestConfig>;
  /** Error handler */
  onError?: (error: ApiError) => Promise<ApiError>;
  /** Interceptor priority */
  priority?: number;
}

/**
 * Response Interceptor
 */
export interface ResponseInterceptor {
  /** Interceptor name for debugging */
  name: string;
  /** Response transformation function */
  transform: <T>(response: ApiResponse<T>) => Promise<ApiResponse<T>>;
  /** Error handler */
  onError?: (error: ApiError) => Promise<ApiError>;
  /** Interceptor priority */
  priority?: number;
}

/**
 * API Service Interface
 */
export interface ApiServiceInterface {
  /** Service configuration */
  readonly config: EnterpriseAppConfig['api'];
  /** Base URL for API requests */
  readonly baseUrl: string;
  /** Request timeout */
  readonly timeout: number;

  /** HTTP request methods */
  get<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  patch<T>(url: string, data?: any, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  head<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;
  options<T>(url: string, config?: Partial<ApiRequestConfig>): Promise<ApiResponse<T>>;

  /** Generic request method */
  request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>>;

  /** Interceptor management */
  addRequestInterceptor(interceptor: RequestInterceptor): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): void;
  removeRequestInterceptor(name: string): void;
  removeResponseInterceptor(name: string): void;

  /** Configuration management */
  setBaseUrl(url: string): void;
  setTimeout(timeout: number): void;
  setHeader(name: string, value: string): void;
  removeHeader(name: string): void;

  /** Health and monitoring */
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    uptime: number;
    version: string;
  }>;
}

// =============================================================================
// FILE SERVICE TYPES
// =============================================================================

/**
 * File Upload Configuration
 */
export interface FileUploadConfig {
  /** Maximum file size in bytes */
  maxSize: number;
  /** Allowed file types */
  allowedTypes: string[];
  /** Upload endpoint */
  endpoint: string;
  /** Chunk size for large files */
  chunkSize?: number;
  /** Enable resumable uploads */
  resumable?: boolean;
  /** Image processing options */
  imageProcessing?: {
    resize?: { width: number; height: number; quality?: number };
    thumbnails?: Array<{ width: number; height: number; suffix: string }>;
    format?: 'jpeg' | 'png' | 'webp';
    optimization?: boolean;
  };
  /** Security scanning */
  security?: {
    virusScan: boolean;
    contentValidation: boolean;
    metadataStripping: boolean;
  };
}

/**
 * File Upload Progress
 */
export interface FileUploadProgress {
  /** Upload identifier */
  uploadId: string;
  /** File name */
  fileName: string;
  /** Total file size */
  totalSize: number;
  /** Uploaded bytes */
  uploadedBytes: number;
  /** Upload percentage */
  percentage: number;
  /** Upload speed in bytes per second */
  speed: number;
  /** Estimated time remaining */
  eta: number;
  /** Upload status */
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled';
  /** Error information if any */
  error?: string;
}

/**
 * File Service Interface
 */
export interface FileServiceInterface {
  /** Service configuration */
  readonly config: FileUploadConfig;

  /** File upload */
  upload(
    file: File, 
    config?: Partial<FileUploadConfig>,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<{
    id: string;
    url: string;
    thumbnails?: Record<string, string>;
    metadata: Record<string, any>;
  }>;

  /** File download */
  download(fileId: string, fileName?: string): Promise<Blob>;

  /** File deletion */
  delete(fileId: string): Promise<void>;

  /** Get file metadata */
  getMetadata(fileId: string): Promise<Record<string, any>>;

  /** Cancel upload */
  cancelUpload(uploadId: string): Promise<void>;

  /** Resume upload */
  resumeUpload(uploadId: string): Promise<void>;
}

// =============================================================================
// NOTIFICATION SERVICE TYPES
// =============================================================================

/**
 * Notification Types
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'progress';

/**
 * Notification Configuration
 */
export interface NotificationConfig {
  /** Notification type */
  type: NotificationType;
  /** Notification title */
  title: string;
  /** Notification message */
  message: string;
  /** Auto-dismiss timeout in milliseconds */
  timeout?: number;
  /** Notification actions */
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary' | 'danger';
  }>;
  /** Notification position */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Notification icon */
  icon?: string;
  /** Notification metadata */
  metadata?: Record<string, any>;
}

/**
 * Notification Service Interface
 */
export interface NotificationServiceInterface {
  /** Show notification */
  show(config: NotificationConfig): string;
  /** Hide notification */
  hide(id: string): void;
  /** Clear all notifications */
  clear(): void;
  /** Update notification */
  update(id: string, updates: Partial<NotificationConfig>): void;
}

// =============================================================================
// CACHE SERVICE TYPES
// =============================================================================

/**
 * Cache Entry
 */
export interface CacheEntry<T = any> {
  /** Cache key */
  key: string;
  /** Cached value */
  value: T;
  /** Entry expiration timestamp */
  expiresAt: Date;
  /** Entry creation timestamp */
  createdAt: Date;
  /** Entry last access timestamp */
  lastAccessed: Date;
  /** Entry metadata */
  metadata?: {
    tags: string[];
    version: number;
    source: string;
  };
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  /** Default TTL in milliseconds */
  defaultTtl: number;
  /** Maximum cache size */
  maxSize: number;
  /** Cache storage type */
  storage: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  /** Cache key prefix */
  keyPrefix?: string;
  /** Serialization strategy */
  serialization: 'json' | 'binary' | 'custom';
}

/**
 * Cache Service Interface
 */
export interface CacheServiceInterface {
  /** Get cached value */
  get<T>(key: string): Promise<T | null>;
  /** Set cached value */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  /** Delete cached value */
  delete(key: string): Promise<void>;
  /** Clear cache */
  clear(): Promise<void>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Get cache statistics */
  getStats(): Promise<{
    size: number;
    hitRate: number;
    missRate: number;
    evictionCount: number;
  }>;
}

// =============================================================================
// SERVICE CONTAINER AND DEPENDENCY INJECTION
// =============================================================================

/**
 * Service Dependencies
 */
export interface ServiceDependencies {
  authService: AuthServiceInterface;
  apiService: ApiServiceInterface;
  socketService: WebSocketServiceInterface;
  fileService: FileServiceInterface;
  notificationService: NotificationServiceInterface;
  cacheService: CacheServiceInterface;
  config: EnterpriseAppConfig;
}

/**
 * Service Container Interface
 */
export interface ServiceContainer {
  /** Register service */
  register<T>(name: keyof ServiceDependencies, service: T): void;
  /** Resolve service */
  resolve<T>(name: keyof ServiceDependencies): T;
  /** Check if service is registered */
  has(name: keyof ServiceDependencies): boolean;
  /** Initialize all services */
  initialize(): Promise<void>;
  /** Dispose all services */
  dispose(): Promise<void>;
}

/**
 * Service Health Status
 */
export interface ServiceHealth {
  /** Service name */
  name: string;
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Last health check timestamp */
  lastCheck: Date;
  /** Health check details */
  details?: Record<string, any>;
  /** Health check error if any */
  error?: string;
}

/**
 * Service Monitor Interface
 */
export interface ServiceMonitor {
  /** Get health status for all services */
  getHealthStatus(): Promise<ServiceHealth[]>;
  /** Get health status for specific service */
  getServiceHealth(serviceName: keyof ServiceDependencies): Promise<ServiceHealth>;
  /** Register health check */
  registerHealthCheck(
    serviceName: keyof ServiceDependencies,
    healthCheck: () => Promise<ServiceHealth>
  ): void;
  /** Start monitoring */
  startMonitoring(interval?: number): void;
  /** Stop monitoring */
  stopMonitoring(): void;
}
