import { MessageMetadata } from '../types';

export type Message = {
  id: string;
  content: string;
  authorId: string;
  userId: string; // Alias for authorId to maintain compatibility
  authorUsername: string;
  type: MessageType;
  imageUrl?: string;
  isEdited: boolean;
  editedAt?: Date;
  roomId: string;
  // Enhanced thread support
  threadId?: string;
  replyToId?: string;
  // Enhanced mentions with positioning
  mentions: MessageMention[];
  editHistory: MessageEditHistory[];
  // Enhanced read/delivery tracking
  readBy: MessageReadStatus[];
  deliveredTo: MessageDeliveryStatus[];
  priority: MessagePriority;
  status: MessageStatus;
  attachments: MessageAttachment[];
  // Enhanced reactions
  reactions: MessageReaction[];
  metadata: MessageMetadata;
  // Message flags for moderation
  messageFlags: MessageFlag[];
  searchableContent: string;
  timestamp: Date; // For compatibility
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
  FILE = 'file'
}

export enum MessagePriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
  SYSTEM = 'system'
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  DELETED = 'deleted'
}

export enum MessageFlag {
  FLAGGED = 'flagged',
  APPROVED = 'approved',
  SPAM = 'spam',
  INAPPROPRIATE = 'inappropriate',
  UNDER_REVIEW = 'under_review'
}

export type MessageMention = {
  userId: string;
  username: string;
  startIndex: number;
  endIndex: number;
  notified: boolean;
  notifiedAt?: Date;
};

export type MessageDeliveryStatus = {
  userId: string;
  deliveredAt: Date;
  deviceInfo?: string;
  platform?: string;
};

export type MessageEditHistory = {
  editedAt: Date;
  editedBy: string;
  previousContent: string;
  reason?: string;
};

export type MessageReadStatus = {
  userId: string;
  readAt: Date;
  deviceInfo?: string;
};

export type MessageAttachment = {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
};

export type MessageReaction = {
  emoji: string;
  userId: string;
  addedAt: Date;
};



// Utility types for different operations
export type MessageWithoutId = Omit<Message, 'id'>;

// Updated to match DTOs and required fields
export type CreateMessageData = {
  content: string;
  authorId: string;
  userId: string; // Add userId for repository compatibility
  authorUsername: string;
  type: MessageType;
  roomId: string;
  isEdited: boolean;
  status: MessageStatus;
  priority: MessagePriority;
  mentions: MessageMention[];
  reactions: MessageReaction[];
  readBy: MessageReadStatus[];
  deliveredTo: MessageDeliveryStatus[];
  messageFlags: MessageFlag[];
  editHistory: MessageEditHistory[];
  metadata: MessageMetadata;
  attachments: MessageAttachment[];
  searchableContent?: string;
  threadId?: string;
  replyToId?: string;
  imageUrl?: string;
};

export type UpdateMessageData = Partial<Pick<Message, 
  'content' | 'isEdited' | 'editedAt' | 'priority' | 'attachments' | 
  'metadata' | 'threadId' | 'messageFlags' | 'reactions' | 'readBy' | 'deliveredTo'
>>;

// Advanced search and filter types
export type MessageSearchFilters = {
  authorId?: string;
  content?: string;
  dateFrom?: Date;
  dateTo?: Date;
  type?: MessageType;
  roomId?: string;
  priority?: MessagePriority;
  status?: MessageStatus;
  hasAttachments?: boolean;
  replyToId?: string;
  mentionsUserId?: string;
  isEdited?: boolean;
};

export type MessageSortOrder = {
  field: 'timestamp' | 'priority' | 'status' | 'createdAt';
  direction: 'asc' | 'desc';
};

export type MessagePaginationOptions = {
  page?: number;
  limit?: number;
  cursor?: string; // For cursor-based pagination
  sortOrder?: MessageSortOrder;
};

// Analytics and reporting types
export type MessageAnalytics = {
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByPriority: Record<MessagePriority, number>;
  messagesByStatus: Record<MessageStatus, number>;
  averageResponseTime: number;
  peakHours: Array<{hour: number; count: number}>;
  topAuthors: Array<{authorId: string; count: number}>;
  readRates: {
    totalSent: number;
    totalRead: number;
    readPercentage: number;
  };
};

// Bulk operations types
export type BulkMessageAction = {
  messageIds: string[];
  action: 'markAsRead' | 'delete' | 'archive' | 'priority';
  actionData?: {
    priority?: MessagePriority;
    reason?: string;
  };
};

export type MessageSearchResult = {
  message: Message;
  highlights: string[];
  relevanceScore: number;
  matchedFields: string[];
};
