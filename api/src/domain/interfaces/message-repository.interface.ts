import { 
  Message, 
  MessageWithoutId, 
  CreateMessageData, 
  UpdateMessageData,
  MessageSearchFilters,
  MessagePaginationOptions,
  MessageAnalytics,
  BulkMessageAction,
  MessageSearchResult
} from '../entities/message.entity';
import { MessageSearchQuery, MessageSearchResponse } from '../types/message-search.types';
import { MessageFilterExpression, MessageQueryOptions, MessageAnalyticsFilter } from '../types/message-filter.types';

// Enhanced pagination result
export type PaginatedResult<T> = {
  data: T[];
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
  metadata?: {
    queryTime: number;
    cacheHit: boolean;
    totalScanned: number;
  };
};

// Repository interface with advanced capabilities
export interface IMessageRepository {
  // Basic CRUD operations
  create(messageData: CreateMessageData): Promise<Message>;
  findById(id: string, options?: MessageQueryOptions): Promise<Message | null>;
  update(id: string, messageData: UpdateMessageData): Promise<Message | null>;
  softDelete(id: string, deletedBy: string): Promise<boolean>;
  hardDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<Message | null>;

  // Advanced query operations
  findMany(filter: MessageFilterExpression, options?: MessageQueryOptions): Promise<Message[]>;
  findPaginated(filter: MessageFilterExpression, options: MessageQueryOptions): Promise<PaginatedResult<Message>>;
  count(filter: MessageFilterExpression): Promise<number>;
  exists(filter: MessageFilterExpression): Promise<boolean>;

  // Search operations
  search(searchQuery: MessageSearchQuery): Promise<MessageSearchResponse>;
  searchAdvanced(query: string, filters: MessageSearchFilters, options: MessagePaginationOptions): Promise<PaginatedResult<MessageSearchResult>>;
  createSearchIndex(): Promise<void>;
  updateSearchIndex(messageIds: string[]): Promise<void>;

  // Bulk operations
  bulkCreate(messages: CreateMessageData[]): Promise<Message[]>;
  bulkUpdate(updates: Array<{id: string; data: UpdateMessageData}>): Promise<number>;
  bulkDelete(ids: string[]): Promise<number>;
  bulkAction(action: BulkMessageAction): Promise<{success: number; failed: number; errors: string[]}>;

  // Read status operations
  markAsRead(messageId: string, userId: string): Promise<boolean>;
  markManyAsRead(messageIds: string[], userId: string): Promise<number>;
  getUnreadCount(userId: string, roomId?: string): Promise<number>;
  getReadStatus(messageId: string): Promise<Array<{userId: string; readAt: Date}>>;

  // Analytics and reporting
  getAnalytics(filter: MessageAnalyticsFilter): Promise<MessageAnalytics>;
  getMessageStats(roomId?: string, timeRange?: {start: Date; end: Date}): Promise<{
    totalMessages: number;
    averageLength: number;
    messagesByType: Record<string, number>;
    messagesByHour: Array<{hour: number; count: number}>;
    topAuthors: Array<{authorId: string; count: number}>;
  }>;
  getEngagementMetrics(timeRange: {start: Date; end: Date}): Promise<{
    reactionsPerMessage: number;
    repliesPerMessage: number;
    editRate: number;
    deleteRate: number;
  }>;

  // Thread and reply operations
  getReplies(messageId: string, options?: MessageQueryOptions): Promise<Message[]>;
  getThread(messageId: string, options?: MessageQueryOptions): Promise<Message[]>;
  getThreadStats(messageId: string): Promise<{
    replyCount: number;
    participants: string[];
    lastReplyAt: Date;
  }>;

  // User-specific operations
  getUserMessages(userId: string, options?: MessageQueryOptions): Promise<PaginatedResult<Message>>;
  getUserMentions(userId: string, options?: MessageQueryOptions): Promise<PaginatedResult<Message>>;
  getUserConversations(userId: string): Promise<Array<{
    participantId: string;
    lastMessage: Message;
    unreadCount: number;
  }>>;

  // Room operations
  getRoomMessages(roomId: string, options?: MessageQueryOptions): Promise<PaginatedResult<Message>>;
  getRoomStats(roomId: string): Promise<{
    totalMessages: number;
    uniqueParticipants: number;
    averageResponseTime: number;
    peakActivity: {hour: number; day: string}[];
  }>;
  clearRoomHistory(roomId: string, beforeDate?: Date): Promise<number>;

  // Moderation operations
  flagMessage(messageId: string, flaggedBy: string, reason: string): Promise<boolean>;
  getFlaggedMessages(options?: MessageQueryOptions): Promise<PaginatedResult<Message>>;
  moderateMessage(messageId: string, action: 'approve' | 'reject' | 'edit', moderatorId: string): Promise<boolean>;

  // Performance and maintenance
  optimizeIndexes(): Promise<void>;
  getPerformanceStats(): Promise<{
    avgQueryTime: number;
    indexUsage: Record<string, number>;
    slowQueries: Array<{query: string; time: number}>;
  }>;
  cleanup(options: {
    deleteOlderThan?: Date;
    deleteFlagged?: boolean;
    deleteEmpty?: boolean;
  }): Promise<{deleted: number; errors: string[]}>;

  // Real-time subscriptions
  watchChanges(filter: MessageFilterExpression, callback: (change: {
    operation: 'insert' | 'update' | 'delete';
    document: Message;
    fullDocument?: Message;
  }) => void): Promise<string>; // Returns subscription ID
  unwatchChanges(subscriptionId: string): Promise<void>;

  // Data export and import
  exportMessages(filter: MessageFilterExpression, format: 'json' | 'csv' | 'xml'): Promise<string>;
  importMessages(data: CreateMessageData[], options?: {
    validateOnly?: boolean;
    skipDuplicates?: boolean;
    chunkSize?: number;
  }): Promise<{imported: number; errors: string[]}>;

  // Cache operations
  invalidateCache(pattern?: string): Promise<void>;
  getCacheStats(): Promise<{
    hitRate: number;
    size: number;
    keys: string[];
  }>;
}
