import { MessageThreadTypes } from '../types';

export interface IThreadRepository {
  /**
   * Create a new thread
   */
  create(threadData: MessageThreadTypes.CreateThreadData): Promise<MessageThreadTypes.MessageThread>;
  
  /**
   * Find a thread by its ID
   */
  findById(id: string, options?: MessageThreadTypes.ThreadQueryOptions): Promise<MessageThreadTypes.MessageThread | null>;
  
  /**
   * Find a thread by its root message ID
   */
  findByRootMessage(rootMessageId: string): Promise<MessageThreadTypes.MessageThread | null>;
  
  /**
   * Find all threads in a room
   */
  findByRoom(roomId: string, options?: MessageThreadTypes.ThreadQueryOptions): Promise<MessageThreadTypes.MessageThread[]>;
  
  /**
   * Add a participant to a thread
   */
  addParticipant(threadId: string, userId: string): Promise<boolean>;
  
  /**
   * Remove a participant from a thread
   */
  removeParticipant(threadId: string, userId: string): Promise<boolean>;
  
  /**
   * Update thread activity (last message, count, etc.)
   */
  updateActivity(threadId: string, lastMessageId: string): Promise<boolean>;
  
  /**
   * Get all participants of a thread
   */
  getParticipants(threadId: string): Promise<MessageThreadTypes.ThreadParticipant[]>;
  
  /**
   * Get thread summary information
   */
  getSummary(threadId: string): Promise<MessageThreadTypes.ThreadSummary>;
  
  /**
   * Get all threads for a specific user
   */
  getUserThreads(userId: string): Promise<MessageThreadTypes.ThreadSummary[]>;
  
  /**
   * Mark a thread as read for a specific user
   */
  markAsRead(threadId: string, userId: string): Promise<boolean>;
}
