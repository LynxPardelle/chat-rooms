/**
 * Backend Integration Types
 * 
 * Enterprise-grade type definitions for backend API integration,
 * synchronization patterns, and data transformation pipelines.
 * 
 * @fileoverview Comprehensive backend integration types for chat-rooms application
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { 
  EnhancedMessage,
  EnhancedUser,
  EnhancedRoom
} from './enhanced-entities.types';

// ================================
// API Response Types
// ================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
  warnings?: ApiWarning[];
  links?: HATEOASLinks;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
  filters?: FilterInfo;
  sorting?: SortingInfo;
}

/**
 * Real-time update response
 */
export interface RealtimeResponse<T = any> {
  type: 'create' | 'update' | 'delete' | 'batch';
  data: T;
  timestamp: string;
  source: 'api' | 'websocket' | 'sync';
  clientId?: string;
  transactionId?: string;
}

// ================================
// Error Handling Types
// ================================

/**
 * Structured API error
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  field?: string;
  type: 'validation' | 'authorization' | 'server' | 'network' | 'business';
  statusCode: number;
  retryable: boolean;
  retryAfter?: number;
  correlationId?: string;
}

/**
 * API warning (non-fatal issues)
 */
export interface ApiWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Error recovery strategy
 */
export interface ErrorRecoveryStrategy {
  strategy: 'retry' | 'fallback' | 'cache' | 'manual' | 'ignore';
  maxRetries?: number;
  backoffStrategy?: 'exponential' | 'linear' | 'fixed';
  fallbackData?: any;
  userNotification?: {
    show: boolean;
    message?: string;
    action?: string;
  };
}

// ================================
// Synchronization Types
// ================================

/**
 * Data synchronization state
 */
export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'conflict';
  lastSync: string;
  pendingChanges: number;
  conflicts: SyncConflict[];
  strategy: SyncStrategy;
}

/**
 * Synchronization conflict
 */
export interface SyncConflict {
  id: string;
  entity: string;
  field: string;
  localValue: any;
  serverValue: any;
  timestamp: string;
  resolution?: 'local' | 'server' | 'merge' | 'manual';
}

/**
 * Synchronization strategy
 */
export interface SyncStrategy {
  mode: 'realtime' | 'periodic' | 'manual';
  interval?: number;
  conflictResolution: 'auto' | 'manual' | 'last-write-wins' | 'merge';
  batchSize: number;
  retryPolicy: RetryPolicy;
}

/**
 * Offline synchronization queue
 */
export interface OfflineSyncQueue {
  operations: OfflineOperation[];
  maxSize: number;
  persistenceDuration: number;
  autoSync: boolean;
}

/**
 * Offline operation
 */
export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: string;
  retries: number;
  dependencies?: string[];
}

// ================================
// Data Transformation Types
// ================================

/**
 * Data transformer interface
 */
export interface DataTransformer<TInput = any, TOutput = any> {
  transform(input: TInput): TOutput;
  reverse?(output: TOutput): TInput;
  validate?(data: any): boolean;
}

/**
 * Entity mapping configuration
 */
export interface EntityMapping {
  source: string;
  target: string;
  fields: FieldMapping[];
  transformer?: DataTransformer;
  validation?: ValidationRule[];
}

/**
 * Field mapping configuration
 */
export interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: any) => any;
  required?: boolean;
  defaultValue?: any;
}

/**
 * Data normalization schema
 */
export interface NormalizationSchema {
  entities: Record<string, EntitySchema>;
  relationships: RelationshipSchema[];
}

/**
 * Entity schema for normalization
 */
export interface EntitySchema {
  idAttribute: string;
  relationships?: Record<string, RelationshipType>;
  processor?: (entity: any) => any;
}

/**
 * Relationship schema
 */
export interface RelationshipSchema {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  foreignKey: string;
  cascade?: boolean;
}

// ================================
// Caching Types
// ================================

/**
 * Cache configuration
 */
export interface CacheConfig {
  strategy: 'memory' | 'localStorage' | 'indexedDB' | 'hybrid';
  ttl: number;
  maxSize: number;
  compression?: boolean;
  encryption?: boolean;
  keyPattern?: string;
}

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: string;
  ttl: number;
  etag?: string;
  version?: number;
  metadata?: Record<string, any>;
}

/**
 * Cache invalidation strategy
 */
export interface CacheInvalidationStrategy {
  triggers: InvalidationTrigger[];
  strategy: 'immediate' | 'lazy' | 'scheduled';
  cascading?: boolean;
}

/**
 * Cache invalidation trigger
 */
export interface InvalidationTrigger {
  event: string;
  pattern?: string;
  condition?: (data: any) => boolean;
}

// ================================
// API Client Types
// ================================

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  interceptors: InterceptorConfig[];
  headers?: Record<string, string>;
  auth?: AuthConfig;
  cache?: CacheConfig;
}

/**
 * Request interceptor configuration
 */
export interface InterceptorConfig {
  name: string;
  type: 'request' | 'response' | 'error';
  handler: (config: any) => any;
  order: number;
  enabled: boolean;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: 'bearer' | 'basic' | 'oauth' | 'custom';
  tokenKey?: string;
  refreshEndpoint?: string;
  storage?: 'memory' | 'localStorage' | 'sessionStorage';
  autoRefresh?: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'linear' | 'fixed';
  baseDelay: number;
  maxDelay: number;
  retryCondition?: (error: ApiError) => boolean;
}

// ================================
// Real-time Integration Types
// ================================

/**
 * Real-time event subscription
 */
export interface RealtimeSubscription {
  id: string;
  channel: string;
  filters?: Record<string, any>;
  handler: (event: RealtimeEvent) => void;
  errorHandler?: (error: Error) => void;
  reconnectOnError?: boolean;
}

/**
 * Real-time event
 */
export interface RealtimeEvent<T = any> {
  type: string;
  data: T;
  timestamp: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * Real-time connection state
 */
export interface RealtimeConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  reconnectAttempts: number;
  latency?: number;
  subscriptions: RealtimeSubscription[];
}

// ================================
// Data Loading Types
// ================================

/**
 * Data loading state
 */
export interface LoadingState {
  isLoading: boolean;
  isRefreshing: boolean;
  error?: ApiError;
  lastLoaded?: string;
  progress?: number;
}

/**
 * Infinite scroll state
 */
export interface InfiniteScrollState<T = any> {
  items: T[];
  hasMore: boolean;
  isLoading: boolean;
  nextCursor?: string;
  error?: ApiError;
}

/**
 * Search state
 */
export interface SearchState<T = any> {
  query: string;
  results: T[];
  isSearching: boolean;
  totalCount: number;
  facets?: SearchFacet[];
  suggestions?: string[];
}

/**
 * Search facet
 */
export interface SearchFacet {
  name: string;
  values: FacetValue[];
}

/**
 * Facet value
 */
export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// ================================
// Backend Specific Types
// ================================

/**
 * Message API operations
 */
export interface MessageAPI {
  getMessages(roomId: string, params?: MessageQueryParams): Promise<PaginatedResponse<EnhancedMessage>>;
  sendMessage(message: CreateMessageDto): Promise<ApiResponse<EnhancedMessage>>;
  updateMessage(id: string, updates: UpdateMessageDto): Promise<ApiResponse<EnhancedMessage>>;
  deleteMessage(id: string): Promise<ApiResponse<void>>;
  searchMessages(query: string, params?: SearchParams): Promise<PaginatedResponse<EnhancedMessage>>;
  getMessageHistory(messageId: string): Promise<ApiResponse<MessageHistory>>;
}

/**
 * Room API operations
 */
export interface RoomAPI {
  getRooms(params?: RoomQueryParams): Promise<PaginatedResponse<EnhancedRoom>>;
  createRoom(room: CreateRoomDto): Promise<ApiResponse<EnhancedRoom>>;
  updateRoom(id: string, updates: UpdateRoomDto): Promise<ApiResponse<EnhancedRoom>>;
  deleteRoom(id: string): Promise<ApiResponse<void>>;
  joinRoom(roomId: string): Promise<ApiResponse<void>>;
  leaveRoom(roomId: string): Promise<ApiResponse<void>>;
  getRoomMembers(roomId: string): Promise<PaginatedResponse<EnhancedUser>>;
}

/**
 * User API operations
 */
export interface UserAPI {
  getProfile(): Promise<ApiResponse<EnhancedUser>>;
  updateProfile(updates: UpdateUserDto): Promise<ApiResponse<EnhancedUser>>;
  getUsers(params?: UserQueryParams): Promise<PaginatedResponse<EnhancedUser>>;
  searchUsers(query: string): Promise<PaginatedResponse<EnhancedUser>>;
  blockUser(userId: string): Promise<ApiResponse<void>>;
  unblockUser(userId: string): Promise<ApiResponse<void>>;
}

// ================================
// DTO Types
// ================================

/**
 * Create message DTO
 */
export interface CreateMessageDto {
  content: string;
  roomId: string;
  type?: 'text' | 'image' | 'file' | 'system';
  parentId?: string;
  mentions?: string[];
  attachments?: AttachmentDto[];
}

/**
 * Update message DTO
 */
export interface UpdateMessageDto {
  content?: string;
  edited?: boolean;
  editReason?: string;
}

/**
 * Create room DTO
 */
export interface CreateRoomDto {
  name: string;
  description?: string;
  type: 'public' | 'private' | 'direct';
  maxMembers?: number;
  settings?: RoomSettingsDto;
}

/**
 * Update room DTO
 */
export interface UpdateRoomDto {
  name?: string;
  description?: string;
  settings?: Partial<RoomSettingsDto>;
}

/**
 * Update user DTO
 */
export interface UpdateUserDto {
  displayName?: string;
  avatar?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  preferences?: UserPreferencesDto;
}

/**
 * Room settings DTO
 */
export interface RoomSettingsDto {
  allowInvites: boolean;
  allowFileUploads: boolean;
  messageRetentionDays: number;
  moderationLevel: 'none' | 'basic' | 'strict';
}

/**
 * User preferences DTO
 */
export interface UserPreferencesDto {
  notifications: NotificationPreferencesDto;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
}

/**
 * Notification preferences DTO
 */
export interface NotificationPreferencesDto {
  email: boolean;
  push: boolean;
  mentions: boolean;
  directMessages: boolean;
  roomActivity: boolean;
}

/**
 * Attachment DTO
 */
export interface AttachmentDto {
  name: string;
  type: string;
  size: number;
  url?: string;
  data?: string | ArrayBuffer;
}

// ================================
// Query Parameter Types
// ================================

/**
 * Base query parameters
 */
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Message query parameters
 */
export interface MessageQueryParams extends BaseQueryParams {
  before?: string;
  after?: string;
  search?: string;
  type?: string;
  userId?: string;
}

/**
 * Room query parameters
 */
export interface RoomQueryParams extends BaseQueryParams {
  type?: 'public' | 'private' | 'direct';
  member?: boolean;
  search?: string;
}

/**
 * User query parameters
 */
export interface UserQueryParams extends BaseQueryParams {
  status?: 'online' | 'away' | 'busy' | 'offline';
  search?: string;
  role?: string;
}

/**
 * Search parameters
 */
export interface SearchParams extends BaseQueryParams {
  highlight?: boolean;
  facets?: string[];
  filters?: Record<string, any>;
}

// ================================
// Utility Types
// ================================

/**
 * Response metadata
 */
export interface ResponseMetadata {
  requestId: string;
  timestamp: string;
  processingTime: number;
  version: string;
  rateLimit?: RateLimitInfo;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: string;
  retryAfter?: number;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Filter information
 */
export interface FilterInfo {
  active: Record<string, any>;
  available: FilterOption[];
}

/**
 * Filter option
 */
export interface FilterOption {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'boolean';
  options?: SelectOption[];
}

/**
 * Select option
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Sorting information
 */
export interface SortingInfo {
  field: string;
  order: 'asc' | 'desc';
  available: SortOption[];
}

/**
 * Sort option
 */
export interface SortOption {
  field: string;
  label: string;
  defaultOrder?: 'asc' | 'desc';
}

/**
 * HATEOAS links
 */
export interface HATEOASLinks {
  self?: Link;
  next?: Link;
  prev?: Link;
  first?: Link;
  last?: Link;
  related?: Record<string, Link>;
}

/**
 * HATEOAS link
 */
export interface Link {
  href: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  type?: string;
  title?: string;
}

/**
 * Message history entry
 */
export interface MessageHistory {
  id: string;
  messageId: string;
  version: number;
  content: string;
  editedAt: string;
  editedBy: string;
  editReason?: string;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  field: string;
  rule: string;
  value?: any;
  message: string;
}

/**
 * Relationship type
 */
export type RelationshipType = 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

// ================================
// Type Guards
// ================================

/**
 * Type guard for API response
 */
export function isApiResponse<T>(obj: any): obj is ApiResponse<T> {
  return obj && typeof obj.success === 'boolean';
}

/**
 * Type guard for paginated response
 */
export function isPaginatedResponse<T>(obj: any): obj is PaginatedResponse<T> {
  return isApiResponse(obj) && 'pagination' in obj && typeof (obj as any).pagination === 'object';
}

/**
 * Type guard for API error
 */
export function isApiError(obj: any): obj is ApiError {
  return obj && typeof obj.code === 'string' && typeof obj.message === 'string';
}

/**
 * Type guard for realtime event
 */
export function isRealtimeEvent<T>(obj: any): obj is RealtimeEvent<T> {
  return obj && typeof obj.type === 'string' && obj.data !== undefined;
}
