/**
 * @fileoverview Enterprise Store Type Definitions
 * @description Comprehensive type definitions for Pinia stores with enterprise features
 * including optimistic updates, caching, synchronization, and state management
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { EnhancedUser, EnhancedMessage, EnhancedRoom, EnhancedAttachment } from './enhanced-entities.types';
import type { UserSession, AuthenticationState } from './advanced-services.types';
import type { WebSocketStoreState } from './websocket-enterprise.types';

// =============================================================================
// BASE STORE TYPES
// =============================================================================

/**
 * Store State Status
 */
export type StoreStateStatus = 'idle' | 'loading' | 'success' | 'error' | 'stale';

/**
 * Store Operation Type
 */
export type StoreOperationType = 'create' | 'read' | 'update' | 'delete' | 'sync' | 'cache';

/**
 * Optimistic Update
 */
export interface OptimisticUpdate<T = any> {
  /** Unique update identifier */
  id: string;
  /** Operation type */
  operation: StoreOperationType;
  /** Target entity type */
  entityType: string;
  /** Entity identifier */
  entityId: string;
  /** Original data before update */
  originalData: T;
  /** Optimistic data */
  optimisticData: T;
  /** Update timestamp */
  timestamp: Date;
  /** Server confirmation status */
  confirmed: boolean;
  /** Error if update failed */
  error?: {
    message: string;
    code: string;
    retryable: boolean;
  };
  /** Retry count */
  retryCount: number;
  /** Maximum retry attempts */
  maxRetries: number;
}

/**
 * Store Cache Entry
 */
export interface StoreCacheEntry<T = any> {
  /** Cache key */
  key: string;
  /** Cached data */
  data: T;
  /** Cache timestamp */
  timestamp: Date;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Cache tags for invalidation */
  tags: string[];
  /** Cache hit count */
  hitCount: number;
  /** Last access timestamp */
  lastAccess: Date;
  /** Cache source */
  source: 'server' | 'optimistic' | 'fallback';
}

/**
 * Store Synchronization Status
 */
export interface StoreSyncStatus {
  /** Last successful sync timestamp */
  lastSync: Date;
  /** Sync in progress */
  syncing: boolean;
  /** Pending changes count */
  pendingChanges: number;
  /** Sync error if any */
  error?: string;
  /** Next scheduled sync */
  nextSync?: Date;
  /** Sync strategy */
  strategy: 'manual' | 'auto' | 'realtime';
}

/**
 * Base Store State
 */
export interface BaseStoreState {
  /** Store status */
  status: StoreStateStatus;
  /** Error information */
  error: string | null;
  /** Loading states for different operations */
  loading: Record<string, boolean>;
  /** Optimistic updates queue */
  optimisticUpdates: Map<string, OptimisticUpdate>;
  /** Cache management */
  cache: {
    entries: Map<string, StoreCacheEntry>;
    size: number;
    maxSize: number;
    hitRate: number;
    missRate: number;
  };
  /** Synchronization status */
  sync: StoreSyncStatus;
  /** Store metadata */
  metadata: {
    initialized: boolean;
    lastActivity: Date;
    version: number;
    storeSize: number;
  };
}

/**
 * Store Action Context
 */
export interface StoreActionContext {
  /** Action name */
  action: string;
  /** Action parameters */
  params?: Record<string, any>;
  /** Action timestamp */
  timestamp: Date;
  /** User context */
  user?: EnhancedUser;
  /** Request correlation ID */
  correlationId?: string;
  /** Action metadata */
  metadata?: Record<string, any>;
}

/**
 * Store Event
 */
export interface StoreEvent {
  /** Event type */
  type: string;
  /** Event payload */
  payload: any;
  /** Event timestamp */
  timestamp: Date;
  /** Event source store */
  store: string;
  /** Event correlation ID */
  correlationId?: string;
}

// =============================================================================
// AUTHENTICATION STORE
// =============================================================================

/**
 * Authentication Store State
 */
export interface AuthStoreState extends BaseStoreState {
  /** Current authentication state */
  authState: AuthenticationState;
  /** Current user session */
  session: UserSession | null;
  /** Current user (convenience property) */
  user: EnhancedUser | null;
  /** Authentication tokens */
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  };
  /** Login attempt tracking */
  loginAttempts: {
    count: number;
    lastAttempt: Date | null;
    blockedUntil: Date | null;
  };
  /** Session management */
  sessions: {
    current: string | null;
    all: UserSession[];
    lastRefresh: Date | null;
  };
  /** Security context */
  security: {
    riskScore: number;
    trustLevel: 'low' | 'medium' | 'high';
    mfaRequired: boolean;
    lastSecurityCheck: Date | null;
  };
  /** User preferences */
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: Record<string, boolean>;
    privacy: Record<string, any>;
  };
}

/**
 * Authentication Store Actions
 */
export interface AuthStoreActions {
  /** User authentication */
  login(credentials: { email: string; password: string; mfaCode?: string }): Promise<UserSession>;
  /** User registration */
  register(userData: { email: string; username: string; password: string }): Promise<UserSession>;
  /** User logout */
  logout(options?: { terminateAllSessions?: boolean }): Promise<void>;
  /** Token refresh */
  refreshToken(): Promise<void>;
  /** Password change */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /** Profile update */
  updateProfile(updates: Partial<EnhancedUser>): Promise<EnhancedUser>;
  /** Session management */
  terminateSession(sessionId: string): Promise<void>;
  /** Security operations */
  validateSession(): Promise<boolean>;
  /** Preference management */
  updatePreferences(preferences: Partial<AuthStoreState['preferences']>): Promise<void>;
}

/**
 * Authentication Store Getters
 */
export interface AuthStoreGetters {
  /** Check if user is authenticated */
  isAuthenticated: boolean;
  /** Check if tokens are valid */
  hasValidTokens: boolean;
  /** Get user roles */
  userRoles: string[];
  /** Get user permissions */
  userPermissions: string[];
  /** Check specific permission */
  hasPermission: (permission: string) => boolean;
  /** Check specific role */
  hasRole: (role: string) => boolean;
  /** Get security status */
  securityStatus: 'secure' | 'at_risk' | 'compromised';
  /** Get session expiry */
  sessionExpiresIn: number | null;
}

// =============================================================================
// CHAT STORE
// =============================================================================

/**
 * Chat Store State
 */
export interface ChatStoreState extends BaseStoreState {
  /** Current active room */
  activeRoom: string | null;
  /** Joined rooms */
  joinedRooms: Set<string>;
  /** Room data cache */
  rooms: Map<string, EnhancedRoom>;
  /** Messages cache organized by room */
  messages: Map<string, Map<string, EnhancedMessage>>;
  /** Message drafts */
  drafts: Map<string, {
    content: string;
    lastModified: Date;
    attachments: EnhancedAttachment[];
  }>;
  /** Typing indicators */
  typing: Map<string, {
    users: Set<string>;
    lastUpdate: Date;
  }>;
  /** Message search results */
  searchResults: {
    query: string;
    results: EnhancedMessage[];
    timestamp: Date;
    hasMore: boolean;
  } | null;
  /** Unread message counts */
  unreadCounts: Map<string, number>;
  /** Message pagination info */
  pagination: Map<string, {
    hasMore: boolean;
    cursor: string | null;
    loading: boolean;
  }>;
  /** Real-time connection status */
  connection: {
    connected: boolean;
    lastPing: Date | null;
    reconnecting: boolean;
    reconnectAttempts: number;
  };
}

/**
 * Chat Store Actions
 */
export interface ChatStoreActions {
  /** Room management */
  joinRoom(roomId: string): Promise<void>;
  leaveRoom(roomId: string): Promise<void>;
  createRoom(roomData: Partial<EnhancedRoom>): Promise<EnhancedRoom>;
  updateRoom(roomId: string, updates: Partial<EnhancedRoom>): Promise<EnhancedRoom>;
  deleteRoom(roomId: string): Promise<void>;

  /** Message operations */
  sendMessage(roomId: string, content: string, options?: {
    replyTo?: string;
    attachments?: EnhancedAttachment[];
    metadata?: Record<string, any>;
  }): Promise<EnhancedMessage>;
  editMessage(messageId: string, content: string): Promise<EnhancedMessage>;
  deleteMessage(messageId: string): Promise<void>;
  reactToMessage(messageId: string, emoji: string): Promise<void>;
  
  /** Message loading */
  loadMessages(roomId: string, options?: {
    limit?: number;
    before?: string;
    after?: string;
  }): Promise<EnhancedMessage[]>;
  loadMoreMessages(roomId: string): Promise<EnhancedMessage[]>;
  
  /** Search functionality */
  searchMessages(query: string, options?: {
    roomId?: string;
    dateRange?: { start: Date; end: Date };
    messageType?: string;
  }): Promise<EnhancedMessage[]>;
  
  /** Draft management */
  saveDraft(roomId: string, content: string, attachments?: EnhancedAttachment[]): Promise<void>;
  loadDraft(roomId: string): Promise<string>;
  clearDraft(roomId: string): Promise<void>;
  
  /** Typing indicators */
  setTyping(roomId: string, isTyping: boolean): Promise<void>;
  
  /** Utility functions */
  markAsRead(roomId: string, messageId?: string): Promise<void>;
  clearUnreadCount(roomId: string): Promise<void>;
}

/**
 * Chat Store Getters
 */
export interface ChatStoreGetters {
  /** Get room by ID */
  getRoomById: (roomId: string) => EnhancedRoom | undefined;
  /** Get messages for room */
  getMessagesForRoom: (roomId: string) => EnhancedMessage[];
  /** Get latest message for room */
  getLatestMessage: (roomId: string) => EnhancedMessage | undefined;
  /** Get unread count for room */
  getUnreadCount: (roomId: string) => number;
  /** Get total unread count */
  totalUnreadCount: number;
  /** Get typing users for room */
  getTypingUsers: (roomId: string) => string[];
  /** Get draft for room */
  getDraft: (roomId: string) => string;
  /** Check if room has more messages */
  hasMoreMessages: (roomId: string) => boolean;
  /** Get connection status */
  isConnected: boolean;
}

// =============================================================================
// UI STORE
// =============================================================================

/**
 * UI Store State
 */
export interface UIStoreState extends BaseStoreState {
  /** Theme configuration */
  theme: {
    mode: 'light' | 'dark' | 'auto';
    primary: string;
    accent: string;
    customColors: Record<string, string>;
  };
  /** Layout configuration */
  layout: {
    sidebarCollapsed: boolean;
    chatPanelWidth: number;
    userListVisible: boolean;
    compactMode: boolean;
  };
  /** Modal and dialog state */
  modals: Map<string, {
    visible: boolean;
    data?: any;
    options?: Record<string, any>;
  }>;
  /** Notification state */
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    autoClose: boolean;
    duration?: number;
  }>;
  /** Loading indicators */
  loadingStates: Map<string, boolean>;
  /** Error messages */
  errors: Map<string, {
    message: string;
    timestamp: Date;
    dismissed: boolean;
  }>;
  /** User preferences */
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    timeFormat: '12h' | '24h';
    fontSize: 'small' | 'medium' | 'large';
    messageGrouping: boolean;
    showTimestamps: boolean;
    enableSounds: boolean;
    enableAnimations: boolean;
  };
  /** Accessibility settings */
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
    fontSize: number;
  };
}

/**
 * UI Store Actions
 */
export interface UIStoreActions {
  /** Theme management */
  setTheme(theme: Partial<UIStoreState['theme']>): void;
  toggleTheme(): void;
  
  /** Layout management */
  toggleSidebar(): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setChatPanelWidth(width: number): void;
  toggleUserList(): void;
  setCompactMode(compact: boolean): void;
  
  /** Modal management */
  showModal(id: string, data?: any, options?: Record<string, any>): void;
  hideModal(id: string): void;
  closeAllModals(): void;
  
  /** Notification management */
  showNotification(notification: Omit<UIStoreState['notifications'][0], 'id' | 'timestamp'>): string;
  hideNotification(id: string): void;
  clearNotifications(): void;
  
  /** Loading state management */
  setLoading(key: string, loading: boolean): void;
  clearLoading(): void;
  
  /** Error management */
  setError(key: string, message: string): void;
  clearError(key: string): void;
  clearAllErrors(): void;
  
  /** Preference management */
  updatePreferences(preferences: Partial<UIStoreState['preferences']>): void;
  updateAccessibility(settings: Partial<UIStoreState['accessibility']>): void;
  resetToDefaults(): void;
}

/**
 * UI Store Getters
 */
export interface UIStoreGetters {
  /** Current theme values */
  currentTheme: UIStoreState['theme'];
  /** Check if modal is visible */
  isModalVisible: (id: string) => boolean;
  /** Get modal data */
  getModalData: (id: string) => any;
  /** Check if loading */
  isLoading: (key?: string) => boolean;
  /** Get error message */
  getError: (key: string) => string | undefined;
  /** Get notification count */
  notificationCount: number;
  /** Get accessibility status */
  accessibilityEnabled: boolean;
}

// =============================================================================
// WEBSOCKET STORE
// =============================================================================

/**
 * WebSocket Store (extends base WebSocket types)
 */
export interface WebSocketStore extends WebSocketStoreState {
  /** Enhanced connection management */
  connection: {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
    lastConnected: Date | null;
    disconnectedAt: Date | null;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    reconnectDelay: number;
  };
  /** Performance monitoring */
  performance: {
    latency: number;
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    lastPingTime: number;
  };
  /** Event queue for offline scenarios */
  eventQueue: Array<{
    event: string;
    data: any;
    timestamp: Date;
    attempts: number;
  }>;
}

// =============================================================================
// STORE COMPOSITION AND MANAGEMENT
// =============================================================================

/**
 * Store Registry
 */
export interface StoreRegistry {
  auth: AuthStoreState & AuthStoreActions & AuthStoreGetters;
  chat: ChatStoreState & ChatStoreActions & ChatStoreGetters;
  ui: UIStoreState & UIStoreActions & UIStoreGetters;
  websocket: WebSocketStore;
}

/**
 * Store Configuration
 */
export interface StoreConfig {
  /** Enable persistence */
  persistence: {
    enabled: boolean;
    storage: 'localStorage' | 'sessionStorage' | 'indexedDB';
    key: string;
    encrypt: boolean;
    include: (keyof StoreRegistry)[];
    exclude: string[];
  };
  /** Caching configuration */
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
    strategy: 'lru' | 'ttl' | 'manual';
  };
  /** Synchronization configuration */
  sync: {
    enabled: boolean;
    strategy: 'manual' | 'auto' | 'realtime';
    interval: number;
    conflictResolution: 'client' | 'server' | 'manual';
  };
  /** Development configuration */
  devtools: {
    enabled: boolean;
    logActions: boolean;
    logMutations: boolean;
    trace: boolean;
  };
}

/**
 * Store Plugin Interface
 */
export interface StorePlugin {
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin installation function */
  install(store: any, options?: Record<string, any>): void;
  /** Plugin cleanup function */
  uninstall?(store: any): void;
}

/**
 * Store Event Bus
 */
export interface StoreEventBus {
  /** Subscribe to store events */
  on(event: string, handler: (payload: any) => void): void;
  /** Unsubscribe from store events */
  off(event: string, handler?: (payload: any) => void): void;
  /** Emit store event */
  emit(event: string, payload?: any): void;
  /** Subscribe once */
  once(event: string, handler: (payload: any) => void): void;
}

/**
 * Store Manager Interface
 */
export interface StoreManager {
  /** Store registry */
  stores: StoreRegistry;
  /** Store configuration */
  config: StoreConfig;
  /** Event bus */
  events: StoreEventBus;
  
  /** Initialize stores */
  initialize(): Promise<void>;
  /** Dispose stores */
  dispose(): Promise<void>;
  /** Reset all stores */
  reset(): Promise<void>;
  
  /** Plugin management */
  use(plugin: StorePlugin, options?: Record<string, any>): void;
  
  /** Persistence management */
  persist(): Promise<void>;
  restore(): Promise<void>;
  
  /** Cache management */
  clearCache(storeNames?: (keyof StoreRegistry)[]): void;
  
  /** Synchronization */
  sync(storeNames?: (keyof StoreRegistry)[]): Promise<void>;
  
  /** Development tools */
  enableDevtools(): void;
  disableDevtools(): void;
}
