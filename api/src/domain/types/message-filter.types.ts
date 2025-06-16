import { MessageType, MessagePriority, MessageStatus } from '../entities';

// Filter types for message queries
export type MessageFilter = {
  id?: MessageFilterCriteria<string>;
  content?: MessageFilterCriteria<string>;
  authorId?: MessageFilterCriteria<string>;
  authorUsername?: MessageFilterCriteria<string>;
  roomId?: MessageFilterCriteria<string>;
  type?: MessageFilterCriteria<MessageType>;
  priority?: MessageFilterCriteria<MessagePriority>;
  status?: MessageFilterCriteria<MessageStatus>;
  timestamp?: MessageFilterCriteria<Date>;
  createdAt?: MessageFilterCriteria<Date>;
  updatedAt?: MessageFilterCriteria<Date>;
  isEdited?: boolean;
  hasAttachments?: boolean;
  hasMentions?: boolean;
  hasReactions?: boolean;
  isReply?: boolean;
  replyToId?: MessageFilterCriteria<string>;
  mentions?: MessageArrayFilter<string>;
  tags?: MessageArrayFilter<string>;
};

export type MessageFilterCriteria<T> = {
  equals?: T;
  not?: T;
  in?: T[];
  notIn?: T[];
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
  contains?: string; // For string fields
  startsWith?: string; // For string fields
  endsWith?: string; // For string fields
  regex?: string; // For string fields
};

export type MessageArrayFilter<T> = {
  contains?: T;
  containsAll?: T[];
  containsAny?: T[];
  isEmpty?: boolean;
  hasLength?: number;
  lengthGt?: number;
  lengthLte?: number;
};

// Complex filter combinations
export type MessageFilterExpression = {
  and?: MessageFilter[];
  or?: MessageFilter[];
  not?: MessageFilter;
} & MessageFilter;

// Aggregation and grouping filters
export type MessageAggregationFilter = {
  groupBy: MessageGroupByField[];
  aggregations: MessageAggregation[];
  having?: MessageHavingClause[];
  timeRange?: {
    field: 'timestamp' | 'createdAt' | 'updatedAt';
    interval: 'hour' | 'day' | 'week' | 'month' | 'year';
    timezone?: string;
  };
};

export type MessageGroupByField = 
  | 'authorId'
  | 'roomId'
  | 'type'
  | 'priority'
  | 'status'
  | 'date'
  | 'hour'
  | 'dayOfWeek';

export type MessageAggregation = {
  field: string;
  operation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  alias?: string;
};

export type MessageHavingClause = {
  field: string;
  operation: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
};

// Performance and optimization filters
export type MessageQueryOptions = {
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: MessageSortOption[];
  includeCount?: boolean;
  includeMetadata?: boolean;
  projection?: MessageProjection;
  explain?: boolean;
  timeout?: number;
  cacheKey?: string;
  cacheTtl?: number;
};

export type MessageSortOption = {
  field: string;
  direction: 'asc' | 'desc';
  nullsFirst?: boolean;
};

export type MessageProjection = {
  include?: string[];
  exclude?: string[];
  computed?: Record<string, string>; // field name -> expression
};

// Filter presets for common queries
export type MessageFilterPreset = {
  name: string;
  description: string;
  filter: MessageFilterExpression;
  defaultSort?: MessageSortOption[];
  category: 'system' | 'user' | 'admin';
  isPublic: boolean;
  createdBy?: string;
  usageCount?: number;
};

// Filter validation and optimization
export type FilterValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  optimizations: string[];
  estimatedCost: number;
};

// Real-time filter subscriptions
export type MessageFilterSubscription = {
  id: string;
  userId: string;
  filter: MessageFilterExpression;
  eventTypes: MessageFilterEventType[];
  deliveryMode: 'websocket' | 'webhook' | 'email';
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
};

export type MessageFilterEventType = 
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'message.read'
  | 'message.reacted';

// Advanced analytics filters
export type MessageAnalyticsFilter = {
  timeRange: {
    start: Date;
    end: Date;
    granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  };
  segments: MessageSegment[];
  metrics: MessageMetric[];
  dimensions: MessageDimension[];
  comparisons?: MessageComparison[];
};

export type MessageSegment = {
  name: string;
  filter: MessageFilterExpression;
  color?: string;
};

export type MessageMetric = 
  | 'count'
  | 'unique_authors'
  | 'avg_length'
  | 'read_rate'
  | 'response_time'
  | 'reaction_rate';

export type MessageDimension = 
  | 'time'
  | 'author'
  | 'room'
  | 'type'
  | 'priority'
  | 'device'
  | 'location';

export type MessageComparison = {
  type: 'previous_period' | 'same_period_last_year' | 'custom';
  customPeriod?: {
    start: Date;
    end: Date;
  };
};
