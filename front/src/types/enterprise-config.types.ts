/**
 * Enterprise Configuration Types
 * Advanced configuration for multi-environment deployments
 */

// =====================================
// Environment and App Configuration
// =====================================

/**
 * Environment-specific configuration
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Feature flags for gradual rollout and testing
 */
export type FeatureFlags = {
  // Logging and Debugging
  enableDetailedLogging: boolean;
  enablePerformanceMonitoring: boolean;
  enableDebugMode: boolean;
  enableErrorReporting: boolean;
  
  // Real-time Features
  enableWebSocketHeartbeat: boolean;
  enableTypingIndicators: boolean;
  enableReadReceipts: boolean;
  enablePresenceStatus: boolean;
  
  // Advanced Chat Features
  enableThreads: boolean;
  enableReactions: boolean;
  enableMentions: boolean;
  enableMessageEditing: boolean;
  enableFileUploads: boolean;
  
  // Analytics and Monitoring
  enableUserAnalytics: boolean;
  enablePerformanceMetrics: boolean;
  enableUsageTracking: boolean;
  enableErrorTracking: boolean;
  
  // Security Features
  enableAdvancedSecurity: boolean;
  enableRateLimiting: boolean;
  enableContentModeration: boolean;
  enableEncryption: boolean;
  
  // UI/UX Features
  enableDarkMode: boolean;
  enableNotifications: boolean;
  enableSoundEffects: boolean;
  enableAnimations: boolean;
};

/**
 * Enterprise application configuration
 */
export type EnterpriseAppConfig = {
  // Environment
  environment: Environment;
  version: string;
  buildDate: string;
  buildNumber: string;
  
  // Feature flags
  features: FeatureFlags;
  
  // API Configuration
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    maxConcurrentRequests: number;
  };
  
  // WebSocket Configuration
  websocket: {
    url: string;
    reconnectionAttempts: number;
    reconnectionDelay: number;
    heartbeatInterval: number;
    connectionTimeout: number;
    pingTimeout: number;
    pingInterval: number;
  };
  
  // Security Configuration
  security: {
    sessionTimeout: number;
    refreshTokenThreshold: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
    passwordMinLength: number;
    requirePasswordComplexity: boolean;
    enableTwoFactorAuth: boolean;
  };
  
  // Rate Limiting Configuration
  rateLimiting: {
    messages: {
      maxPerMinute: number;
      maxPerHour: number;
      burstLimit: number;
    };
    fileUploads: {
      maxPerMinute: number;
      maxFileSize: number;
      allowedMimeTypes: string[];
    };
    apiCalls: {
      maxPerMinute: number;
      maxPerHour: number;
    };
    searches: {
      maxPerMinute: number;
      debounceMs: number;
    };
  };
  
  // UI Configuration
  ui: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: string;
    animationDuration: number;
    toastDuration: number;
    maxMessageLength: number;
    messageBatchSize: number;
  };
  
  // Storage Configuration
  storage: {
    enableEncryption: boolean;
    encryptionKey?: string;
    sessionStoragePrefix: string;
    localStoragePrefix: string;
    cacheExpirationMs: number;
    maxStorageSize: number;
  };
  
  // Monitoring Configuration
  monitoring: {
    enablePerformanceMonitoring: boolean;
    enableErrorTracking: boolean;
    enableUserAnalytics: boolean;
    sampleRate: number;
    maxErrorsPerSession: number;
  };
  
  // CDN and Assets
  cdn: {
    baseUrl?: string;
    enableImageOptimization: boolean;
    imageFormats: string[];
    maxImageSize: number;
  };
};

// =====================================
// Service-Specific Configurations
// =====================================

/**
 * Advanced API configuration
 */
export type AdvancedApiConfig = {
  // Base configuration
  baseUrl: string;
  timeout: number;
  
  // Authentication
  auth: {
    tokenStorage: 'localStorage' | 'sessionStorage' | 'memory';
    refreshThreshold: number; // seconds before expiry
    autoRefresh: boolean;
    multiTabSync: boolean;
  };
  
  // Retry Logic
  retry: {
    attempts: number;
    delay: number;
    exponentialBackoff: boolean;
    jitter: boolean;
    retryableStatusCodes: number[];
  };
  
  // Request/Response Interceptors
  interceptors: {
    enableRequestLogging: boolean;
    enableResponseLogging: boolean;
    enablePerformanceTracking: boolean;
    enableErrorTransformation: boolean;
  };
  
  // Caching
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    keyPrefix: string;
  };
  
  // Circuit Breaker
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
  };
};

/**
 * Advanced WebSocket configuration
 */
export type AdvancedSocketConfig = {
  // Connection
  url: string;
  protocols?: string[];
  
  // Authentication
  auth: {
    strategy: 'query' | 'header' | 'both';
    tokenRefresh: boolean;
    refreshThreshold: number;
  };
  
  // Reconnection Strategy
  reconnection: {
    enabled: boolean;
    attempts: number;
    delay: number;
    exponentialBackoff: boolean;
    maxDelay: number;
    jitter: boolean;
  };
  
  // Heartbeat/Health Monitoring
  heartbeat: {
    enabled: boolean;
    interval: number;
    timeout: number;
    maxMissed: number;
    adaptiveInterval: boolean;
  };
  
  // Event Management
  events: {
    enableEventBuffering: boolean;
    maxBufferSize: number;
    enableEventOrdering: boolean;
    enableDuplicateDetection: boolean;
  };
  
  // Performance
  performance: {
    enableMetrics: boolean;
    enableLatencyTracking: boolean;
    enableThroughputTracking: boolean;
  };
  
  // Rate Limiting
  rateLimiting: {
    enabled: boolean;
    maxEventsPerSecond: number;
    burstLimit: number;
    backpressureStrategy: 'drop' | 'queue' | 'reject';
  };
};

/**
 * File service configuration
 */
export type FileServiceConfig = {
  // Upload Configuration
  upload: {
    maxFileSize: number;
    maxConcurrentUploads: number;
    chunkSize: number;
    allowedMimeTypes: string[];
    enableResumableUploads: boolean;
  };
  
  // Processing Configuration
  processing: {
    enableImageOptimization: boolean;
    enableThumbnailGeneration: boolean;
    thumbnailSizes: Array<{
      name: string;
      width: number;
      height: number;
    }>;
    imageQuality: number;
  };
  
  // Security Configuration
  security: {
    enableVirusScanning: boolean;
    enableMetadataStripping: boolean;
    quarantineSuspiciousFiles: boolean;
  };
  
  // Storage Configuration
  storage: {
    provider: 'local' | 's3' | 'azure' | 'gcp';
    region?: string;
    bucket?: string;
    enableCdn: boolean;
    cdnUrl?: string;
  };
};

// =====================================
// Monitoring and Analytics
// =====================================

/**
 * Monitoring configuration
 */
export type MonitoringConfig = {
  // Performance Monitoring
  performance: {
    enabled: boolean;
    sampleRate: number;
    longTaskThreshold: number;
    largestContentfulPaintThreshold: number;
    firstInputDelayThreshold: number;
    cumulativeLayoutShiftThreshold: number;
  };
  
  // Error Tracking
  errorTracking: {
    enabled: boolean;
    maxErrorsPerSession: number;
    enableStackTraceCapture: boolean;
    enableSourceMapUpload: boolean;
    enableUserContext: boolean;
  };
  
  // User Analytics
  userAnalytics: {
    enabled: boolean;
    trackPageViews: boolean;
    trackUserInteractions: boolean;
    trackFormSubmissions: boolean;
    enableHeatmaps: boolean;
    enableSessionRecording: boolean;
  };
  
  // Business Metrics
  businessMetrics: {
    enabled: boolean;
    trackMessagesSent: boolean;
    trackUserEngagement: boolean;
    trackRetention: boolean;
    trackConversionFunnels: boolean;
  };
};

/**
 * Compliance and audit configuration
 */
export type ComplianceConfig = {
  // Data Retention
  dataRetention: {
    messagesRetentionDays: number;
    userDataRetentionDays: number;
    logRetentionDays: number;
    enableAutomaticDeletion: boolean;
  };
  
  // Audit Logging
  auditLogging: {
    enabled: boolean;
    logUserActions: boolean;
    logDataAccess: boolean;
    logPermissionChanges: boolean;
    logSecurityEvents: boolean;
  };
  
  // Privacy
  privacy: {
    enableDataAnonymization: boolean;
    enableRightToErasure: boolean;
    enableDataPortability: boolean;
    enableConsentManagement: boolean;
  };
  
  // Security Compliance
  security: {
    enableEncryptionAtRest: boolean;
    enableEncryptionInTransit: boolean;
    enableAccessLogging: boolean;
    enablePenetrationTesting: boolean;
  };
};

// =====================================
// Environment-Specific Configurations
// =====================================

/**
 * Development environment configuration
 */
export type DevelopmentConfig = EnterpriseAppConfig & {
  debug: {
    enableVueDevtools: boolean;
    enableHotReload: boolean;
    enableSourceMaps: boolean;
    enableMockData: boolean;
    mockApiDelay: number;
  };
};

/**
 * Production environment configuration
 */
export type ProductionConfig = EnterpriseAppConfig & {
  optimization: {
    enableCodeSplitting: boolean;
    enableTreeShaking: boolean;
    enableMinification: boolean;
    enableGzipCompression: boolean;
    enableBrotliCompression: boolean;
  };
  
  security: EnterpriseAppConfig['security'] & {
    enableCSP: boolean;
    enableHSTS: boolean;
    enableXSSProtection: boolean;
    enableFrameOptions: boolean;
  };
};

// =====================================
// Configuration Validation
// =====================================

/**
 * Configuration validation result
 */
export type ConfigValidationResult = {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    field: string;
    message: string;
    recommendation: string;
  }>;
};

/**
 * Configuration schema for validation
 */
export type ConfigSchema = {
  required: string[];
  optional: string[];
  validation: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  }>;
};
