// Enhanced mention types for @ mentions and notifications
export type MessageMention = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  startIndex: number;
  endIndex: number;
  mentionType: MentionType;
  notified: boolean;
  notifiedAt?: Date;
  notificationMethod?: NotificationMethod[];
};

export enum MentionType {
  USER = 'user',
  ROLE = 'role',
  EVERYONE = 'everyone',
  CHANNEL = 'channel',
  HERE = 'here'
}

export enum NotificationMethod {
  PUSH = 'push',
  EMAIL = 'email',
  IN_APP = 'in_app',
  WEBSOCKET = 'websocket'
}

export type MentionNotification = {
  id: string;
  mentionId: string;
  userId: string;
  messageId: string;
  messageContent: string;
  mentionedBy: {
    userId: string;
    username: string;
    displayName: string;
  };
  roomId: string;
  roomName?: string;
  notificationMethod: NotificationMethod;
  status: NotificationStatus;
  sentAt: Date;
  readAt?: Date;
  clickedAt?: Date;
};

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export type MentionSuggestion = {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  matchScore: number; // For ranking search results
  roleInRoom?: string;
};

export type ParsedMention = {
  originalText: string;
  mentionType: MentionType;
  identifier: string; // username, role name, etc.
  startIndex: number;
  endIndex: number;
  isValid: boolean;
  suggestedUser?: MentionSuggestion;
};

export type MentionParseResult = {
  content: string;
  mentions: ParsedMention[];
  processedContent: string; // Content with mentions properly formatted
  hasValidMentions: boolean;
  invalidMentions: string[];
};

export type MentionSearchQuery = {
  query: string;
  roomId?: string;
  excludeUserIds?: string[];
  includeOfflineUsers?: boolean;
  limit?: number;
};

export type MentionSearchResult = {
  suggestions: MentionSuggestion[];
  totalFound: number;
  queryTime: number;
};

// Mention service interface
export interface IMentionService {
  parseMentions(content: string, roomId?: string): Promise<MentionParseResult>;
  searchUsers(query: MentionSearchQuery): Promise<MentionSearchResult>;
  createMentionNotifications(mentions: MessageMention[], messageId: string, mentionedBy: string): Promise<MentionNotification[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<boolean>;
  getUserMentions(userId: string, options?: {
    unreadOnly?: boolean;
    roomId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    notifications: MentionNotification[];
    unreadCount: number;
    totalCount: number;
  }>;
  validateMentionPermissions(mentionedUserId: string, roomId: string, mentionedBy: string): Promise<boolean>;
}

// Role-based mentions (for future implementation)
export type RoleMention = {
  roleId: string;
  roleName: string;
  memberCount: number;
  canMention: boolean;
  mentionCooldown?: number; // Minutes before role can be mentioned again
};

export type SpecialMention = {
  type: '@everyone' | '@here' | '@channel';
  targetCount: number;
  requiresPermission: boolean;
  cooldownMinutes: number;
};
