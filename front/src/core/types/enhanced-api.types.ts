/**
 * Enhanced API Types for Frontend
 * Consistent with backend DTOs and entities
 */

// =====================================
// Authentication Types
// =====================================

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  username: string;
  email: string;
  password: string;
  textColor?: string;
  backgroundColor?: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type UserResponse = {
  id: string;
  username: string;
  email: string;
  textColor: string;
  backgroundColor: string;
  isOnline: boolean;
  lastSeen: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
};

// =====================================
// Message Types (from backend entities)
// =====================================

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE',
} as const;

export type MessageTypeEnum = typeof MessageType[keyof typeof MessageType];

export const UserStatus = {
  ONLINE: 'ONLINE',
  AWAY: 'AWAY',
  BUSY: 'BUSY',
  OFFLINE: 'OFFLINE',
} as const;

export type UserStatusEnum = typeof UserStatus[keyof typeof UserStatus];

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
  userId: string;
  emoji: string;
  timestamp: Date;
};

export type MessageMetadata = {
  [key: string]: any;
};

export type Message = {
  id: string;
  content: string;
  userId: string;
  roomId: string;
  messageType: MessageTypeEnum;
  attachments: MessageAttachment[];
  metadata: MessageMetadata;
  reactions: MessageReaction[];
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type CreateMessageRequest = {
  content: string;
  messageType?: MessageTypeEnum;
  attachments?: string[];
  metadata?: MessageMetadata;
};

export type UpdateMessageRequest = {
  content?: string;
  metadata?: MessageMetadata;
};

// =====================================
// API Response Wrappers
// =====================================

export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
};

export type PaginatedResponse<T = any> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type SearchResponse<T = any> = {
  items: T[];
  query: string;
  totalResults: number;
  searchTime: number;
  facets?: Record<string, any>;
};

// =====================================
// WebSocket Event Types (from WEBSOCKET_API.md)
// =====================================

export const WebSocketEvent = {
  // Client to Server
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  SEND_MESSAGE: 'sendMessage',
  TYPING: 'typing',
  GET_ROOM_STATS: 'getRoomStats',
  HEARTBEAT: 'heartbeat',
  
  // New Enhanced Chat State Events
  USER_START_TYPING: 'userStartTyping',
  USER_STOP_TYPING: 'userStopTyping',
  USER_PRESENCE_UPDATE: 'userPresenceUpdate',
  MESSAGE_READ: 'messageRead',
  USER_JOINED_ROOM: 'userJoinedRoom',
  USER_LEFT_ROOM: 'userLeftRoom',
  
  // Server to Client
  JOINED_ROOM: 'joinedRoom',
  LEFT_ROOM: 'leftRoom',
  MESSAGE_SENT: 'messageSent',
  RECEIVE_MESSAGE: 'receiveMessage',
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  TYPING_UPDATED: 'typingUpdated',
  ROOM_STATS_RETRIEVED: 'roomStatsRetrieved',
  HEARTBEAT_RESPONSE: 'heartbeatResponse',
  
  // New Enhanced Chat State Server Events
  TYPING_INDICATOR_UPDATED: 'typingIndicatorUpdated',
  PRESENCE_UPDATED: 'presenceUpdated',
  READ_RECEIPT_UPDATED: 'readReceiptUpdated',
  NOTIFICATION_RECEIVED: 'notificationReceived',
  USER_ROOM_JOINED: 'userRoomJoined',
  USER_ROOM_LEFT: 'userRoomLeft',
  
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_ERROR: 'reconnect_error',
  RECONNECT_FAILED: 'reconnect_failed',
} as const;

export type WebSocketEventType = typeof WebSocketEvent[keyof typeof WebSocketEvent];

// WebSocket Event Payloads
export type JoinRoomPayload = {
  roomId: string;
};

export type LeaveRoomPayload = {
  roomId: string;
};

export type SendMessagePayload = {
  content: string;
  messageType?: MessageTypeEnum;
};

export type TypingPayload = {
  roomId: string;
  isTyping: boolean;
};

export type GetRoomStatsPayload = {
  roomId: string;
};

// New Enhanced Chat State Payloads
export type UserStartTypingPayload = {
  roomId: string;
  userId: string;
};

export type UserStopTypingPayload = {
  roomId: string;
  userId: string;
};

export type UserPresenceUpdatePayload = {
  status: 'online' | 'away' | 'busy' | 'offline';
  customMessage?: string;
};

export type MessageReadPayload = {
  messageId: string;
  roomId: string;
  userId: string;
};

export type UserJoinedRoomPayload = {
  roomId: string;
  userId: string;
};

export type UserLeftRoomPayload = {
  roomId: string;
  userId: string;
};

// Enhanced Chat State Response Types
export type TypingIndicatorResponse = {
  roomId: string;
  userId: string;
  username: string;
  isTyping: boolean;
  timestamp: number;
};

export type PresenceUpdateResponse = {
  userId: string;
  username: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: string;
  customMessage?: string;
};

export type ReadReceiptResponse = {
  messageId: string;
  roomId: string;
  userId: string;
  username: string;
  readAt: string;
};

export type NotificationResponse = {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'reaction' | 'room_invite';
  title: string;
  body: string;
  data?: Record<string, any>;
  createdAt: string;
};

export type UserRoomJoinedResponse = {
  roomId: string;
  userId: string;
  username: string;
  joinedAt: string;
};

export type UserRoomLeftResponse = {
  roomId: string;
  userId: string;
  username: string;
  leftAt: string;
};

// WebSocket Response Types
export type SocketResponse<T = any> = {
  event: string;
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    statusCode?: number;
  };
  timestamp: string;
};

export type SocketErrorResponse = {
  success: false;
  error: string;
  statusCode: number;
  timestamp: string;
};

// =====================================
// State Management Types
// =====================================

export type AuthState = {
  isAuthenticated: boolean;
  user: UserResponse | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
  };
  loading: boolean;
  error: string | null;
};

export type ChatState = {
  messages: Message[];
  currentRoom: string | null;
  onlineUsers: UserResponse[];
  typingUsers: string[];
  loading: boolean;
  error: string | null;
  connected: boolean;
};

export type UIState = {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  notifications: Notification[];
  modals: {
    [key: string]: boolean;
  };
  loading: {
    [key: string]: boolean;
  };
};

export type Notification = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
  createdAt: Date;
};

export type NotificationAction = {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
};

// =====================================
// Utility Types
// =====================================

export type EntityId = string;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredField<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type BaseEntity = {
  id: EntityId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
};

export type CreateRequest<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type UpdateRequest<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>>;

// =====================================
// HTTP Client Types
// =====================================

export type RequestConfig = {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  cache?: boolean;
  dedupe?: boolean;
};

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestInfo = {
  method: RequestMethod;
  url: string;
  data?: any;
  config?: RequestConfig;
  timestamp: number;
  requestId: string;
};

// =====================================
// API Service Types
// =====================================

export type ApiRequestConfig = {
  timeout?: number;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  retry?: RetryConfig;
  cache?: boolean;
  dedupe?: boolean;
};

export type RetryConfig = {
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
};

export type RequestInterceptor = {
  onFulfilled?: (config: any) => any | Promise<any>;
  onRejected?: (error: any) => any;
};

export type ResponseInterceptor = {
  onFulfilled?: (response: any) => any | Promise<any>;
  onRejected?: (error: any) => any;
};

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
  data?: any;
  timestamp: string;
  requestId?: string;
};

export type RefreshTokenResponse = {
  accessToken: string;
  refreshToken?: string;
};

// =====================================
// Error Types
// =====================================

export const ErrorCode = {
  // Network Errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  
  // Authentication Errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  
  // Validation Errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_GATEWAY: 'BAD_GATEWAY',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Business Logic Errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  OPERATION_FAILED: 'OPERATION_FAILED',
  
  // WebSocket Errors
  WEBSOCKET_CONNECTION_FAILED: 'WEBSOCKET_CONNECTION_FAILED',
  WEBSOCKET_AUTHENTICATION_FAILED: 'WEBSOCKET_AUTHENTICATION_FAILED',
  WEBSOCKET_RATE_LIMITED: 'WEBSOCKET_RATE_LIMITED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

export type AppError = {
  code: ErrorCodeType;
  message: string;
  details?: any;
  timestamp: Date;
  requestId?: string;
  stackTrace?: string;
  userMessage?: string;
  recoverable: boolean;
  retryable: boolean;
};

// =====================================
// Configuration Types
// =====================================

export type Environment = 'development' | 'production' | 'test';

export type PerformanceMetrics = {
  requestDuration: number;
  responseSize: number;
  timestamp: Date;
  endpoint: string;
  method: RequestMethod;
  statusCode: number;
  success: boolean;
};

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: Date;
  component: string;
  userId?: string;
  requestId?: string;
};

// =====================================
// Storage Types
// =====================================

export type StorageType = 'localStorage' | 'sessionStorage' | 'memory';

export type StorageItem<T = any> = {
  value: T;
  expiresAt?: Date;
  encrypted: boolean;
  metadata?: {
    createdAt: Date;
    accessCount: number;
    lastAccessed: Date;
  };
};

export type StorageQuota = {
  used: number;
  available: number;
  total: number;
  percentage: number;
};

// =====================================
// Export all types
// =====================================

export type {
  // Re-export common types for convenience
  LoginRequest as LoginDto,
  RegisterRequest as RegisterDto,
  RefreshTokenRequest as RefreshTokenDto,
  UserResponse as UserResponseDto,
  TokenResponse as TokenResponseDto,
  Message as MessageEntity,
  CreateMessageRequest as CreateMessageDto,
  UpdateMessageRequest as UpdateMessageDto,
};
