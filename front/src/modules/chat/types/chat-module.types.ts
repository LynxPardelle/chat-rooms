/**
 * Chat Module - Comprehensive TypeScript Type Definitions
 * 
 * This file contains all TypeScript types, interfaces, and enums related to the chat module.
 * It provides a complete type system for messages, users, rooms, and chat interactions.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 */

// =============================================================================
// CONSTANTS (instead of enums to work with SWC)
// =============================================================================

/**
 * Types of messages that can be sent in the chat
 */
export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system'
} as const;
export type MessageType = typeof MessageType[keyof typeof MessageType];

/**
 * Connection status for users
 */
export const UserStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
  TYPING: 'typing'
} as const;
export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

/**
 * Types of chat rooms
 */
export const RoomType = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  DIRECT: 'direct'
} as const;
export type RoomType = typeof RoomType[keyof typeof RoomType];

/**
 * Message delivery status
 */
export const MessageStatus = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
} as const;
export type MessageStatus = typeof MessageStatus[keyof typeof MessageStatus];

// =============================================================================
// BASE TYPES
// =============================================================================

/**
 * Base user information for chat context
 */
export type ChatUser = {
  readonly id: string;
  readonly username: string;
  readonly email: string;
  readonly avatar?: string;
  readonly avatarUrl?: string;
  readonly textColor: string;
  readonly backgroundColor: string;
  readonly isOnline: boolean;
  readonly lastSeen: Date;
  readonly status: UserStatus;
  readonly isTyping: boolean;
  readonly typingAt?: Date;
}

/**
 * Message attachment information
 */
export type MessageAttachment = {
  readonly id: string;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly uploadProgress?: number;
  readonly uploadedAt: Date;
}

/**
 * Message reaction data
 */
export type MessageReaction = {
  readonly id: string;
  readonly emoji: string;
  readonly userId: string;
  readonly username: string;
  readonly createdAt: Date;
}

/**
 * Message metadata for additional information
 */
export type MessageMetadata = {
  readonly edited?: boolean;
  readonly editedAt?: Date;
  readonly replyTo?: string;
  readonly mentions?: string[];
  readonly reactions?: MessageReaction[];
  readonly readBy?: string[];
  readonly deliveredTo?: string[];
}

/**
 * Complete message structure
 */
export type ChatMessage = {
  readonly id: string;
  readonly content: string;
  readonly userId: string;
  readonly username: string;
  readonly roomId: string;
  readonly messageType: MessageType;
  readonly status: MessageStatus;
  readonly attachments?: MessageAttachment[];
  readonly metadata?: MessageMetadata;
  readonly userColors: {
    readonly textColor: string;
    readonly backgroundColor: string;
  };
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isOwn: boolean; // Computed property for UI
}

/**
 * Chat room information
 */
export type ChatRoom = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly type: RoomType;
  readonly isPrivate: boolean;
  readonly maxUsers?: number;
  readonly userCount: number;
  readonly users: ChatUser[];
  readonly lastMessage?: ChatMessage;
  readonly lastActivity: Date;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly unreadCount: number;
}

// =============================================================================
// DTO TYPES (Data Transfer Objects)
// =============================================================================

/**
 * Data for sending a new message
 */
export type SendMessageDto = {
  readonly content: string;
  readonly roomId: string;
  readonly messageType?: MessageType;
  readonly attachments?: File[];
  readonly replyTo?: string;
  readonly mentions?: string[];
}

/**
 * Data for updating an existing message
 */
export type UpdateMessageDto = {
  readonly id: string;
  readonly content: string;
  readonly roomId: string;
}

/**
 * Data for creating a new room
 */
export type CreateRoomDto = {
  readonly name: string;
  readonly description?: string;
  readonly type: RoomType;
  readonly isPrivate?: boolean;
  readonly maxUsers?: number;
}

/**
 * Data for joining a room
 */
export type JoinRoomDto = {
  readonly roomId: string;
  readonly password?: string;
}

/**
 * Data for user typing indicators
 */
export type TypingIndicatorDto = {
  readonly roomId: string;
  readonly isTyping: boolean;
  readonly userId: string;
  readonly username: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

/**
 * Paginated messages response
 */
export type MessagesResponse = {
  readonly messages: ChatMessage[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly hasMore: boolean;
  };
  readonly roomId: string;
}

/**
 * Room list response
 */
export type RoomsResponse = {
  readonly rooms: ChatRoom[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly hasMore: boolean;
  };
}

/**
 * User list response for a room
 */
export type RoomUsersResponse = {
  readonly users: ChatUser[];
  readonly roomId: string;
  readonly total: number;
}

// =============================================================================
// WEBSOCKET EVENT TYPES
// =============================================================================

/**
 * WebSocket event names
 */
export const SocketEvent = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',
  ERROR: 'error',
  
  // Authentication events
  AUTHENTICATE: 'authenticate',
  AUTHENTICATED: 'authenticated',
  AUTHENTICATION_ERROR: 'authentication_error',
  
  // Room events
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  ROOM_LEFT: 'room_left',
  ROOM_ERROR: 'room_error',
  
  // Message events
  SEND_MESSAGE: 'send_message',
  MESSAGE_SENT: 'message_sent',
  NEW_MESSAGE: 'new_message',
  MESSAGE_ERROR: 'message_error',
  MESSAGE_UPDATED: 'message_updated',
  MESSAGE_DELETED: 'message_deleted',
  
  // User events
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  USER_TYPING: 'user_typing',
  USER_STOPPED_TYPING: 'user_stopped_typing',
  USER_STATUS_CHANGED: 'user_status_changed',
  
  // System events
  HEARTBEAT: 'heartbeat',
  SYSTEM_MESSAGE: 'system_message'
} as const;
export type SocketEvent = typeof SocketEvent[keyof typeof SocketEvent];

/**
 * WebSocket event payload types
 */
export type SocketEventPayloads = {
  [SocketEvent.AUTHENTICATE]: { token: string };
  [SocketEvent.AUTHENTICATED]: { user: ChatUser };
  [SocketEvent.AUTHENTICATION_ERROR]: { message: string };
  
  [SocketEvent.JOIN_ROOM]: JoinRoomDto;
  [SocketEvent.LEAVE_ROOM]: { roomId: string };
  [SocketEvent.ROOM_JOINED]: { room: ChatRoom; user: ChatUser };
  [SocketEvent.ROOM_LEFT]: { roomId: string; userId: string };
  [SocketEvent.ROOM_ERROR]: { message: string; roomId?: string };
  
  [SocketEvent.SEND_MESSAGE]: SendMessageDto;
  [SocketEvent.MESSAGE_SENT]: { message: ChatMessage };
  [SocketEvent.NEW_MESSAGE]: { message: ChatMessage };
  [SocketEvent.MESSAGE_ERROR]: { message: string; tempId?: string };
  [SocketEvent.MESSAGE_UPDATED]: { message: ChatMessage };
  [SocketEvent.MESSAGE_DELETED]: { messageId: string; roomId: string };
  
  [SocketEvent.USER_JOINED]: { user: ChatUser; roomId: string };
  [SocketEvent.USER_LEFT]: { userId: string; username: string; roomId: string };
  [SocketEvent.USER_TYPING]: TypingIndicatorDto;
  [SocketEvent.USER_STOPPED_TYPING]: TypingIndicatorDto;
  [SocketEvent.USER_STATUS_CHANGED]: { userId: string; status: UserStatus };
  
  [SocketEvent.HEARTBEAT]: { timestamp: number };
  [SocketEvent.SYSTEM_MESSAGE]: { message: string; type: 'info' | 'warning' | 'error' };
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * Chat UI loading states
 */
export type ChatLoadingState = {
  readonly messages: boolean;
  readonly rooms: boolean;
  readonly users: boolean;
  readonly sendingMessage: boolean;
  readonly joiningRoom: boolean;
  readonly uploadingFile: boolean;
}

/**
 * Chat UI error states
 */
export type ChatErrorState = {
  readonly connection: string | null;
  readonly messages: string | null;
  readonly rooms: string | null;
  readonly users: string | null;
  readonly sendMessage: string | null;
  readonly joinRoom: string | null;
  readonly fileUpload: string | null;
}

/**
 * Chat UI configuration
 */
export type ChatUIConfig = {
  readonly theme: 'light' | 'dark' | 'auto';
  readonly showTimestamps: boolean;
  readonly showUserAvatars: boolean;
  readonly enableSounds: boolean;
  readonly enableNotifications: boolean;
  readonly messageGroupingTimeout: number; // minutes
  readonly maxFileSize: number; // bytes
  readonly allowedFileTypes: string[];
  readonly messagesPerPage: number;
}

/**
 * Message input state
 */
export type MessageInputState = {
  readonly content: string;
  readonly attachments: File[];
  readonly replyTo: ChatMessage | null;
  readonly mentions: ChatUser[];
  readonly isTyping: boolean;
  readonly uploadProgress: Record<string, number>;
}

/**
 * Connection state information
 */
export type ConnectionState = {
  readonly isConnected: boolean;
  readonly isConnecting: boolean;
  readonly isReconnecting: boolean;
  readonly lastConnected: Date | null;
  readonly reconnectAttempts: number;
  readonly latency: number | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Temporary message for optimistic updates
 */
export type TempMessage = Omit<ChatMessage, 'id' | 'status' | 'createdAt' | 'updatedAt'> & {
  readonly tempId: string;
  readonly status: 'sending';
  readonly createdAt: Date;
}

/**
 * Message search filters
 */
export type MessageSearchFilters = {
  readonly query?: string;
  readonly userId?: string;
  readonly messageType?: MessageType;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly hasAttachments?: boolean;
}

/**
 * Virtual scrolling data
 */
export type VirtualScrollData = {
  readonly itemHeight: number;
  readonly containerHeight: number;
  readonly scrollTop: number;
  readonly visibleStart: number;
  readonly visibleEnd: number;
  readonly totalItems: number;
}

/**
 * Notification preferences
 */
export type NotificationPreferences = {
  readonly enabled: boolean;
  readonly sound: boolean;
  readonly desktop: boolean;
  readonly mentions: boolean;
  readonly directMessages: boolean;
  readonly keywords: string[];
}

// =============================================================================
// ADVANCED SEARCH TYPES
// =============================================================================

/**
 * Sort order options for search results
 */
export const SearchSortOrder = {
  RELEVANCE: 'relevance',
  NEWEST: 'newest', 
  OLDEST: 'oldest'
} as const;
export type SearchSortOrder = typeof SearchSortOrder[keyof typeof SearchSortOrder];

/**
 * Advanced search request parameters
 */
export interface AdvancedSearchRequest {
  readonly query: string;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: SearchSortOrder;
  readonly userId?: string;
  readonly roomId?: string;
  readonly startDate?: string; // ISO string
  readonly endDate?: string; // ISO string
  readonly hashtags?: string[];
  readonly mentions?: string[];
  readonly hasAttachments?: boolean;
  readonly includeDeleted?: boolean;
  readonly includeEdited?: boolean;
}

/**
 * Search result with highlighting and context
 */
export interface SearchResultMessage {
  readonly id: string;
  readonly content: string;
  readonly highlightedContent: string;
  readonly context: string;
  readonly author: {
    readonly id: string;
    readonly username: string;
    readonly avatar?: string;
  };
  readonly room: {
    readonly id: string;
    readonly name: string;
  };
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly isEdited: boolean;
  readonly isDeleted: boolean;
  readonly score: number;
  readonly attachments?: Array<{
    readonly id: string;
    readonly filename: string;
    readonly type: string;
  }>;
  readonly hashtags: string[];
  readonly mentions: string[];
}

/**
 * Paginated search results
 */
export interface SearchResults {
  readonly results: SearchResultMessage[];
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
  };
  readonly facets: {
    readonly userCounts: Array<{ userId: string; username: string; count: number }>;
    readonly roomCounts: Array<{ roomId: string; roomName: string; count: number }>;
    readonly dateDistribution: Array<{ date: string; count: number }>;
    readonly hashtagCounts: Array<{ hashtag: string; count: number }>;
  };
  readonly query: string;
  readonly totalMatches: number;
  readonly searchTime: number;
}

/**
 * Search suggestions for autocomplete
 */
export interface SearchSuggestions {
  readonly suggestions: string[];
  readonly hashtagSuggestions: string[];
  readonly mentionSuggestions: Array<{
    readonly userId: string;
    readonly username: string;
    readonly displayName: string;
  }>;
  readonly historySuggestions: string[];
}

/**
 * Search filter state
 */
export interface SearchFilters {
  readonly dateRange: {
    readonly start: Date | null;
    readonly end: Date | null;
  };
  readonly selectedUsers: string[];
  readonly selectedRooms: string[];
  readonly messageTypes: MessageType[];
  readonly hasAttachments: boolean | null;
  readonly includeDeleted: boolean;
  readonly includeEdited: boolean;
}

/**
 * Search state for store management
 */
export interface SearchState {
  readonly isSearching: boolean;
  readonly query: string;
  readonly filters: SearchFilters;
  readonly results: SearchResults | null;
  readonly suggestions: SearchSuggestions | null;
  readonly recentSearches: string[];
  readonly error: string | null;
  readonly sortBy: SearchSortOrder;
  readonly currentPage: number;
}

/**
 * Search history item
 */
export interface SearchHistoryItem {
  readonly query: string;
  readonly filters: Partial<SearchFilters>;
  readonly timestamp: Date;
  readonly resultCount: number;
}

// =============================================================================
// TYPES ARE ALREADY EXPORTED ABOVE - NO NEED FOR RE-EXPORT
// =============================================================================
