import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
  IsUUID,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDate,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  Message, 
  MessageEditHistory,
  MessageReadStatus,
  MessageAttachment,
  MessageReaction,
  MessageMetadata
} from '../../domain/entities';
import { 
  IsStrongPassword, 
  IsHexColor, 
  IsUsername, 
  IsRoomName 
} from '../../infrastructure/pipes/custom-validators';

// Enums from message.entity.ts
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

// Enhanced CreateMessageDTO with rich features
export class CreateMessageDto {
  @ApiProperty({ description: 'The message content', maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'The message type', enum: MessageType, default: MessageType.TEXT })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ description: 'The room ID where the message is sent' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'The ID of the message this is replying to' })
  @IsString()
  @IsOptional()
  replyToId?: string;
  
  @ApiPropertyOptional({ description: 'The thread this message belongs to' })
  @IsString()
  @IsOptional()
  threadId?: string;

  @ApiPropertyOptional({ description: 'URL to an image for image messages' })
  @IsUrl()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Priority level of the message', enum: MessagePriority })
  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @ApiPropertyOptional({ description: 'Array of user mentions with positions' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MentionDto)
  @IsOptional()
  @ArrayMaxSize(50)
  mentions?: MentionDto[];

  @ApiPropertyOptional({ description: 'File attachments for the message' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  @ArrayMaxSize(10)
  attachments?: AttachmentDto[];
}

// Enhanced DTOs for mentions, reactions, etc.
export class MentionDto {
  @ApiProperty({ description: 'User ID being mentioned' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Username being mentioned' })
  @IsString()
  @IsNotEmpty()
  @IsUsername()
  username: string;

  @ApiProperty({ description: 'Start position in the message content' })
  @IsInt()
  @Min(0)
  startIndex: number;

  @ApiProperty({ description: 'End position in the message content' })
  @IsInt()
  @Min(0)
  endIndex: number;

  @ApiPropertyOptional({ description: 'Type of mention', default: 'user' })
  @IsString()
  @IsOptional()
  mentionType?: string;
}

export class AttachmentDto {
  @ApiProperty({ description: 'Filename of the attachment' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'Original name of the file' })
  @IsString()
  @IsNotEmpty()
  originalName: string;

  @ApiProperty({ description: 'MIME type of the file' })
  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @ApiProperty({ description: 'Size of the file in bytes' })
  @IsInt()
  @Min(1)
  size: number;

  @ApiProperty({ description: 'URL to access the file' })
  @IsUrl()
  url: string;
}

// Enhanced response DTOs
export class MessageResponseDto {
  @ApiProperty({ description: 'Unique identifier of the message' })
  id: string;

  @ApiProperty({ description: 'Content of the message' })
  content: string;

  @ApiProperty({ description: 'User ID of the author' })
  authorId: string;

  @ApiProperty({ description: 'Username of the author' })
  authorUsername: string;

  @ApiProperty({ description: 'User information of the author' })
  author?: {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    textColor?: string;
    backgroundColor?: string;
    isOnline: boolean;
  };

  @ApiProperty({ description: 'When the message was sent' })
  timestamp: Date;

  @ApiProperty({ description: 'Type of message', enum: MessageType })
  type: MessageType;

  @ApiPropertyOptional({ description: 'Room ID where the message was sent' })
  roomId?: string;

  @ApiPropertyOptional({ description: 'Image URL for image messages' })
  imageUrl?: string;

  @ApiProperty({ description: 'Whether the message has been edited' })
  isEdited: boolean;

  @ApiPropertyOptional({ description: 'When the message was edited' })
  editedAt?: Date;

  @ApiPropertyOptional({ description: 'Message this is replying to' })
  replyTo?: {
    id: string;
    content: string;
    authorUsername: string;
  };

  @ApiPropertyOptional({ description: 'Thread this message belongs to' })
  thread?: {
    id: string;
    messageCount: number;
    participantCount: number;
  };

  @ApiProperty({ description: 'Mentions in this message' })
  mentions: MentionResponseDto[];

  @ApiProperty({ description: 'Reaction summary for this message' })
  reactions: ReactionSummaryDto[];

  @ApiProperty({ description: 'Read status information' })
  readStatus: {
    count: number;
    hasRead: boolean;
    readers: string[];
  };

  @ApiProperty({ description: 'Attachment information' })
  attachments: AttachmentDto[];

  @ApiProperty({ description: 'When the message was created' })
  createdAt: Date;

  @ApiProperty({ description: 'When the message was last updated' })
  updatedAt: Date;
}

export class MentionResponseDto {
  @ApiProperty({ description: 'User ID mentioned' })
  userId: string;

  @ApiProperty({ description: 'Username mentioned' })
  username: string;

  @ApiProperty({ description: 'Start position in the message content' })
  startIndex: number;

  @ApiProperty({ description: 'End position in the message content' })
  endIndex: number;

  @ApiProperty({ description: 'Whether the user has been notified' })
  notified: boolean;
}

export class ReactionSummaryDto {
  @ApiProperty({ description: 'Emoji used for the reaction' })
  emoji: string;

  @ApiProperty({ description: 'Number of users who reacted with this emoji' })
  count: number;

  @ApiProperty({ description: 'Whether the current user reacted with this emoji' })
  reacted: boolean;

  @ApiProperty({ description: 'List of usernames who reacted' })
  users: string[];
}

// Create thread DTOs
export class CreateThreadDto {
  @ApiProperty({ description: 'Root message ID to start the thread' })
  @IsString()
  @IsNotEmpty()
  rootMessageId: string;

  @ApiPropertyOptional({ description: 'Optional thread title' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Initial participant IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  initialParticipants?: string[];
}

// Add reaction DTO
export class AddReactionDto {
  @ApiProperty({ description: 'The emoji to react with' })
  @IsString()
  @IsNotEmpty()
  emoji: string;

  @ApiProperty({ description: 'Unicode representation of the emoji' })
  @IsString()
  @IsNotEmpty()
  emojiCode: string;

  @ApiPropertyOptional({ description: 'Whether this is a custom emoji' })
  @IsBoolean()
  @IsOptional()
  isCustom?: boolean;

  @ApiPropertyOptional({ description: 'URL to custom emoji image' })
  @IsUrl()
  @IsOptional()
  customEmojiUrl?: string;
}

// Enhanced MessageSearchDto with rich filtering
export class MessageSearchDto {
  @ApiPropertyOptional({ description: 'Text to search for in message content' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  query?: string;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsString()
  @IsOptional()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Filter by room ID' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Filter by thread ID' })
  @IsString()
  @IsOptional()
  threadId?: string;

  @ApiPropertyOptional({ description: 'Filter by message type' })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Filter by priority' })
  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @ApiPropertyOptional({ description: 'Filter for messages with attachments' })
  @IsBoolean()
  @IsOptional()
  hasAttachments?: boolean;

  @ApiPropertyOptional({ description: 'Filter by mention of user ID' })
  @IsString()
  @IsOptional()
  mentionsUserId?: string;

  @ApiPropertyOptional({ description: 'Start date range' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  fromDate?: Date;

  @ApiPropertyOptional({ description: 'End date range' })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  toDate?: Date;

  @ApiPropertyOptional({ description: 'Include deleted messages' })
  @IsBoolean()
  @IsOptional()
  includeDeleted?: boolean;

  @ApiPropertyOptional({ description: 'Include edited messages only' })
  @IsBoolean()
  @IsOptional()
  onlyEdited?: boolean;

  @ApiPropertyOptional({ description: 'Filter by specific reactions' })
  @IsString()
  @IsOptional()
  hasReaction?: string;
}

// Typing indicator DTO
export class TypingIndicatorDto {
  @ApiProperty({ description: 'Room ID where the typing occurs' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiProperty({ description: 'Thread ID if typing in a thread' })
  @IsString()
  @IsOptional()
  threadId?: string;

  @ApiProperty({ description: 'Whether the user is typing' })
  @IsBoolean()
  isTyping: boolean;
}

// Enhanced pagination DTO for cursor-based pagination
export class PaginationDto {
  @ApiPropertyOptional({ description: 'Page number for offset-based pagination' })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Cursor for cursor-based pagination' })
  @IsString()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Sort by field' })
  @IsString()
  @IsOptional()
  sortBy?: 'timestamp' | 'createdAt' | 'updatedAt' | 'priority' = 'timestamp';

  @ApiPropertyOptional({ description: 'Sort direction' })
  @IsString()
  @IsOptional()
  sortDirection?: 'asc' | 'desc' = 'desc';
}

// Paginated response DTO
export class PaginatedMessagesDto {
  @ApiProperty({ description: 'Messages for the current page' })
  messages: MessageResponseDto[];

  @ApiProperty({ description: 'Pagination information' })
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };

  @ApiPropertyOptional({ description: 'Query performance metadata' })
  metadata?: {
    queryTime: number;
    cacheHit: boolean;
    matched: number;
    scanned: number;
  };
}

// Mark as read DTO
export class MarkAsReadDto {
  @ApiProperty({ description: 'Message IDs to mark as read' })
  @IsArray()
  @IsString({ each: true })
  messageIds: string[];

  @ApiPropertyOptional({ description: 'Device information' })
  @IsString()
  @IsOptional()
  deviceInfo?: string;

  @ApiPropertyOptional({ description: 'Client platform' })
  @IsString()
  @IsOptional()
  platform?: string;
}

// Content moderation DTO
export class FlagMessageDto {
  @ApiProperty({ description: 'Message ID to flag' })
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @ApiProperty({ description: 'Reason for flagging' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @ApiProperty({ description: 'Flag type' })
  @IsEnum(MessageFlag)
  flag: MessageFlag;
}

/**
 * Update Message DTO
 */
export class UpdateMessageDto {
  @ApiPropertyOptional({ description: 'The updated message content', maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  content?: string;

  @ApiPropertyOptional({ description: 'Priority level of the message', enum: MessagePriority })
  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;

  @ApiPropertyOptional({ description: 'File attachments for the message' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  @ArrayMaxSize(10)
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({ description: 'Edit reason for the message update' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  editReason?: string;
}

/**
 * Bulk Message Action DTO
 */
export class BulkMessageActionDto {
  @ApiProperty({ description: 'Array of message IDs to perform the action on' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  messageIds: string[];

  @ApiProperty({ description: 'The action to perform on the messages', enum: ['markAsRead', 'delete', 'archive', 'priority'] })
  @IsString()
  @IsNotEmpty()
  action: 'markAsRead' | 'delete' | 'archive' | 'priority';

  @ApiPropertyOptional({ description: 'Additional data for the action' })
  @IsOptional()
  actionData?: {
    priority?: MessagePriority;
    reason?: string;
  };
}

/**
 * Message Analytics Filter DTO
 */
export class MessageAnalyticsFilterDto {
  @ApiPropertyOptional({ description: 'Start date for analytics period' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for analytics period' })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Filter by room ID' })
  @IsString()
  @IsOptional()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by message type' })
  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @ApiPropertyOptional({ description: 'Filter by message priority' })
  @IsEnum(MessagePriority)
  @IsOptional()
  priority?: MessagePriority;
}

/**
 * Message Analytics Response DTO
 */
export class MessageAnalyticsDto {
  @ApiProperty({ description: 'Total messages in the selected period' })
  totalMessages: number;

  @ApiProperty({ description: 'Message counts by type' })
  messagesByType: Record<MessageType, number>;

  @ApiProperty({ description: 'Message counts by priority' })
  messagesByPriority: Record<MessagePriority, number>;

  @ApiProperty({ description: 'Message counts by status' })
  messagesByStatus: Record<MessageStatus, number>;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Peak hours for message activity' })
  peakHours: Array<{hour: number; count: number}>;

  @ApiProperty({ description: 'Top message authors' })
  topAuthors: Array<{authorId: string; authorUsername: string; count: number}>;

  @ApiProperty({ description: 'Message read statistics' })
  readRates: {
    totalSent: number;
    totalRead: number;
    readPercentage: number;
  };

  @ApiProperty({ description: 'Period of the analytics' })
  period: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Message Search Result DTO
 */
export class MessageSearchResultDto {
  @ApiProperty({ description: 'The message that matched the search' })
  message: MessageResponseDto;

  @ApiProperty({ description: 'Highlighted snippets from the message content' })
  highlights: string[];

  @ApiProperty({ description: 'Relevance score of the search result' })
  relevanceScore: number;

  @ApiProperty({ description: 'Fields that matched the search query' })
  matchedFields: string[];
}


