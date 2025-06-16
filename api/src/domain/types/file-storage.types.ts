// File storage types for multi-provider architecture
import { EntityId, Timestamp } from './index';

// Storage provider configuration
export type StorageProviderConfig = {
  provider: StorageProvider;
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
  encryption: EncryptionConfig;
  cdnConfig?: CDNConfiguration;
};

export enum VirusScanStatus {
  PENDING = 'pending',
  SCANNING = 'scanning',
  CLEAN = 'clean',
  INFECTED = 'infected',
  SCAN_FAILED = 'scan_failed',
  SKIPPED = 'skipped',
}

export enum StorageProvider {
  LOCAL = 'local',
  AWS_S3 = 's3',
  AZURE_BLOB = 'azure',
  GCP_STORAGE = 'gcp',
}

export type EncryptionConfig = {
  enabled: boolean;
  algorithm?: 'AES-256' | 'AWS-KMS' | 'Azure-KeyVault';
  keyId?: string;
  clientSideEncryption?: boolean;
};

export type CDNConfiguration = {
  enabled: boolean;
  distributionId?: string;
  domainName?: string;
  cacheSettings: CacheSettings;
  compressionEnabled: boolean;
  securityHeaders: Record<string, string>;
};

export type CacheSettings = {
  defaultTtl: number; // seconds
  maxTtl: number;
  browserCacheTtl: number;
  customHeaders: Record<string, string>;
};

// File upload types
export type FileUploadOptions = {
  generateThumbnails: boolean;
  optimizeImages: boolean;
  virusScan: boolean;
  watermark?: WatermarkConfig;
  metadata: UploadMetadata;
  accessControl: AccessControlSettings;
};

export type WatermarkConfig = {
  enabled: boolean;
  text?: string;
  imagePath?: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number; // 0-1
  fontSize?: number;
  color?: string;
};

export type UploadMetadata = {
  userId: EntityId;
  sessionId?: string;
  uploadSource: 'web' | 'mobile' | 'api';
  clientInfo: {
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
  };
  purpose: 'avatar' | 'message-attachment' | 'document' | 'media';
};

export type AccessControlSettings = {
  isPublic: boolean;
  allowedUsers?: EntityId[];
  allowedRoles?: string[];
  expiresAt?: Timestamp;
  downloadLimit?: number;
  requireAuthentication: boolean;
};

// File operation results
export type FileUploadResult = {
  success: boolean;
  fileId: string;
  url: string;
  thumbnails: ThumbnailResult[];
  metadata: FileProcessingMetadata;
  processingStatus: ProcessingStatus;
  error?: FileOperationError;
};

export type ThumbnailResult = {
  size: ThumbnailSize;
  url: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
};

export enum ThumbnailSize {
  SMALL = 'small',    // 150x150
  MEDIUM = 'medium',  // 300x300
  LARGE = 'large',    // 600x600
  XLARGE = 'xlarge',  // 1200x1200
}

export type FileProcessingMetadata = {
  uploadedAt: string;
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTime: number; // milliseconds
  operations: ProcessingOperation[];
  quality: ProcessingQuality;
  dimensions?: {
    width: number;
    height: number;
  };
  imageMetadata?: {
    format: string;
    hasAlpha: boolean;
    colorSpace: string;
    density: number;
  };
  processingDetails: {
    steps: ProcessingOperation[];
    totalTime: number;
    errors: string[];
  };
};

export type ProcessingOperation = {
  type: 'resize' | 'compress' | 'format-convert' | 'watermark' | 'optimize';
  parameters: Record<string, any>;
  executionTime: number;
  result: 'success' | 'failed' | 'skipped';
  error?: string;
};

export enum ProcessingQuality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  LOSSLESS = 'lossless',
}

export enum ProcessingStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  QUARANTINED = 'quarantined',
}

// Error types
export type FileOperationError = {
  code: FileErrorCode;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Timestamp;
};

export enum FileErrorCode {
  // Upload errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  VIRUS_DETECTED = 'VIRUS_DETECTED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // Processing errors
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  THUMBNAIL_GENERATION_FAILED = 'THUMBNAIL_GENERATION_FAILED',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  
  // Storage errors
  STORAGE_UNAVAILABLE = 'STORAGE_UNAVAILABLE',
  STORAGE_ERROR = 'STORAGE_ERROR',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  ACCESS_DENIED = 'ACCESS_DENIED',
  
  // File operation errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  RETRIEVAL_ERROR = 'RETRIEVAL_ERROR',
  DELETION_ERROR = 'DELETION_ERROR',
  THUMBNAIL_NOT_FOUND = 'THUMBNAIL_NOT_FOUND',
  
  // Security errors
  MALICIOUS_FILE = 'MALICIOUS_FILE',
  SCAN_FAILED = 'SCAN_FAILED',
  QUARANTINE_REQUIRED = 'QUARANTINE_REQUIRED',
}

// Analytics types
export type FileAnalytics = {
  uploadCount: number;
  totalSize: number;
  averageSize: number;
  topMimeTypes: MimeTypeStats[];
  uploadTrends: TimeSeriesData[];
  errorRates: ErrorRateStats[];
  performanceMetrics: PerformanceMetrics;
};

export type MimeTypeStats = {
  mimeType: string;
  count: number;
  totalSize: number;
  percentage: number;
};

export type TimeSeriesData = {
  timestamp: Timestamp;
  count: number;
  size: number;
};

export type ErrorRateStats = {
  errorCode: FileErrorCode;
  count: number;
  percentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
};

export type PerformanceMetrics = {
  averageUploadTime: number;
  averageProcessingTime: number;
  throughputMbps: number;
  successRate: number;
  p95UploadTime: number;
  p99UploadTime: number;
};
