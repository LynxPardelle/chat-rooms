import { EntityId } from './index';

// Thread management types
export type MessageThread = {
  id: string;
  rootMessageId: string;
  roomId: string;
  title?: string;
  participantIds: string[];
  messageCount: number;
  lastMessageAt: Date;
  lastMessageId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};

export type ThreadParticipant = {
  userId: string;
  username: string;
  joinedAt: Date;
  lastReadAt?: Date;
  unreadCount: number;
  isActive: boolean;
};

export type ThreadSummary = {
  threadId: string;
  rootMessage: {
    id: string;
    content: string;
    authorUsername: string;
    createdAt: Date;
  };
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
  unreadCount: number;
  preview: string;
};

export type CreateThreadData = {
  rootMessageId: string;
  roomId: string;
  title?: string;
  initialParticipants?: string[];
};

export type ThreadQueryOptions = {
  includeMessages?: boolean;
  includeParticipants?: boolean;
  messageLimit?: number;
  sortBy?: 'createdAt' | 'lastActivity' | 'messageCount';
  sortOrder?: 'asc' | 'desc';
};

// Thread repository interface
export interface IThreadRepository {
  create(threadData: CreateThreadData): Promise<MessageThread>;
  findById(id: string, options?: ThreadQueryOptions): Promise<MessageThread | null>;
  findByRootMessage(rootMessageId: string): Promise<MessageThread | null>;
  findByRoom(roomId: string, options?: ThreadQueryOptions): Promise<MessageThread[]>;
  addParticipant(threadId: string, userId: string): Promise<boolean>;
  removeParticipant(threadId: string, userId: string): Promise<boolean>;
  updateActivity(threadId: string, lastMessageId: string): Promise<boolean>;
  getParticipants(threadId: string): Promise<ThreadParticipant[]>;
  getSummary(threadId: string): Promise<ThreadSummary>;
  getUserThreads(userId: string): Promise<ThreadSummary[]>;
  markAsRead(threadId: string, userId: string): Promise<boolean>;
}
