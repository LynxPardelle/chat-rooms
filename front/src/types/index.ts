// ================================
// Core Application Types
// ================================

// Basic types for the chat application
export interface User {
  id?: string;
  username: string;
  email?: string;
  avatar?: string;
  textColor?: string;
  backgroundColor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Message {
  id?: string;
  content: string;
  userId: string;
  username: string;
  timestamp: Date;
  isEdited?: boolean;
  editedAt?: Date;
  textColor?: string;
  backgroundColor?: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
}

// Utility types
export type UserWithoutId = Omit<User, 'id'>;
export type MessageWithoutId = Omit<Message, 'id'>;

// Application state for reference in stores
export interface AppState {
  isLoading: boolean;
  error: string | null;
}

// ================================
// Enhanced Enterprise Types
// ================================

// Enhanced entities with enterprise features
export * from './enhanced-entities.types';

// Enterprise configuration and settings
export * from './enterprise-config.types';

// WebSocket enterprise types for real-time communication
export * from './websocket-enterprise.types';

// Advanced services for enterprise functionality
export * from './advanced-services.types';

// Advanced security and authorization types
export type {
  RouteGuardType,
  RouteGuardResult,
  RouteGuardContext,
  RouteGuardConfig,
  RouteGuardInterface,
  Permission,
  Role,
  ACLEntry,
  AccessControlDecision,
  AuthorizationContext,
  AuthorizationServiceInterface,
  SecurityThreatLevel,
  SecurityEventType,
  SecurityEvent as SecurityAuditEvent,
  SecurityRule,
  RiskAssessment,
  SecurityMetrics,
  SecurityMonitorInterface,
  EncryptionAlgorithm,
  EncryptionKey,
  EncryptedData
} from './advanced-security.types';

// Enterprise store types for state management
export * from './enterprise-stores.types';

// Enterprise UI components and theming
export * from './enterprise-ui.types';

// Advanced form management types
export type {
  ValidationRuleType,
  ValidationSeverity,
  ValidationRule as FormValidationRule,
  ValidationResult as FormValidationResult,
  FieldValidationState,
  FieldDataType,
  FieldInputType,
  FieldConfig,
  FieldState,
  FormState,
  FormConfig,
  FormEvent,
  FormHistoryEntry,
  DynamicFieldAction,
  DynamicFieldRule,
  FormSection,
  FormWizardStep,
  FormSubmissionResult,
  FormDataTransformer,
  FormApiIntegration,
  FormLifecycleHooks
} from './advanced-forms.types';

// Backend integration and API types
export type {
  ApiResponse as BackendApiResponse,
  PaginatedResponse,
  RealtimeResponse,
  ApiError as BackendApiError,
  ApiWarning,
  ErrorRecoveryStrategy,
  SyncState,
  SyncConflict,
  SyncStrategy,
  OfflineSyncQueue,
  OfflineOperation,
  DataTransformer,
  EntityMapping,
  FieldMapping,
  NormalizationSchema,
  EntitySchema,
  RelationshipSchema,
  CacheConfig as BackendCacheConfig,
  CacheEntry as BackendCacheEntry,
  CacheInvalidationStrategy,
  InvalidationTrigger,
  HttpClientConfig,
  InterceptorConfig,
  AuthConfig,
  RetryPolicy,
  RealtimeSubscription,
  RealtimeEvent,
  RealtimeConnectionState,
  LoadingState,
  InfiniteScrollState,
  SearchState,
  SearchFacet,
  FacetValue,
  MessageAPI,
  RoomAPI,
  UserAPI,
  CreateMessageDto,
  UpdateMessageDto,
  CreateRoomDto,
  UpdateRoomDto,
  UpdateUserDto,
  RoomSettingsDto,
  UserPreferencesDto,
  NotificationPreferencesDto,
  AttachmentDto,
  BaseQueryParams,
  MessageQueryParams,
  RoomQueryParams,
  UserQueryParams,
  SearchParams,
  ResponseMetadata,
  RateLimitInfo,
  PaginationInfo,
  FilterInfo,
  FilterOption,
  SelectOption,
  SortingInfo,
  SortOption,
  HATEOASLinks,
  Link,
  MessageHistory,
  ValidationRule as BackendValidationRule,
  RelationshipType
} from './backend-integration.types';

// Enterprise utility types and helpers
export type {
  DeepPartial,
  DeepRequired,
  DeepReadonly,
  PartialBy,
  RequiredBy,
  NonNullable,
  NonNullableProperties,
  KeysOfType,
  KeysNotOfType,
  PropertiesOfType,
  PropertiesNotOfType,
  FunctionParameters,
  FunctionReturnType,
  OptionalParameters,
  AsyncFunction,
  EventHandler,
  AsyncEventHandler,
  ErrorCallback,
  ArrayElement,
  ObjectValues,
  Tuple,
  Length,
  Head,
  Tail,
  Flatten,
  KeysAsUnion,
  ValuesAsUnion,
  Capitalize,
  Uncapitalize,
  CamelCase,
  SnakeCase,
  KebabCase,
  Split,
  Join,
  Brand,
  UserId,
  RoomId,
  MessageId,
  SessionId,
  Token,
  Email,
  URL,
  Timestamp,
  Currency,
  Percentage,
  IsAny,
  IsNever,
  IsUnknown,
  IsExact,
  IsEmptyObject,
  IsArray,
  IsFunction,
  IsPromise,
  HttpMethod as UtilHttpMethod,
  HttpStatusCode,
  EventName,
  ApiEndpoint,
  SocketEvent,
  CssClassName,
  EnvVar,
  Nullable,
  DeepNullable,
  Mutable,
  DeepMutable,
  PrefixKeys,
  SuffixKeys,
  TransformKeys,
  DiscriminatedUnion,
  ExhaustiveCheck,
  Overload,
  UnionToIntersection,
  LastOfUnion,
  UnionToTuple,
  Paths,
  PathValue,
  ValidationResult as UtilValidationResult,
  ValidationError,
  ValidationWarning,
  Validator,
  AsyncValidator,
  SchemaValidator,
  SchemaDefinition,
  TypeMetadata,
  ApiEndpointMetadata,
  ParameterMetadata,
  SecurityRequirement,
  OAuthFlows,
  OAuthFlow,
  TypedEventEmitter,
  TypedStore,
  TypedConfig
} from './enterprise-utils.types';
