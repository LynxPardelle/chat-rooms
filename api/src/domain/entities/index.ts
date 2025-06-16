// Domain entities
import {
  BaseEntity,
  EntityId,
  Timestamp,
  UserStatus,
  UserMetadata,
  MessageMetadata,
  Reaction,
  HexColor,
  FileSize,
  MimeType,
  Optional,
} from '../types';

// Import shared enums from application layer for consistency
import { ThemeType } from '../../application/dtos/user-settings.dto';

// Re-export types for convenience
export {
  BaseEntity,
  EntityId,
  Timestamp,
  UserStatus,
  UserMetadata,
  MessageMetadata,
  Reaction,
  HexColor,
  FileSize,
  MimeType,
  Optional,
};

// Export enhanced message types from message.entity.ts
export * from './message.entity';
import { Message } from './message.entity';

// User entity
export type User = BaseEntity & {
  username: string;
  email: string;
  password: string;
  avatar?: string; // filename or identifier
  avatarUrl?: string; // full URL for client consumption
  textColor: HexColor;
  backgroundColor: HexColor;
  status: UserStatus;
  isOnline: boolean;
  lastSeen: Timestamp;
  metadata: UserMetadata;
  isAdmin: boolean;
  role: string;
  // New personalization fields
  theme?: UserTheme;
  accessibilityConfig?: AccessibilityConfig;
  notificationSettings?: NotificationSettings;
  language?: string;
  timezone?: string;
};

// User Theme configuration
export type UserTheme = {
  name: ThemeType;
  customColors?: Record<string, string>;
  description?: string;
};

// Accessibility configuration
export type AccessibilityConfig = {
  fontSize?: number; // 0.5 - 3.0
  lineHeight?: number; // 1.0 - 2.5
  highContrast?: boolean;
  reduceMotion?: boolean;
  largeText?: boolean;
  focusIndicator?: boolean;
  screenReaderMode?: string;
};

// Notification settings
export type NotificationSettings = {
  sound?: boolean;
  vibration?: boolean;
  desktop?: boolean;
  email?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
};

// Room entity (preparing for multiple rooms in the future)
export type Room = BaseEntity & {
  name: string;
  description?: string;
  isPrivate: boolean;
  maxUsers: number;
  createdBy: EntityId;
  activeUsers: EntityId[];
};

// Attachment entity with enterprise features
export type Attachment = BaseEntity & {
  fileId: string; // unique identifier for tracking and deduplication
  filename: string;
  originalName: string;
  mimeType: MimeType;
  size: FileSize;
  url: string;
  uploadedBy: EntityId;
  messageId?: EntityId; // optional, for orphaned attachments cleanup
  checksum: string; // SHA-256 for integrity validation and duplicate detection
  thumbnails: AttachmentThumbnail[]; // multiple resolutions
  metadata: AttachmentMetadata; // EXIF, dimensions, color profile, processing history
  processingStatus: ProcessingStatus;
  virusScanStatus: VirusScanStatus;
  virusScanResult?: string;
  compressionLevel?: number;
  optimizationApplied: boolean;
  accessLog: AttachmentAccess[];
  storageProvider: StorageProvider;
  cdnConfig?: CDNConfig;
  retentionPolicy?: RetentionPolicy;
};

// Supporting types for enterprise attachment management
export type AttachmentThumbnail = {
  size: 'small' | 'medium' | 'large' | 'xlarge';
  url: string;
  width: number;
  height: number;
  format: string;
};

export type AttachmentMetadata = {
  width?: number;
  height?: number;
  colorProfile?: string;
  exifData?: Record<string, any>;
  processingHistory: ProcessingStep[];
  originalFormat?: string;
  compressionInfo?: CompressionInfo;
};

export type ProcessingStep = {
  operation: string;
  timestamp: Timestamp;
  parameters: Record<string, any>;
  result: 'success' | 'failed' | 'skipped';
};

export type CompressionInfo = {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: string;
  quality: number;
};

export type AttachmentAccess = {
  userId: EntityId;
  accessedAt: Timestamp;
  operation: 'view' | 'download' | 'thumbnail';
  ipAddress?: string;
  userAgent?: string;
};

export type CDNConfig = {
  distributionId: string;
  cdnUrl: string;
  cacheHeaders: Record<string, string>;
  edgeLocations: string[];
};

export type RetentionPolicy = {
  retentionDays: number;
  autoDelete: boolean;
  archiveBeforeDelete: boolean;
  notifyBeforeDelete: boolean;
};

export enum ProcessingStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  QUARANTINED = 'quarantined',
}

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

// Utility types for entities
export type UserWithoutPassword = Omit<User, 'password'>;

// Message composition types using the enhanced Message entity
export type MessageWithUser = Message & { user: UserWithoutPassword };
export type MessageWithAttachments = Message & { attachments: Attachment[] };
export type MessageComplete = Message & {
  user: UserWithoutPassword;
  attachments: Attachment[];
  replyTo?: MessageComplete;
};
