import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IThreadRepository } from '../../../domain/interfaces';
import { MessageThreadTypes } from '../../../domain/types';

/**
 * Mock Thread Repository Implementation
 * This is a basic implementation to resolve dependency injection.
 * In a production environment, this would interact with a proper database.
 */
@Injectable()
export class ThreadRepository implements IThreadRepository {
  private readonly logger = new Logger(ThreadRepository.name);
  private readonly mockThreads = new Map<string, MessageThreadTypes.MessageThread>();
  private readonly mockParticipants = new Map<string, MessageThreadTypes.ThreadParticipant[]>();
  private currentId = 1;

  constructor() {
    this.logger.log('ThreadRepository initialized (Mock Implementation)');
  }

  async create(threadData: MessageThreadTypes.CreateThreadData): Promise<MessageThreadTypes.MessageThread> {
    const threadId = `thread_${this.currentId++}`;
    
    const thread: MessageThreadTypes.MessageThread = {
      id: threadId,
      rootMessageId: threadData.rootMessageId,
      roomId: threadData.roomId,
      title: threadData.title || `Thread for ${threadData.rootMessageId}`,
      participantIds: threadData.initialParticipants || [],
      messageCount: 0,
      lastMessageAt: new Date(),
      lastMessageId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.mockThreads.set(threadId, thread);
    
    // Initialize participants
    if (threadData.initialParticipants) {
      const participants = threadData.initialParticipants.map(userId => ({
        userId,
        username: `user_${userId}`,
        joinedAt: new Date(),
        lastReadAt: new Date(),
        unreadCount: 0,
        isActive: true
      }));
      this.mockParticipants.set(threadId, participants);
    }

    this.logger.debug(`Created thread: ${threadId}`);
    return thread;
  }

  async findById(id: string, options?: MessageThreadTypes.ThreadQueryOptions): Promise<MessageThreadTypes.MessageThread | null> {
    const thread = this.mockThreads.get(id);
    
    if (!thread) {
      this.logger.debug(`Thread not found: ${id}`);
      return null;
    }

    this.logger.debug(`Found thread: ${id}`);
    return thread;
  }

  async findByRootMessage(rootMessageId: string): Promise<MessageThreadTypes.MessageThread | null> {
    for (const [threadId, thread] of this.mockThreads) {
      if (thread.rootMessageId === rootMessageId) {
        this.logger.debug(`Found thread ${threadId} for root message: ${rootMessageId}`);
        return thread;
      }
    }
    
    this.logger.debug(`No thread found for root message: ${rootMessageId}`);
    return null;
  }

  async findByRoom(roomId: string, options?: MessageThreadTypes.ThreadQueryOptions): Promise<MessageThreadTypes.MessageThread[]> {
    const threads: MessageThreadTypes.MessageThread[] = [];
    
    for (const [threadId, thread] of this.mockThreads) {
      if (thread.roomId === roomId && thread.isActive) {
        threads.push(thread);
      }
    }

    this.logger.debug(`Found ${threads.length} threads for room ${roomId}`);
    return threads;
  }

  async addParticipant(threadId: string, userId: string): Promise<boolean> {
    const thread = this.mockThreads.get(threadId);
    
    if (!thread) {
      this.logger.warn(`Cannot add participant to non-existent thread: ${threadId}`);
      return false;
    }

    if (!thread.participantIds.includes(userId)) {
      thread.participantIds.push(userId);
      
      // Update participants list
      const participants = this.mockParticipants.get(threadId) || [];
      participants.push({
        userId,
        username: `user_${userId}`,
        joinedAt: new Date(),
        lastReadAt: new Date(),
        unreadCount: 0,
        isActive: true
      });
      this.mockParticipants.set(threadId, participants);
      
      this.logger.debug(`Added participant ${userId} to thread ${threadId}`);
    }
    
    return true;
  }

  async removeParticipant(threadId: string, userId: string): Promise<boolean> {
    const thread = this.mockThreads.get(threadId);
    
    if (!thread) {
      this.logger.warn(`Cannot remove participant from non-existent thread: ${threadId}`);
      return false;
    }

    const initialLength = thread.participantIds.length;
    thread.participantIds = thread.participantIds.filter(id => id !== userId);
    
    // Update participants list
    const participants = this.mockParticipants.get(threadId) || [];
    this.mockParticipants.set(threadId, participants.filter(p => p.userId !== userId));
    
    const removed = thread.participantIds.length < initialLength;
    if (removed) {
      this.logger.debug(`Removed participant ${userId} from thread ${threadId}`);
    }
    
    return removed;
  }

  async updateActivity(threadId: string, lastMessageId: string): Promise<boolean> {
    const thread = this.mockThreads.get(threadId);
    
    if (!thread) {
      this.logger.warn(`Cannot update activity for non-existent thread: ${threadId}`);
      return false;
    }

    thread.lastMessageId = lastMessageId;
    thread.lastMessageAt = new Date();
    thread.messageCount++;
    thread.updatedAt = new Date();

    this.logger.debug(`Updated activity for thread: ${threadId}`);
    return true;
  }

  async getParticipants(threadId: string): Promise<MessageThreadTypes.ThreadParticipant[]> {
    const participants = this.mockParticipants.get(threadId) || [];
    this.logger.debug(`Found ${participants.length} participants for thread ${threadId}`);
    return participants;
  }

  async getSummary(threadId: string): Promise<MessageThreadTypes.ThreadSummary> {
    const thread = this.mockThreads.get(threadId);
    
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    const participants = this.mockParticipants.get(threadId) || [];
    
    return {
      threadId,
      rootMessage: {
        id: thread.rootMessageId,
        content: 'Mock root message content',
        authorUsername: 'mock_user',
        createdAt: thread.createdAt
      },
      participantCount: participants.length,
      messageCount: thread.messageCount,
      lastActivity: thread.lastMessageAt,
      unreadCount: 0, // Mock implementation
      preview: 'Mock thread preview...'
    };
  }

  async getUserThreads(userId: string): Promise<MessageThreadTypes.ThreadSummary[]> {
    const userThreads: MessageThreadTypes.ThreadSummary[] = [];
    
    for (const [threadId, thread] of this.mockThreads) {
      if (thread.participantIds.includes(userId) && thread.isActive) {
        const summary = await this.getSummary(threadId);
        userThreads.push(summary);
      }
    }

    this.logger.debug(`Found ${userThreads.length} threads for user ${userId}`);
    return userThreads;
  }

  async markAsRead(threadId: string, userId: string): Promise<boolean> {
    const participants = this.mockParticipants.get(threadId) || [];
    const participant = participants.find(p => p.userId === userId);
    
    if (participant) {
      participant.lastReadAt = new Date();
      participant.unreadCount = 0;
      this.logger.debug(`Marked thread ${threadId} as read for user ${userId}`);
      return true;
    }

    this.logger.warn(`User ${userId} is not a participant in thread ${threadId}`);
    return false;
  }
}
