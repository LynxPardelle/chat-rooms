/**
 * @fileoverview Enterprise-grade WebSocket type definitions
 * @description Comprehensive type definitions for WebSocket communication, 
 * connection management, and real-time features based on WEBSOCKET_API.md
 * @version 1.0.0
 * @author Chat Rooms Development Team
 */

import type { EnhancedUser, EnhancedMessage, EnhancedRoom } from './enhanced-entities.types';

/**
 * WebSocket Connection States
 */
export type WebSocketConnectionState = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'failed' 
  | 'idle';

/**
 * WebSocket Quality Metrics
 */
export interface WebSocketQualityMetrics {
  /** Connection latency in milliseconds */
  latency: number;
  /** Packet loss percentage */
  packetLoss: number;
  /** Connection stability score (0-100) */
  stability: number;
  /** Bandwidth utilization in KB/s */
  bandwidth: number;
  /** Message delivery success rate */
  deliveryRate: number;
  /** Connection uptime percentage */
  uptime: number;
}

/**
 * Connection Health Monitoring
 */
export interface WebSocketHealthStatus {
  /** Current connection state */
  state: WebSocketConnectionState;
  /** Last successful ping timestamp */
  lastPing: Date;
  /** Last successful pong timestamp */
  lastPong: Date;
  /** Ping-pong round trip time */
  rtt: number;
  /** Quality metrics */
  metrics: WebSocketQualityMetrics;
  /** Connection error count */
  errorCount: number;
  /** Reconnection attempts */
  reconnectAttempts: number;
  /** Maximum allowed reconnection attempts */
  maxReconnectAttempts: number;
}

/**
 * Rate Limiting Configuration
 */
export interface WebSocketRateLimits {
  /** Message rate limit per minute */
  messagesPerMinute: number;
  /** Room join rate limit per minute */
  joinsPerMinute: number;
  /** Typing event rate limit per minute */
  typingPerMinute: number;
  /** Rate limit window in milliseconds */
  windowMs: number;
  /** Current usage counts */
  usage: {
    messages: number;
    joins: number;
    typing: number;
    resetTime: Date;
  };
}

// =============================================================================
// CLIENT TO SERVER EVENTS
// =============================================================================

/**
 * Base interface for all client-to-server events
 */
export interface BaseClientEvent {
  /** Event timestamp */
  timestamp?: string;
  /** Client request ID for tracking */
  requestId?: string;
}

/**
 * Join Room Event
 */
export interface JoinRoomEvent extends BaseClientEvent {
  /** Target room identifier */
  roomId: string;
  /** Optional join context */
  context?: {
    referrer?: string;
    inviteCode?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Leave Room Event
 */
export interface LeaveRoomEvent extends BaseClientEvent {
  /** Target room identifier */
  roomId: string;
  /** Reason for leaving */
  reason?: 'user_action' | 'timeout' | 'kicked' | 'banned' | 'system';
}

/**
 * Send Message Event
 */
export interface SendMessageEvent extends BaseClientEvent {
  /** Message content */
  content: string;
  /** Target room identifier */
  roomId: string;
  /** Message type */
  messageType?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM' | 'ANNOUNCEMENT';
  /** Reply to message ID */
  replyTo?: string;
  /** Message metadata */
  metadata?: {
    mentions?: string[];
    attachments?: string[];
    reactions?: string[];
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
  };
}

/**
 * Typing Indicator Event
 */
export interface TypingEvent extends BaseClientEvent {
  /** Target room identifier */
  roomId: string;
  /** Typing status */
  isTyping: boolean;
  /** Typing context */
  context?: {
    inputLength?: number;
    cursorPosition?: number;
    composingType?: 'text' | 'file' | 'image';
  };
}

/**
 * Room Statistics Request Event
 */
export interface GetRoomStatsEvent extends BaseClientEvent {
  /** Target room identifier */
  roomId: string;
  /** Statistics scope */
  scope?: 'basic' | 'detailed' | 'analytics';
  /** Time range for statistics */
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Heartbeat Event
 */
export interface HeartbeatEvent extends BaseClientEvent {
  /** Client health metrics */
  clientMetrics?: {
    memoryUsage?: number;
    cpuUsage?: number;
    connectionQuality?: WebSocketQualityMetrics;
  };
}

/**
 * Union type for all client-to-server events
 */
export type ClientToServerEvents = {
  joinRoom: JoinRoomEvent;
  leaveRoom: LeaveRoomEvent;
  sendMessage: SendMessageEvent;
  typing: TypingEvent;
  getRoomStats: GetRoomStatsEvent;
  heartbeat: HeartbeatEvent;
};

// =============================================================================
// SERVER TO CLIENT EVENTS
// =============================================================================

/**
 * Base interface for all server-to-client events
 */
export interface BaseServerEvent {
  /** Event timestamp */
  timestamp: string;
  /** Server request ID correlation */
  requestId?: string;
  /** Event success status */
  success: boolean;
}

/**
 * Joined Room Response
 */
export interface JoinedRoomEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'joinedRoom';
  /** Target room identifier */
  roomId: string;
  /** Room details */
  roomInfo?: Partial<EnhancedRoom>;
  /** User permissions in room */
  permissions?: string[];
}

/**
 * Left Room Response
 */
export interface LeftRoomEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'leftRoom';
  /** Target room identifier */
  roomId: string;
}

/**
 * Message Sent Response
 */
export interface MessageSentEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'messageSent';
  /** Created message */
  message: EnhancedMessage;
}

/**
 * Typing Updated Response
 */
export interface TypingUpdatedEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'typingUpdated';
  /** Target room identifier */
  roomId?: string;
}

/**
 * Room Statistics Response
 */
export interface RoomStatsRetrievedEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'roomStatsRetrieved';
  /** Target room identifier */
  roomId: string;
  /** Statistics data */
  stats?: WebSocketRoomStats;
}

/**
 * Heartbeat Response
 */
export interface HeartbeatResponseEvent extends BaseServerEvent {
  /** Event type identifier */
  event: 'heartbeatResponse';
  /** Server health metrics */
  serverMetrics?: {
    load: number;
    uptime: number;
    connectedUsers: number;
    activeRooms: number;
  };
}

/**
 * Receive Message Event
 */
export interface ReceiveMessageEvent {
  /** Enhanced message data */
  message: EnhancedMessage;
  /** Delivery context */
  context?: {
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    deliveryTime: Date;
    readReceipt?: boolean;
  };
}

/**
 * User Joined Room Event
 */
export interface UserJoinedEvent {
  /** User identifier */
  userId: string;
  /** Username */
  username: string;
  /** Target room identifier */
  roomId: string;
  /** Event timestamp */
  timestamp: string;
  /** User profile info */
  userInfo?: Partial<EnhancedUser>;
}

/**
 * User Left Room Event
 */
export interface UserLeftEvent {
  /** User identifier */
  userId: string;
  /** Username */
  username: string;
  /** Target room identifier */
  roomId: string;
  /** Event timestamp */
  timestamp: string;
  /** Leave reason */
  reason?: string;
}

/**
 * User Online Event
 */
export interface UserOnlineEvent {
  /** User identifier */
  userId: string;
  /** Username */
  username: string;
  /** Event timestamp */
  timestamp: string;
  /** User presence info */
  presence?: {
    status: 'online' | 'away' | 'busy' | 'invisible';
    lastSeen?: Date;
    device?: string;
    location?: string;
  };
}

/**
 * User Offline Event
 */
export interface UserOfflineEvent {
  /** User identifier */
  userId: string;
  /** Username */
  username: string;
  /** Event timestamp */
  timestamp: string;
  /** Offline reason */
  reason?: 'disconnect' | 'idle' | 'manual' | 'timeout';
}

/**
 * User Typing Event
 */
export interface UserTypingEvent {
  /** User identifier */
  userId: string;
  /** Username */
  username: string;
  /** Target room identifier */
  roomId: string;
  /** Typing status */
  isTyping: boolean;
  /** Event timestamp */
  timestamp: string;
  /** Typing metadata */
  metadata?: {
    inputPreview?: string;
    estimatedFinishTime?: Date;
  };
}

/**
 * Room Users List Event
 */
export interface RoomUsersEvent {
  /** Target room identifier */
  roomId: string;
  /** List of users in room */
  users: Array<{
    userId: string;
    username: string;
    role?: string;
    joinedAt?: Date;
    lastActivity?: Date;
    presence?: 'online' | 'away' | 'busy';
  }>;
}

/**
 * Room Statistics Event
 */
export interface WebSocketRoomStats {
  /** Target room identifier */
  roomId: string;
  /** Current user count */
  userCount: number;
  /** Users list */
  users: Array<{
    userId: string;
    username: string;
    role?: string;
    isOnline: boolean;
  }>;
  /** Currently typing users */
  typingUsers: string[];
  /** Event timestamp */
  timestamp: string;
  /** Extended statistics */
  analytics?: {
    messageCount24h: number;
    averageResponseTime: number;
    peakUsers: number;
    activityScore: number;
  };
}

/**
 * Heartbeat Ping Event
 */
export interface HeartbeatPingEvent {
  /** Event timestamp */
  timestamp: string;
  /** Server health indicators */
  health?: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    load: number;
    responseTime: number;
  };
}

/**
 * WebSocket Error Event
 */
export interface WebSocketErrorEvent {
  /** Success status (always false) */
  success: false;
  /** Error message */
  error: string;
  /** Additional error message */
  message?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Event timestamp */
  timestamp: string;
  /** Error context */
  context?: {
    event?: string;
    roomId?: string;
    userId?: string;
    requestId?: string;
  };
  /** Error type classification */
  errorType?: 'validation' | 'authentication' | 'authorization' | 'rate_limit' | 'server' | 'network';
}

/**
 * Union type for all server-to-client events
 */
export type ServerToClientEvents = {
  joinedRoom: JoinedRoomEvent;
  leftRoom: LeftRoomEvent;
  messageSent: MessageSentEvent;
  typingUpdated: TypingUpdatedEvent;
  roomStatsRetrieved: RoomStatsRetrievedEvent;
  heartbeatResponse: HeartbeatResponseEvent;
  receiveMessage: ReceiveMessageEvent;
  userJoined: UserJoinedEvent;
  userLeft: UserLeftEvent;
  userOnline: UserOnlineEvent;
  userOffline: UserOfflineEvent;
  userTyping: UserTypingEvent;
  roomUsers: RoomUsersEvent;
  roomStats: WebSocketRoomStats;
  ping: HeartbeatPingEvent;
  error: WebSocketErrorEvent;
};

// =============================================================================
// WEBSOCKET CONFIGURATION AND MANAGEMENT
// =============================================================================

/**
 * WebSocket Configuration
 */
export interface WebSocketConfig {
  /** WebSocket server endpoint */
  endpoint: string;
  /** Connection namespace */
  namespace: string;
  /** Authentication configuration */
  auth: {
    /** JWT token provider */
    tokenProvider: () => Promise<string | null>;
    /** Token refresh handler */
    refreshHandler?: () => Promise<string>;
    /** Authentication timeout */
    timeout?: number;
  };
  /** Reconnection configuration */
  reconnection: {
    /** Enable automatic reconnection */
    enabled: boolean;
    /** Maximum reconnection attempts */
    maxAttempts: number;
    /** Initial reconnection delay */
    initialDelay: number;
    /** Maximum reconnection delay */
    maxDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
  };
  /** Heartbeat configuration */
  heartbeat: {
    /** Enable heartbeat */
    enabled: boolean;
    /** Heartbeat interval in milliseconds */
    interval: number;
    /** Heartbeat timeout in milliseconds */
    timeout: number;
  };
  /** Quality monitoring */
  monitoring: {
    /** Enable connection quality monitoring */
    enabled: boolean;
    /** Metrics collection interval */
    interval: number;
    /** Performance thresholds */
    thresholds: {
      latency: number;
      packetLoss: number;
      stability: number;
    };
  };
}

/**
 * WebSocket Event Handlers
 */
export interface WebSocketEventHandlers {
  /** Connection established */
  onConnect?: () => void;
  /** Connection lost */
  onDisconnect?: (reason: string) => void;
  /** Reconnection attempt */
  onReconnecting?: (attempt: number) => void;
  /** Reconnection successful */
  onReconnected?: () => void;
  /** Reconnection failed */
  onReconnectFailed?: () => void;
  /** Authentication required */
  onAuthRequired?: () => void;
  /** Authentication failed */
  onAuthFailed?: (error: string) => void;
  /** Rate limit exceeded */
  onRateLimited?: (event: string, retryAfter: number) => void;
  /** Quality degradation detected */
  onQualityDegraded?: (metrics: WebSocketQualityMetrics) => void;
  /** Generic error handler */
  onError?: (error: WebSocketErrorEvent) => void;
}

/**
 * WebSocket Store State
 */
export interface WebSocketStoreState {
  /** Connection status */
  isConnected: boolean;
  /** Connection state */
  connectionState: WebSocketConnectionState;
  /** Health status */
  health: WebSocketHealthStatus;
  /** Rate limiting status */
  rateLimits: WebSocketRateLimits;
  /** Joined rooms */
  joinedRooms: Set<string>;
  /** Active users by room */
  roomUsers: Map<string, EnhancedUser[]>;
  /** Typing users by room */
  typingUsers: Map<string, string[]>;
  /** Room statistics cache */
  roomStats: Map<string, WebSocketRoomStats>;
  /** Message queue for offline scenarios */
  messageQueue: SendMessageEvent[];
  /** Event history for debugging */
  eventHistory: Array<{
    type: 'sent' | 'received';
    event: string;
    data: any;
    timestamp: Date;
  }>;
}

/**
 * WebSocket Service Interface
 */
export interface WebSocketServiceInterface {
  /** Current connection state */
  readonly state: WebSocketConnectionState;
  /** Health status */
  readonly health: WebSocketHealthStatus;
  /** Configuration */
  readonly config: WebSocketConfig;

  /** Connect to WebSocket server */
  connect(): Promise<void>;
  /** Disconnect from WebSocket server */
  disconnect(): Promise<void>;
  /** Reconnect to WebSocket server */
  reconnect(): Promise<void>;

  /** Join a room */
  joinRoom(roomId: string, context?: JoinRoomEvent['context']): Promise<void>;
  /** Leave a room */
  leaveRoom(roomId: string, reason?: LeaveRoomEvent['reason']): Promise<void>;
  /** Send a message */
  sendMessage(message: SendMessageEvent): Promise<void>;
  /** Send typing indicator */
  setTyping(roomId: string, isTyping: boolean): Promise<void>;
  /** Get room statistics */
  getRoomStats(roomId: string, scope?: GetRoomStatsEvent['scope']): Promise<WebSocketRoomStats>;

  /** Subscribe to events */
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: (data: ServerToClientEvents[K]) => void
  ): void;
  /** Unsubscribe from events */
  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: (data: ServerToClientEvents[K]) => void
  ): void;

  /** Get current rate limit status */
  getRateLimitStatus(): WebSocketRateLimits;
  /** Get connection quality metrics */
  getQualityMetrics(): WebSocketQualityMetrics;
  /** Get event history for debugging */
  getEventHistory(): WebSocketStoreState['eventHistory'];
}

/**
 * WebSocket Utility Types
 */
export type WebSocketEventType = keyof (ClientToServerEvents & ServerToClientEvents);
export type WebSocketEventData<T extends WebSocketEventType> = T extends keyof ClientToServerEvents
  ? ClientToServerEvents[T]
  : T extends keyof ServerToClientEvents
  ? ServerToClientEvents[T]
  : never;

/**
 * WebSocket Performance Monitoring
 */
export interface WebSocketPerformanceMetrics {
  /** Connection establishment time */
  connectionTime: number;
  /** Message round-trip times */
  messageLatencies: number[];
  /** Event processing times */
  eventProcessingTimes: Map<string, number[]>;
  /** Memory usage for WebSocket */
  memoryUsage: number;
  /** Bandwidth utilization */
  bandwidth: {
    sent: number;
    received: number;
    peak: number;
  };
  /** Error rates */
  errorRates: Map<string, number>;
}

/**
 * Advanced WebSocket Features
 */
export interface WebSocketAdvancedFeatures {
  /** Message persistence for offline scenarios */
  messagePersistence: {
    enabled: boolean;
    maxStorageSize: number;
    retentionPeriod: number;
  };
  /** Message compression */
  compression: {
    enabled: boolean;
    algorithm: 'gzip' | 'deflate' | 'brotli';
    threshold: number;
  };
  /** Priority message queuing */
  priorityQueuing: {
    enabled: boolean;
    maxHighPriorityBuffer: number;
    maxNormalPriorityBuffer: number;
  };
  /** Analytics and telemetry */
  analytics: {
    enabled: boolean;
    sampleRate: number;
    metricsEndpoint?: string;
  };
}
