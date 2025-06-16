// Base types and enums for the domain layer
import * as MessageMentionTypes from './message-mention.types';
import * as MessageReactionTypes from './message-reaction.types';
import * as MessageThreadTypes from './message-thread.types';
import * as MessageFilterTypes from './message-filter.types';
import * as MessageSearchTypes from './message-search.types';
import * as FileStorageTypes from './file-storage.types';
import * as ImageProcessingTypes from './image-processing.types';

// Export all types
export { MessageMentionTypes };
export { MessageReactionTypes };
export { MessageThreadTypes };
export { MessageFilterTypes };
export { MessageSearchTypes };
export { FileStorageTypes };
export { ImageProcessingTypes };

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

// Common utility types
export type EntityId = string;
export type Timestamp = Date;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredField<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;

// Base entity type with common fields
export type BaseEntity = {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
};

// Metadata types
export type MessageMetadata = {
  ipAddress?: string;
  userAgent?: string;
  editHistory?: Array<{
    content: string;
    editedAt: Timestamp;
  }>;
  // Enhanced metadata for WebSocket features
  edited?: boolean;
  threadId?: string;
  replyCount?: number;
  lastActivity?: Timestamp;
  priority?: number;
  tags?: string[];
  source?: 'web' | 'mobile' | 'api';
  encrypted?: boolean;
  attachmentCount?: number;
};

export type UserMetadata = {
  lastLoginIp?: string;
  lastUserAgent?: string;
  loginCount: number;
};

// Reaction type for future implementation
export type Reaction = {
  emoji: string;
  userId: EntityId;
  createdAt: Timestamp;
};

// Color validation type
export type HexColor = `#${string}`;

// File size in bytes
export type FileSize = number;

// MIME type for attachments
export type MimeType = string;
