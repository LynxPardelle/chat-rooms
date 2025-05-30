// Core types for API integration - consistent with backend
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  avatarUrl?: string;
  textColor?: string;
  backgroundColor?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithoutPassword extends Omit<User, 'password'> {}

export interface Message {
  id: string;
  content: string;
  userId: string;
  roomId: string;
  messageType: MessageType;
  attachments?: Attachment[];
  reactions?: Reaction[];
  isEdited?: boolean;
  editedAt?: Date;
  createdAt: Date;
  deletedAt?: Date;
}

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  FILE: 'FILE'
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface Reaction {
  userId: string;
  emoji: string;
  timestamp: Date;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  maxUsers?: number;
  createdBy: string;
  createdAt: Date;
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  textColor?: string;
  backgroundColor?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: UserWithoutPassword;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
}

// API Response Wrappers
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// WebSocket Event Types
export interface WebSocketEvent<T = any> {
  event: string;
  data?: T;
  success?: boolean;
  timestamp?: string;
}

// WebSocket Payloads (from WEBSOCKET_API.md)
export interface JoinRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface SendMessagePayload {
  content: string;
  messageType?: MessageType;
}

export interface TypingPayload {
  roomId: string;
  isTyping: boolean;
}

export interface GetRoomStatsPayload {
  roomId: string;
}

export interface ReceiveMessagePayload {
  id: string;
  updatedAt: string;
}

export interface UserJoinedPayload {
  userId: string;
  timestamp: string;
}

export interface RoomStatsPayload {
  roomId: string;
  userCount: number;
  typingUsers: string[];
  lastActivity: string;
}

// Connection States
export const ConnectionState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error'
} as const;

export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState];

// Error Types
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// Storage Types
export interface StorageItem<T = any> {
  value: T;
  expiry?: number;
  encrypted?: boolean;
}

// Authentication State
export interface AuthState {
  isAuthenticated: boolean;
  user: UserWithoutPassword | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  lastActivity: Date | null;
}

// Chat State
export interface ChatState {
  currentRoom: Room | null;
  messages: Message[];
  users: UserWithoutPassword[];
  typingUsers: string[];
  connectionState: ConnectionState;
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
}

// UI State
export interface UIState {
  isLoading: boolean;
  notifications: Notification[];
  modals: {
    isProfileOpen: boolean;
    isSettingsOpen: boolean;
    isUploadOpen: boolean;
  };
  theme: 'light' | 'dark';
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

// Generic utility types
export type EntityId = string;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredField<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Request options
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
  useAuth?: boolean;
}

// Retry configuration
export interface RetryConfig {
  attempts: number;
  delay: number;
  backoff?: 'exponential' | 'linear';
  maxDelay?: number;
}

// Export all constants and enums
