import { MessageType, MessagePriority, MessageStatus } from '../entities/message.entity';

// Advanced search types
export type MessageSearchQuery = {
  query: string;
  filters: MessageSearchFilters;
  pagination: MessageSearchPagination;
  options: MessageSearchOptions;
};

export type MessageSearchFilters = {
  authorIds?: string[];
  roomIds?: string[];
  types?: MessageType[];
  priorities?: MessagePriority[];
  statuses?: MessageStatus[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  hasAttachments?: boolean;
  isEdited?: boolean;
  mentionsUser?: string;
  replyToMessageId?: string;
  contentLength?: {
    min?: number;
    max?: number;
  };
};

export type MessageSearchPagination = {
  page: number;
  limit: number;
  sortBy: MessageSearchSortField;
  sortOrder: 'asc' | 'desc';
};

export type MessageSearchSortField = 
  | 'relevance' 
  | 'timestamp' 
  | 'priority' 
  | 'author' 
  | 'reactions';

export type MessageSearchOptions = {
  includeContent: boolean;
  includeMetadata: boolean;
  includeReadStatus: boolean;
  includeReactions: boolean;
  highlightResults: boolean;
  fuzzySearch: boolean;
  searchInReplies: boolean;
};

export type MessageSearchResponse = {
  results: MessageSearchResultItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalResults: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  facets: MessageSearchFacets;
  queryInfo: {
    originalQuery: string;
    processedQuery: string;
    searchTime: number;
    suggestions?: string[];
  };
};

export type MessageSearchResultItem = {
  messageId: string;
  content: string;
  highlights: string[];
  relevanceScore: number;
  matchedFields: string[];
  context: {
    previousMessage?: string;
    nextMessage?: string;
    threadContext?: string[];
  };
};

export type MessageSearchFacets = {
  authors: Array<{id: string; name: string; count: number}>;
  types: Array<{type: MessageType; count: number}>;
  priorities: Array<{priority: MessagePriority; count: number}>;
  timeRanges: Array<{range: string; count: number}>;
  rooms: Array<{id: string; name: string; count: number}>;
};

// Full-text search configuration
export type SearchIndexConfig = {
  textFields: string[];
  weights: Record<string, number>;
  language: string;
  stopWords: string[];
  minScore: number;
};

// Search history and analytics
export type SearchHistoryEntry = {
  userId: string;
  query: string;
  filters: MessageSearchFilters;
  timestamp: Date;
  resultCount: number;
  clickedResults: string[];
};

export type SearchAnalytics = {
  topQueries: Array<{query: string; count: number}>;
  avgResultsPerQuery: number;
  avgSearchTime: number;
  noResultsQueries: string[];
  popularFilters: Record<string, number>;
};
