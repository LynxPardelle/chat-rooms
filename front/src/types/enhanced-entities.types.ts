/**
 * Enhanced Enterprise Entity Types
 * Integrates with backend entities and provides advanced features
 */

import type { UserResponse, Message, MessageAttachment } from '@/core/types/enhanced-api.types';

// =====================================
// Enhanced Entity Base Types
// =====================================

/**
 * Utility type for entities with audit metadata
 */
export type EntityWithMetadata<T> = T & {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
};

/**
 * Utility type for entities that support soft deletion
 */
export type SoftDeletableEntity<T> = T & {
  deletedAt?: Date;
  deletedBy?: string;
  isDeleted: boolean;
};

/**
 * Utility type for versioned entities
 */
export type VersionedEntity<T> = T & {
  version: number;
  previousVersions?: Array<{
    version: number;
    data: Partial<T>;
    changedAt: Date;
    changedBy: string;
    changeReason?: string;
  }>;
};

/**
 * Utility type for auditable entities
 */
export type AuditableEntity<T> = T & {
  auditLog: Array<{
    action: 'create' | 'update' | 'delete' | 'access' | 'permission_change';
    timestamp: Date;
    userId: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }>;
};

// =====================================
// Enhanced User Entity
// =====================================

/**
 * Enterprise User with advanced features
 */
export type EnhancedUser = EntityWithMetadata<UserResponse> & {
  // Role and Permission System
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
    assignedAt: Date;
    assignedBy: string;
    expiresAt?: Date;
  }>;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    conditions?: Record<string, any>;
  }>;
  
  // Multi-Device Session Management
  deviceSessions: Array<{
    sessionId: string;
    deviceId: string;
    deviceName: string;
    deviceType: 'mobile' | 'desktop' | 'tablet' | 'web';
    ipAddress: string;
    userAgent: string;
    lastActivity: Date;
    isActive: boolean;
    location?: {
      country: string;
      city: string;
      timezone: string;
    };
  }>;
  
  // Security and Monitoring
  securityEvents: Array<{
    eventType: 'login' | 'logout' | 'password_change' | 'suspicious_activity' | 'permission_change';
    timestamp: Date;
    details: Record<string, any>;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resolved: boolean;
  }>;
  
  // Activity and Analytics
  activityLog: Array<{
    action: string;
    timestamp: Date;
    resource?: string;
    metadata: Record<string, any>;
  }>;
  
  // User Preferences
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      sound: boolean;
      desktop: boolean;
    };
    privacy: {
      showOnlineStatus: boolean;
      showLastSeen: boolean;
      allowDirectMessages: boolean;
    };
    appearance: {
      theme: 'light' | 'dark' | 'auto';
      language: string;
      timezone: string;
    };
  };
  
  // Analytics
  statistics: {
    totalMessages: number;
    totalLogins: number;
    averageSessionDuration: number;
    lastLoginAt?: Date;
    joinedRooms: number;
    filesUploaded: number;
  };
};

// =====================================
// Enhanced Message Entity
// =====================================

/**
 * Enterprise Message with threading, reactions, and advanced features
 */
export type EnhancedMessage = EntityWithMetadata<Message> & {
  // Threading System
  threadId?: string;
  replyToId?: string;
  threadDepth: number;
  threadParticipants: string[];
  
  // Mentions System
  mentions: Array<{
    userId: string;
    username: string;
    startIndex: number;
    endIndex: number;
    notified: boolean;
    notifiedAt?: Date;
  }>;
  
  // Reactions System (extends existing reactions)
  reactionCounts: Record<string, number>;
  
  // Edit History
  editHistory: Array<{
    content: string;
    editedAt: Date;
    editedBy: string;
    editReason?: string;
  }>;
  
  // Read Receipts and Delivery
  readBy: Array<{
    userId: string;
    readAt: Date;
    deviceId?: string;
  }>;
  deliveredTo: Array<{
    userId: string;
    deliveredAt: Date;
    deviceId?: string;
  }>;
  
  // Message Priority and Status
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
  
  // Moderation and Flags
  messageFlags: Array<{
    type: 'spam' | 'inappropriate' | 'reported' | 'approved' | 'quarantined';
    flaggedBy: string;
    flaggedAt: Date;
    reason: string;
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
  }>;
  
  // Search and Content
  searchableContent: string;
  contentHash: string;
  
  // Analytics
  analytics: {
    views: number;
    clicks: number;
    reactionCount: number;
    replyCount: number;
    shareCount: number;
  };
};

// =====================================
// Enhanced Room Entity
// =====================================

/**
 * Enterprise Room with advanced management features
 */
export type EnhancedRoom = EntityWithMetadata<{
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxUsers: number;
  createdBy: string;
}> & {
  // Participant Management
  participants: Array<{
    userId: string;
    joinedAt: Date;
    role: 'owner' | 'admin' | 'moderator' | 'member';
    permissions: string[];
    isActive: boolean;
    lastSeen: Date;
  }>;
  
  // Room Settings
  settings: {
    allowInvites: boolean;
    allowFileUploads: boolean;
    allowReactions: boolean;
    allowThreads: boolean;
    messageRetentionDays: number;
    rateLimitMessages: number;
    rateLimitFiles: number;
  };
  
  // Permissions and Access Control
  permissions: {
    read: string[];
    write: string[];
    admin: string[];
    invite: string[];
    moderate: string[];
  };
  
  // Moderation
  moderators: Array<{
    userId: string;
    assignedAt: Date;
    assignedBy: string;
    permissions: string[];
  }>;
  
  // Analytics
  analytics: {
    totalMessages: number;
    activeUsers: number;
    peakConcurrentUsers: number;
    averageSessionDuration: number;
    messageFrequency: Record<string, number>; // hourly stats
  };
  
  // Room Status
  status: 'active' | 'archived' | 'suspended' | 'deleted';
  suspensionReason?: string;
  archiveReason?: string;
};

// =====================================
// Enhanced Attachment Entity
// =====================================

/**
 * Enterprise Attachment with processing and security features
 */
export type EnhancedAttachment = EntityWithMetadata<MessageAttachment> & {
  // Thumbnails and Previews
  thumbnails: Array<{
    size: 'small' | 'medium' | 'large' | 'xlarge';
    url: string;
    width: number;
    height: number;
    format: string;
  }>;
  
  // File Metadata
  metadata: {
    exifData?: Record<string, any>;
    dimensions?: {
      width: number;
      height: number;
    };
    duration?: number; // for videos/audio
    colorProfile?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Processing Status
  processingStatus: 'uploading' | 'processing' | 'ready' | 'failed' | 'quarantined';
  processingProgress: number; // 0-100
  processingErrors?: Array<{
    error: string;
    timestamp: Date;
    retryCount: number;
  }>;
  
  // Security Scanning
  virusScanStatus: 'pending' | 'clean' | 'infected' | 'suspicious' | 'failed';
  virusScanResult?: {
    scanDate: Date;
    scanner: string;
    threats: string[];
    quarantined: boolean;
  };
  
  // Optimization and Compression
  compressionLevel: number;
  optimizationApplied: boolean;
  originalSize: number;
  compressedSize: number;
  
  // Access and Analytics
  accessLog: Array<{
    userId: string;
    accessedAt: Date;
    accessType: 'view' | 'download' | 'share';
    ipAddress?: string;
  }>;
  downloadCount: number;
  viewCount: number;
  
  // Storage Information
  storageProvider: 'local' | 's3' | 'azure' | 'gcp';
  storagePath: string;
  cdnUrl?: string;
  backupLocations: string[];
  
  // Retention and Lifecycle
  retentionPolicy: {
    deleteAfterDays?: number;
    archiveAfterDays?: number;
    autoOptimize: boolean;
  };
};

// =====================================
// Pagination Types
// =====================================

/**
 * Cursor-based pagination for real-time data
 */
export type CursorPagination<T> = {
  data: T[];
  nextCursor?: string;
  previousCursor?: string;
  hasNext: boolean;
  hasPrevious: boolean;
  totalCount?: number;
};

/**
 * Offset-based pagination for traditional data
 */
export type OffsetPagination<T> = {
  data: T[];
  offset: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

/**
 * Infinite scroll pagination
 */
export type InfinitePagination<T> = {
  data: T[];
  nextToken?: string;
  hasMore: boolean;
  loadedCount: number;
  totalCount?: number;
  lastUpdated: Date;
};
