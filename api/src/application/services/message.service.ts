import { 
  Injectable, 
  Logger, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException, 
  Inject,
  ConflictException,
  InternalServerErrorException
} from '@nestjs/common';
import { 
  CreateMessageDto, 
  UpdateMessageDto,
  MessageSearchDto, 
  PaginationDto,
  BulkMessageActionDto,
  MessageAnalyticsFilterDto,
  FlagMessageDto,
  AddReactionDto,
  MarkAsReadDto,
  CreateThreadDto,
  TypingIndicatorDto,
  MessageType,
  MessageStatus,
  MessagePriority,
  MessageFlag,
  MessageResponseDto,
  PaginatedMessagesDto,
  MessageAnalyticsDto,
  MessageSearchResultDto
} from '../dtos/message.dto';
import { IMessageRepository, PaginatedResult } from '../../domain/interfaces/message-repository.interface';
import { 
  Message, 
  CreateMessageData,
  UpdateMessageData,
  BulkMessageAction,
  MessageAnalytics,
  UserWithoutPassword,
  MessageEditHistory,
  MessageReadStatus,
  MessageDeliveryStatus,
  MessageReaction,
  MessageMetadata,
  MessageAttachment,
  MessageMention
} from '../../domain/entities';

import { 
  MessageThreadTypes, 
  MessageMentionTypes,
  MessageReactionTypes
} from '../../domain/types';

import { AppLoggerService } from '../../infrastructure/logging';
import { 
  MESSAGE_REPOSITORY_TOKEN,
  THREAD_REPOSITORY_TOKEN,
  REACTION_REPOSITORY_TOKEN,
  MENTION_SERVICE_TOKEN,
  DEFAULT_ROOM_ID,
  MAX_MESSAGE_LENGTH,
  MAX_EDIT_TIME_MINUTES,
  MAX_BULK_OPERATIONS,
  MAX_MENTIONS_PER_MESSAGE,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_REACTIONS_PER_MESSAGE
} from '../../domain/constants';
import { MessageFilterExpression, MessageQueryOptions } from '../../domain/types/message-filter.types';

// Enhanced Cache interface
interface MessageCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string | RegExp): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  
  constructor(
    @Inject(MESSAGE_REPOSITORY_TOKEN) 
    private readonly messageRepository: IMessageRepository,
    
    @Inject(THREAD_REPOSITORY_TOKEN) 
    private readonly threadRepository: MessageThreadTypes.IThreadRepository,
    
    @Inject(REACTION_REPOSITORY_TOKEN)
    private readonly reactionRepository: MessageReactionTypes.IReactionRepository,
    
    @Inject(MENTION_SERVICE_TOKEN)
    private readonly mentionService: MessageMentionTypes.IMentionService,
    
    private readonly appLogger: AppLoggerService,
    
    @Inject('CACHE_SERVICE') 
    private readonly cache: MessageCache
  ) {}

  /**
   * Create a new message with comprehensive validation and processing
   */
  async createMessage(createMessageDto: CreateMessageDto, user: UserWithoutPassword): Promise<MessageResponseDto> {
    try {
      // Validate content length
      if (!createMessageDto.content || createMessageDto.content.length === 0) {
        throw new BadRequestException('Message content cannot be empty');
      }
      
      if (createMessageDto.content.length > MAX_MESSAGE_LENGTH) {
        throw new BadRequestException(`Message content exceeds maximum length (${MAX_MESSAGE_LENGTH} characters)`);
      }
      
      // Validate attachments (if any)
      if (createMessageDto.attachments && createMessageDto.attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
        throw new BadRequestException(`Maximum of ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed`);
      }
      
      // Validate mentions (if any)
      if (createMessageDto.mentions && createMessageDto.mentions.length > MAX_MENTIONS_PER_MESSAGE) {
        throw new BadRequestException(`Maximum of ${MAX_MENTIONS_PER_MESSAGE} mentions allowed`);
      }
      
      // If a room ID is specified, validate access
      if (createMessageDto.roomId) {
        await this.validateRoomAccess(user.id, createMessageDto.roomId);
      }
      
      // Process mentions if present
      let processedMentions: MessageMention[] = [];
      if (createMessageDto.mentions && createMessageDto.mentions.length > 0) {
        // Transform mentions from DTO format to entity format
        processedMentions = createMessageDto.mentions.map(mention => ({
          userId: mention.userId,
          username: mention.username,
          startIndex: mention.startIndex,
          endIndex: mention.endIndex,
          notified: false,
          displayName: mention.username
        }));        // Process mentions via mention service using parseMentions
        // Handle as Promise since the actual implementation returns a Promise
        const parsedMentions = await this.mentionService.parseMentions(createMessageDto.content);
        
        // Combine manually specified mentions with the parsed ones
        if (Array.isArray(parsedMentions)) {
          processedMentions = [
            ...processedMentions,
            ...parsedMentions.filter(parsed => !processedMentions.some(m => m.userId === parsed.userId))
          ];
        }
      }        // Prepare message data for creation with all required fields
      const messageData: CreateMessageData = {
        content: createMessageDto.content,
        type: createMessageDto.type || MessageType.TEXT,
        roomId: createMessageDto.roomId || DEFAULT_ROOM_ID,
        authorId: user.id,
        userId: user.id, // Add required userId field
        timestamp: new Date(), // Add required timestamp field
        authorUsername: user.username,
        isEdited: false,
        status: MessageStatus.SENT,
        priority: createMessageDto.priority || MessagePriority.NORMAL,
        imageUrl: createMessageDto.imageUrl,
        threadId: createMessageDto.threadId,
        replyToId: createMessageDto.replyToId,
        mentions: processedMentions,
        reactions: [],
        readBy: [],
        deliveredTo: [],
        messageFlags: [],
        editHistory: [],
        metadata: {
          edited: false,
          threadId: createMessageDto.threadId
        },
        attachments: createMessageDto.attachments?.map(att => ({
          id: Math.random().toString(36).substring(2, 15),
          filename: att.filename,
          originalName: att.originalName,
          mimeType: att.mimeType,
          size: att.size,
          url: att.url,
          uploadedBy: user.id,
          uploadedAt: new Date()        })) || [],
        searchableContent: createMessageDto.content.toLowerCase()
      } as Omit<Message, 'id' | 'createdAt' | 'updatedAt'>;
      
      // Create thread if this is a reply to a message and no thread exists yet
      if (createMessageDto.replyToId && !createMessageDto.threadId) {
        const parentMessage = await this.messageRepository.findById(createMessageDto.replyToId);
        
        if (!parentMessage) {
          throw new NotFoundException(`Parent message not found: ${createMessageDto.replyToId}`);
        }
        
        // Get threadId from parent message metadata or direct property
        const parentThreadId = parentMessage.metadata?.threadId || 
                              (parentMessage as any).threadId;
          if (parentThreadId) {
          messageData.threadId = parentThreadId;
          messageData.metadata.threadId = parentThreadId;
        } else if (this.threadRepository.create) {
          // Create a new thread using the parent message as root
          const thread = await this.threadRepository.create({
            rootMessageId: createMessageDto.replyToId,
            roomId: parentMessage.roomId || DEFAULT_ROOM_ID,
            initialParticipants: [user.id, parentMessage.authorId]
          });
          
          // Update the message data with the new thread ID
          messageData.threadId = thread.id;
          messageData.metadata.threadId = thread.id;
          
          // Update the parent message to be part of this thread
          await this.messageRepository.update(parentMessage.id, {
            metadata: {
              ...parentMessage.metadata,
              threadId: thread.id
            }
          });
        }
      }
      
      // Create the message
      const message = await this.messageRepository.create(messageData);      // Process mentions for notifications
      if (processedMentions.length && 'sendNotifications' in this.mentionService) {
        const mentionServiceWithNotifications = this.mentionService as MessageMentionTypes.IMentionService & {
          sendNotifications: (mentions: MessageMention[], messageId: string, messageContent: string, roomId: string) => Promise<void>;
        };
        mentionServiceWithNotifications.sendNotifications(
          processedMentions,
          message.id,
          message.content,
          message.roomId
        ).catch(error => {
          this.logger.error(`Failed to send mention notifications: ${error.message}`, error.stack);
        });
      }
      
      // Convert to response DTO
      return this.transformToResponseDto(message);
    } catch (error) {
      this.logger.error(`Error in createMessage: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  /**
   * Add a reaction to a message
   */
  async addReaction(
    messageId: string,
    reactionDto: AddReactionDto,
    user: UserWithoutPassword
  ): Promise<MessageResponseDto> {
    try {
      // Validate message exists
      const message = await this.messageRepository.findById(messageId);
      if (!message) {
        throw new NotFoundException(`Message with ID ${messageId} not found`);
      }
      
      // Check if user has permission to react to this message
      await this.validateRoomAccess(user.id, message.roomId);
      
      // Check if user already reacted with this emoji
      const userReactions = await this.reactionRepository.getUserReactions(messageId, user.id);
      if (userReactions.some(r => r.emoji === reactionDto.emoji)) {
        throw new ConflictException(`You have already reacted with this emoji`);
      }
      
      // Check reaction limit
      const currentReactions = await this.reactionRepository.getMessageReactions(messageId);
      if (currentReactions.totalReactions >= MAX_REACTIONS_PER_MESSAGE) {
        throw new BadRequestException(`Message has reached the maximum number of reactions`);
      }
      
      // Add reaction
      const reactionData: MessageReactionTypes.AddReactionData = {
        messageId,
        emoji: reactionDto.emoji,
        emojiCode: reactionDto.emojiCode,
        userId: user.id,
        isCustom: reactionDto.isCustom || false,
        customEmojiUrl: reactionDto.customEmojiUrl
      };
      
      const reaction = await this.reactionRepository.addReaction(reactionData);
      
      // Invalidate caches
      await this.invalidateMessageCaches(message.roomId, message.threadId);
        // Get updated message with new reaction
      const updatedMessage = await this.messageRepository.findById(messageId);
      if (!updatedMessage) {
        throw new NotFoundException(`Message not found after reaction update: ${messageId}`);
      }
      return this.transformToResponseDto(updatedMessage);
    } catch (error) {
      this.appLogger.error(`Failed to add reaction: ${error.message}`, {
        userId: user.id,
        messageId,
        emoji: reactionDto.emoji,
        errorStack: error.stack
      });
      
      if (error instanceof BadRequestException || 
          error instanceof ForbiddenException || 
          error instanceof NotFoundException ||
          error instanceof ConflictException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to add reaction. Please try again.',
        { cause: error }
      );
    }
  }
  
  /**
   * Creates a new thread or adds a message to an existing thread
   */
  async createThread(
    threadDto: CreateThreadDto,
    user: UserWithoutPassword
  ): Promise<{ threadId: string }> {
    try {
      // Validate root message exists
      const rootMessage = await this.messageRepository.findById(threadDto.rootMessageId);
      if (!rootMessage) {
        throw new NotFoundException(`Root message with ID ${threadDto.rootMessageId} not found`);
      }
      
      // Check if message already has a thread
      if (rootMessage.threadId) {
        throw new ConflictException(`Message already belongs to thread ${rootMessage.threadId}`);
      }
      
      // Check user permissions for the room
      await this.validateRoomAccess(user.id, rootMessage.roomId);
      
      // Create thread
      const threadData: MessageThreadTypes.CreateThreadData = {
        rootMessageId: threadDto.rootMessageId,
        roomId: rootMessage.roomId,
        title: threadDto.title,
        initialParticipants: [
          user.id,
          rootMessage.authorId,
          ...(threadDto.initialParticipants || [])
        ]
      };
      
      const thread = await this.threadRepository.create(threadData);
      
      // Update the root message with the thread ID
      await this.messageRepository.update(threadDto.rootMessageId, {
        threadId: thread.id
      });
      
      return { threadId: thread.id };
    } catch (error) {
      this.appLogger.error(`Failed to create thread: ${error.message}`, {
        userId: user.id,
        rootMessageId: threadDto.rootMessageId,
        errorStack: error.stack
      });
      
      if (error instanceof BadRequestException || 
          error instanceof ForbiddenException || 
          error instanceof NotFoundException ||
          error instanceof ConflictException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to create thread. Please try again.',
        { cause: error }
      );
    }
  }
  
  /**
   * Mark messages as read
   */
  async markAsRead(
    markAsReadDto: MarkAsReadDto,
    user: UserWithoutPassword
  ): Promise<{ success: boolean; count: number }> {
    try {
      if (!markAsReadDto.messageIds?.length) {
        throw new BadRequestException('No message IDs provided');
      }
      
      if (markAsReadDto.messageIds.length > MAX_BULK_OPERATIONS) {
        throw new BadRequestException(`Cannot mark more than ${MAX_BULK_OPERATIONS} messages at once`);
      }
        let successCount = 0;
      const errors: string[] = [];
      
      // Process messages in chunks for better performance
      const chunkSize = 25;
      for (let i = 0; i < markAsReadDto.messageIds.length; i += chunkSize) {
        const chunk = markAsReadDto.messageIds.slice(i, i + chunkSize);
        
        try {
          // Mark messages as read
          const readCount = await this.messageRepository.markManyAsRead(
            chunk,
            user.id
          );
          
          successCount += readCount;
        } catch (error) {
          errors.push(`Failed to mark chunk ${i}-${i+chunkSize}: ${error.message}`);
        }
      }
      
      // If some messages couldn't be marked, log it but continue
      if (errors.length) {
        this.appLogger.warn('Some messages could not be marked as read', {
          userId: user.id,
          errors
        });
      }
      
      // If no messages were marked as read despite valid IDs, throw error
      if (successCount === 0) {
        throw new BadRequestException('Failed to mark any messages as read. Check permissions or message IDs.');
      }
      
      return {
        success: true,
        count: successCount
      };
    } catch (error) {
      this.appLogger.error(`Failed to mark messages as read: ${error.message}`, {
        userId: user.id,
        messageIds: markAsReadDto.messageIds,
        errorStack: error.stack
      });
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to mark messages as read. Please try again.',
        { cause: error }
      );
    }
  }
  
  /**
   * Flag a message for moderation
   */
  async flagMessage(
    flagDto: FlagMessageDto,
    user: UserWithoutPassword
  ): Promise<{ success: boolean; moderationId: string }> {
    try {
      // Validate message exists
      const message = await this.messageRepository.findById(flagDto.messageId);
      if (!message) {
        throw new NotFoundException(`Message with ID ${flagDto.messageId} not found`);
      }
      
      // Check if user has already flagged this message
      const alreadyFlagged = message.messageFlags.some(
        flag => flag === MessageFlag.FLAGGED
      );
      
      if (alreadyFlagged) {
        throw new ConflictException('This message has already been flagged for moderation');
      }
      
      // Add flag to message
      const updateResult = await this.messageRepository.update(flagDto.messageId, {
        messageFlags: [...(message.messageFlags || []), MessageFlag.FLAGGED]
      });
      
      if (!updateResult) {
        throw new InternalServerErrorException('Failed to flag message');
      }
      
      // Create moderation entry (implementation would depend on moderation module)
      const moderationId = 'mod-' + Date.now().toString(36);
      
      // Log moderation activity
      this.appLogger.log('Message flagged for moderation', {
        messageId: flagDto.messageId,
        reportedBy: user.id,
        reason: flagDto.reason,
        flag: flagDto.flag,
        moderationId
      });
      
      return {
        success: true,
        moderationId
      };
    } catch (error) {
      this.appLogger.error(`Failed to flag message: ${error.message}`, {
        userId: user.id,
        messageId: flagDto.messageId,
        errorStack: error.stack
      });
      
      if (error instanceof BadRequestException || 
          error instanceof ForbiddenException || 
          error instanceof NotFoundException ||
          error instanceof ConflictException) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        'Failed to flag message. Please try again.',
        { cause: error }
      );
    }
  }
  async getMessages(pagination: PaginationDto, searchDto?: MessageSearchDto): Promise<PaginatedMessagesDto> {
    try {      // Use the available search method from the simple repository interface
      const searchOptions = {
        query: searchDto?.query || '',
        roomId: searchDto?.roomId,
        authorId: searchDto?.authorId,
        type: searchDto?.type,
        page: pagination?.page || 1,
        limit: pagination?.limit || 25,
        sortBy: pagination?.sortBy || 'createdAt',
        sortDirection: pagination?.sortDirection || 'desc'
      };

      const result = await this.messageRepository.search(searchOptions as any);

      return {
        messages: (result as any).data?.map((message: Message) => this.transformToResponseDto(message)) || [],
        pagination: {
          totalItems: (result as any).pagination?.total || 0,
          currentPage: (result as any).pagination?.page || 1,
          totalPages: (result as any).pagination?.totalPages || 1,
          itemsPerPage: (result as any).pagination?.limit || 25,
          hasNextPage: (result as any).pagination?.hasNext || false,
          hasPreviousPage: (result as any).pagination?.hasPrev || false
        }
      };
    } catch (error) {
      this.logger.error('Failed to get messages', error.stack);
      throw new InternalServerErrorException('Failed to retrieve messages');
    }
  }
  async getRecentMessages(roomId?: string, limit: number = 50): Promise<MessageResponseDto[]> {
    try {      if (roomId) {
        // Use findPaginated method instead
        const result = await this.messageRepository.findPaginated(
          { roomId: { equals: roomId } } as any,
          { 
            limit, 
            page: 1,
            sortBy: ['createdAt'] as any,
            sortOrder: 'desc' 
          } as any
        );
        return result.data.map(message => this.transformToResponseDto(message));
      } else {
        // For all rooms, use findPaginated with empty filter
        const result = await this.messageRepository.findPaginated(
          {} as any,
          { 
            limit, 
            page: 1,
            sortBy: ['createdAt'] as any,
            sortOrder: 'desc' 
          } as any
        );
        return result.data.map(message => this.transformToResponseDto(message));
      }
    } catch (error) {
      this.logger.error('Failed to get recent messages', error.stack);
      throw new InternalServerErrorException('Failed to retrieve recent messages');
    }
  }
  async searchMessages(searchDto: MessageSearchDto, pagination: PaginationDto): Promise<PaginatedMessagesDto> {
    try {
      // Use the repository's search method instead of building raw filters
      const searchOptions = {
        query: searchDto.query || '',
        roomId: searchDto.roomId,
        userId: searchDto.authorId, // Map authorId to userId for the search interface
        dateFrom: searchDto.fromDate,
        dateTo: searchDto.toDate,
        page: pagination.page || 1,
        limit: pagination.limit || 25,
        sortBy: pagination.sortBy || 'createdAt',
        sortOrder: pagination.sortDirection || 'desc'
      };      const result = await this.messageRepository.search(searchOptions as any);

      return {
        messages: (result as any).data?.map((message: Message) => this.transformToResponseDto(message)) || [],
        pagination: {
          totalItems: (result as any).pagination?.total || 0,
          currentPage: (result as any).pagination?.page || 1,
          totalPages: (result as any).pagination?.totalPages || 1,
          itemsPerPage: (result as any).pagination?.limit || 25,
          hasNextPage: (result as any).pagination?.hasNext || false,
          hasPreviousPage: (result as any).pagination?.hasPrev || false
        }
      };
    } catch (error) {
      this.logger.error('Failed to search messages', error.stack);
      throw new InternalServerErrorException('Failed to search messages');
    }
  }

  async getMessageById(id: string): Promise<MessageResponseDto> {
    try {
      const message = await this.messageRepository.findById(id);
      if (!message) {
        throw new NotFoundException(`Message with ID ${id} not found`);
      }
      return this.transformToResponseDto(message);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get message by ID: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve message');
    }
  }

  async updateMessage(id: string, updateDto: UpdateMessageDto, user: UserWithoutPassword): Promise<MessageResponseDto> {
    try {
      const message = await this.messageRepository.findById(id);
      if (!message) {
        throw new NotFoundException(`Message with ID ${id} not found`);      }

      if (message.userId.toString() !== user.id) {
        throw new ForbiddenException('You can only update your own messages');
      }

      const updateData: UpdateMessageData = {
        content: updateDto.content,
        isEdited: true,
        editedAt: new Date()
      };

      const updatedMessage = await this.messageRepository.update(id, updateData);
      if (!updatedMessage) {
        throw new InternalServerErrorException('Failed to update message');
      }

      return this.transformToResponseDto(updatedMessage);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to update message: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to update message');
    }
  }

  async deleteMessage(id: string, user: UserWithoutPassword): Promise<{ message: string }> {
    try {
      const message = await this.messageRepository.findById(id);
      if (!message) {
        throw new NotFoundException(`Message with ID ${id} not found`);
      }      if (message.userId.toString() !== user.id) {
        throw new ForbiddenException('You can only delete your own messages');
      }

      await this.messageRepository.softDelete(id, user.id);
      return { message: 'Message deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to delete message: ${id}`, error.stack);
      throw new InternalServerErrorException('Failed to delete message');
    }
  }
  
  // Helper methods
  
  /**
   * Validate message content
   */
  private async validateMessageContent(content: string): Promise<void> {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Message content cannot be empty');
    }
    
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
    }
    
    // Additional validation could be added here:
    // - Content filtering
    // - Spam detection
    // - Rate limiting checks
  }
  
  /**
   * Validate that a user has access to a room
   */
  private async validateRoomAccess(userId: string, roomId?: string): Promise<void> {
    // If no room ID is provided, assume it's the default room
    if (!roomId) {
      return;
    }
    
    // Implementation would check if user has access to this room
    // This is a placeholder - in a real application, you would check against a room repository
    return Promise.resolve();
  }
  
  /**
   * Validate thread access
   */
  private async validateThreadAccess(threadId: string, userId: string): Promise<void> {
    if (!threadId) {
      return;
    }
    
    const thread = await this.threadRepository.findById(threadId);
    if (!thread) {
      throw new NotFoundException(`Thread with ID ${threadId} not found`);
    }
    
    // In a real implementation:
    // - Check if thread is in a room user has access to
    // - Check if thread is active
    // - Check if user is a participant or can join
  }
  
  /**
   * Validate reply-to message
   */
  private async validateReplyToMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      throw new NotFoundException(`Reply-to message with ID ${messageId} not found`);
    }
    
    // Validate room access for the message being replied to
    await this.validateRoomAccess(userId, message.roomId);
  }
  
  /**
   * Invalidate message caches
   */
  private async invalidateMessageCaches(roomId?: string, threadId?: string): Promise<void> {
    // Invalidate room messages cache
    if (roomId) {
      await this.cache.invalidatePattern(`messages:room:${roomId}:*`);
    }
    
    // Invalidate thread messages cache
    if (threadId) {
      await this.cache.invalidatePattern(`messages:thread:${threadId}:*`);
      await this.cache.invalidate(`thread:${threadId}`);
    }
    
    // Invalidate recent messages cache
    await this.cache.invalidate('messages:recent');
  }
  
  /**
   * Transform a message entity into a response DTO
   */
  private transformToResponseDto(message: Message): MessageResponseDto {
    if (!message) {
      throw new Error('Cannot transform undefined message to DTO');
    }
    
    const metadata = message.metadata || {};
    const threadId = metadata.threadId || message.threadId;
    
    return {
      id: message.id,
      content: message.content,
      authorId: message.authorId,
      authorUsername: message.authorUsername,
      timestamp: message.timestamp || message.createdAt,
      type: message.type,
      roomId: message.roomId || '',
      imageUrl: message.imageUrl,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      thread: threadId ? {
        id: threadId,
        // Other thread details would be populated in a real implementation
        participantCount: 0,
        messageCount: 0      } : undefined,
      reactions: message.reactions?.map(reaction => ({
        emoji: reaction.emoji,
        count: 1,
        reacted: false, // Add the missing reacted property - this would be set based on current user in real implementation
        users: [reaction.userId] // Change to array of usernames/userIds
      })) || [],      mentions: message.mentions?.map(mention => ({
        userId: mention.userId,
        username: mention.username,
        startIndex: mention.startIndex,
        endIndex: mention.endIndex,
        notified: mention.notified
      })) || [],
      readStatus: {
        count: message.readBy?.length || 0,
        hasRead: false, // Would be determined based on current user
        readers: message.readBy?.map(r => r.userId) || []
      },
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
      attachments: message.attachments?.map(att => ({
        id: att.id,
        filename: att.filename,
        originalName: att.originalName,
        mimeType: att.mimeType,
        size: att.size,
        url: att.url
      })) || []
    };
  }
}
