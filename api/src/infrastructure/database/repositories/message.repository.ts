import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from '../models/message.schema';
import { User, UserDocument } from '../models/user.schema';
import { 
  IMessageRepository, 
  PaginatedResult, 
  PaginationOptions,
  SearchOptions 
} from '../../../domain/interfaces';
import { Message as MessageEntity, MessageWithUser, MessageType, UserWithoutPassword } from '../../../domain/entities';

@Injectable()
export class MessageRepository implements IMessageRepository {
  private readonly logger = new Logger(MessageRepository.name);

  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    this.initializeIndexes();
  }

  /**
   * Initialize MongoDB indexes for optimal performance
   */
  private async initializeIndexes(): Promise<void> {
    try {
      // Get existing indexes first
      const existingIndexes = await this.messageModel.collection.listIndexes().toArray();
      const indexMap = new Map(existingIndexes.map(idx => [JSON.stringify(idx.key), idx.name]));
      
      // Helper function to create or skip index
      const ensureIndex = async (key: any, options: any) => {
        const keyStr = JSON.stringify(key);
        if (indexMap.has(keyStr)) {
          this.logger.log(`Index for ${keyStr} already exists as '${indexMap.get(keyStr)}', skipping creation`);
          return;
        }
        
        try {
          await this.messageModel.collection.createIndex(key, options);
          this.logger.log(`Created index '${options.name}'`);
        } catch (error) {
          if (error.message?.includes('already exists with a different name')) {
            this.logger.warn(`Index ${keyStr} already exists with a different name, skipping`);
          } else {
            throw error;
          }
        }
      };
      
      // Create indexes using the helper function
      await ensureIndex(
        { roomId: 1, createdAt: -1 },
        { name: 'room_messages_time' }
      );

      await ensureIndex(
        { content: 'text' },
        { name: 'content_search' }
      );

      await ensureIndex(
        { userId: 1, createdAt: -1 },
        { name: 'user_messages_time' }
      );

      await ensureIndex(
        { deletedAt: 1 },
        { name: 'deleted_messages', sparse: true }
      );

      await ensureIndex(
        { createdAt: 1 },
        { 
          name: 'message_ttl', 
          expireAfterSeconds: 365 * 24 * 60 * 60, // 1 year
          partialFilterExpression: { messageType: 'TEMP' }
        }
      );

      this.logger.log('MongoDB indexes initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing indexes:', error);
    }
  }

  async create(messageData: Omit<MessageEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageEntity> {
    try {
      // Validate ObjectId strings before creating ObjectIds
      if (!Types.ObjectId.isValid(messageData.userId)) {
        throw new Error(`Invalid userId format: ${messageData.userId}`);
      }

      if (messageData.roomId && !Types.ObjectId.isValid(messageData.roomId)) {
        throw new Error(`Invalid roomId format: ${messageData.roomId}`);
      }

      this.logger.log(`Creating message with userId: ${messageData.userId}, type: ${typeof messageData.userId}`);

      const message = new this.messageModel({
        ...messageData,
        userId: new Types.ObjectId(messageData.userId),
        roomId: messageData.roomId ? new Types.ObjectId(messageData.roomId) : undefined,
      });

      const savedMessage = await message.save();
      await savedMessage.populate({
        path: 'userId',
        select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
      });

      return this.mapToEntity(savedMessage);
    } catch (error) {
      this.logger.error(`Error creating message: ${error.message}`, error.stack);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async findById(id: string): Promise<MessageEntity | null> {
    try {
      const message = await this.messageModel
        .findById(id)
        .populate({
          path: 'userId',
          select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
        })
        .exec();

      return message ? this.mapToEntity(message) : null;
    } catch (error) {
      this.logger.error(`Error finding message by ID ${id}: ${error.message}`, error.stack);
      return null;
    }
  }

  async findByRoomId(
    roomId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<MessageEntity>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      const filter = {
        roomId: new Types.ObjectId(roomId),
        deletedAt: { $exists: false },
      };

      const [messages, total] = await Promise.all([
        this.messageModel
          .find(filter)
          .populate({
            path: 'userId',
            select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
          })
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.messageModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: messages.map(msg => this.mapToEntity(msg)),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error finding messages by room ID ${roomId}: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  async update(id: string, messageData: Partial<MessageEntity>): Promise<MessageEntity | null> {
    try {
      const message = await this.messageModel
        .findByIdAndUpdate(
          id,
          { ...messageData, updatedAt: new Date(), isEdited: true, editedAt: new Date() },
          { new: true }
        )
        .populate({
          path: 'userId',
          select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
        })
        .exec();

      return message ? this.mapToEntity(message) : null;
    } catch (error) {
      this.logger.error(`Error updating message ${id}: ${error.message}`, error.stack);
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }

  async softDelete(id: string, deletedBy: string): Promise<boolean> {
    try {
      this.logger.log(`Soft deleting message ${id} by user ${deletedBy}`);
      
      const result = await this.messageModel.findByIdAndUpdate(
        id,
        { 
          deletedAt: new Date(),
          deletedBy: new Types.ObjectId(deletedBy),
          updatedAt: new Date()
        },
        { new: true }
      );

      if (result) {
        this.logger.log(`Message ${id} soft deleted successfully`);
        return true;
      } else {
        this.logger.warn(`Message ${id} not found for soft deletion`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error soft deleting message ${id}: ${error.message}`, error.stack);
      throw new Error(`Failed to soft delete message: ${error.message}`);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.messageModel
        .findByIdAndUpdate(id, { deletedAt: new Date() })
        .exec();

      return !!result;
    } catch (error) {
      this.logger.error(`Error deleting message ${id}: ${error.message}`, error.stack);
      return false;
    }
  }

  async search(options: SearchOptions): Promise<PaginatedResult<MessageEntity>> {
    try {
      const { query, dateFrom, dateTo, userId, roomId, page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;

      const filter: any = {
        deletedAt: { $exists: false },
      };

      // Text search
      if (query) {
        filter.$text = { $search: query };
      }

      // Date range filter
      if (dateFrom || dateTo) {
        filter.createdAt = {};
        if (dateFrom) filter.createdAt.$gte = dateFrom;
        if (dateTo) filter.createdAt.$lte = dateTo;
      }

      // User filter
      if (userId) {
        filter.userId = new Types.ObjectId(userId);
      }

      // Room filter
      if (roomId) {
        filter.roomId = new Types.ObjectId(roomId);
      }

      const [messages, total] = await Promise.all([
        this.messageModel
          .find(filter)
          .populate({
            path: 'userId',
            select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
          })
          .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.messageModel.countDocuments(filter),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: messages.map(msg => this.mapToEntity(msg)),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error searching messages: ${error.message}`, error.stack);
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }

  async findRecentMessages(roomId: string, limit: number = 50): Promise<MessageEntity[]> {
    try {
      const messages = await this.messageModel
        .find({
          roomId: new Types.ObjectId(roomId),
          deletedAt: { $exists: false },
        })
        .populate({
          path: 'userId',
          select: 'username email avatar avatarUrl textColor backgroundColor status isOnline',
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();

      return messages.reverse().map(msg => this.mapToEntity(msg));
    } catch (error) {
      this.logger.error(`Error finding recent messages for room ${roomId}: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch recent messages: ${error.message}`);
    }
  }

  /**
   * Execute MongoDB aggregation pipeline
   */
  async aggregate(pipeline: any[]): Promise<any[]> {
    try {
      this.logger.log(`Executing aggregation pipeline with ${pipeline.length} stages`);
      const results = await this.messageModel.aggregate(pipeline).exec();
      return results;
    } catch (error) {
      this.logger.error(`Error executing aggregation pipeline: ${error.message}`, error.stack);
      throw new Error(`Failed to execute aggregation: ${error.message}`);
    }
  }

  /**
   * Get optimized paginated messages with aggregation pipeline
   */  async findByRoomOptimized(
    roomId: string,
    options: Partial<PaginationOptions> = {}
  ): Promise<PaginatedResult<MessageWithUser>> {
    const startTime = Date.now();
    
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;      // Use aggregation pipeline for optimal performance
      const pipeline: any[] = [
        {
          $match: {
            roomId: new Types.ObjectId(roomId),
            deletedAt: { $exists: false },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
            pipeline: [
              {
                $project: {
                  username: 1,
                  email: 1,
                  avatar: 1,
                  avatarUrl: 1,
                  textColor: 1,
                  backgroundColor: 1,
                  status: 1,
                  isOnline: 1,
                },
              },
            ],
          },
        },
        {
          $unwind: '$user',
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $facet: {
            data: [{ $skip: skip }, { $limit: limit }],
            count: [{ $count: 'total' }],
          },
        },
      ];

      const [result] = await this.messageModel.aggregate(pipeline).exec();
      const messages = result.data || [];
      const total = result.count[0]?.total || 0;
      
      const queryTime = Date.now() - startTime;
      this.logger.debug(`Optimized room query completed in ${queryTime}ms`);

      const totalPages = Math.ceil(total / limit);

      return {
        data: messages.reverse().map((msg: any) => this.mapAggregatedToEntity(msg)),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error in optimized room query: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  /**
   * Get room statistics using aggregation
   */
  async getRoomStatistics(roomId: string): Promise<any> {
    try {
      const pipeline = [
        {
          $match: {
            roomId: new Types.ObjectId(roomId),
            deletedAt: { $exists: false },
          },
        },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            messageTypes: { $push: '$messageType' },
            firstMessage: { $min: '$createdAt' },
            lastMessage: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            _id: 0,
            totalMessages: 1,
            uniqueUserCount: { $size: '$uniqueUsers' },
            messageTypeDistribution: {
              $reduce: {
                input: '$messageTypes',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $arrayToObject: [
                        [{ k: '$$this', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this', input: '$$value' } }, 0] }, 1] } }]
                      ]
                    }
                  ]
                }
              }
            },
            firstMessage: 1,
            lastMessage: 1,
          },
        },
      ];

      const [stats] = await this.messageModel.aggregate(pipeline).exec();
      return stats || {
        totalMessages: 0,
        uniqueUserCount: 0,
        messageTypeDistribution: {},
        firstMessage: null,
        lastMessage: null,
      };
    } catch (error) {
      this.logger.error(`Error getting room statistics: ${error.message}`, error.stack);
      throw new Error(`Failed to get room statistics: ${error.message}`);
    }
  }

  /**
   * Cleanup old deleted messages
   */
  async cleanupDeletedMessages(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.messageModel.deleteMany({
        deletedAt: { $lt: cutoffDate },
      });

      this.logger.log(`Cleaned up ${result.deletedCount} old deleted messages`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error(`Error cleaning up deleted messages: ${error.message}`, error.stack);
      throw new Error(`Failed to cleanup deleted messages: ${error.message}`);
    }
  }
  /**
   * Check query performance and log slow queries
   */
  async explainQuery(roomId: string): Promise<any> {
    try {
      const query = this.messageModel.find({
        roomId: new Types.ObjectId(roomId),
        deletedAt: { $exists: false },
      }).sort({ createdAt: -1 });

      const explanation = await query.explain('executionStats') as any;
      
      // Log if query is slow
      const executionTime = explanation.executionStats?.executionTimeMillis || 0;
      if (executionTime > 100) {
        this.logger.warn(`Slow query detected: ${executionTime}ms for room ${roomId}`);
      }

      return explanation;
    } catch (error) {
      this.logger.error(`Error explaining query: ${error.message}`, error.stack);
      throw error;
    }
  }

  private mapToEntity(messageDoc: MessageDocument): MessageEntity {
    const user = messageDoc.userId as any;
    // Extract the original userId before population
    const originalUserId = user && user._id ? user._id.toString() : messageDoc.userId.toString();
    
    return {
      id: (messageDoc._id as any).toString(),
      content: messageDoc.content,
      userId: originalUserId,
      roomId: messageDoc.roomId?.toString(),
      messageType: messageDoc.messageType,
      attachments: messageDoc.attachments?.map(id => id.toString()) || [],
      metadata: messageDoc.metadata || {},
      reactions: messageDoc.reactions || [],
      isEdited: messageDoc.isEdited,
      editedAt: messageDoc.editedAt,
      replyToId: messageDoc.replyToId?.toString(),
      createdAt: (messageDoc as any).createdAt,
      updatedAt: (messageDoc as any).updatedAt,
      // User information if populated
      ...(user && user._id && {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          avatarUrl: user.avatarUrl,
          textColor: user.textColor,
          backgroundColor: user.backgroundColor,
          status: user.status,
          isOnline: user.isOnline,
        },
      }),
    };
  }  private mapAggregatedToEntity(msgData: any): MessageWithUser {
    return {
      id: msgData._id.toString(),
      content: msgData.content,
      authorId: msgData.userId.toString(),
      userId: msgData.userId.toString(),
      authorUsername: msgData.user?.username || 'Unknown',
      type: msgData.messageType || msgData.type,
      imageUrl: msgData.imageUrl,
      isEdited: msgData.isEdited || false,
      editedAt: msgData.editedAt,
      roomId: msgData.roomId?.toString(),
      threadId: msgData.threadId?.toString(),
      replyToId: msgData.replyToId?.toString(),
      mentions: msgData.mentions || [],
      editHistory: msgData.editHistory || [],
      readBy: msgData.readBy || [],
      deliveredTo: msgData.deliveredTo || [],
      priority: msgData.priority || 'normal',
      status: msgData.status || 'sent',
      attachments: msgData.attachments || [],
      reactions: msgData.reactions || [],
      metadata: msgData.metadata || {},
      messageFlags: msgData.messageFlags || [],
      searchableContent: msgData.content || '',
      timestamp: msgData.createdAt,
      createdAt: msgData.createdAt,
      updatedAt: msgData.updatedAt,
      user: {
        id: msgData.user._id.toString(),
        username: msgData.user.username,
        email: msgData.user.email,
        avatar: msgData.user.avatar,
        avatarUrl: msgData.user.avatarUrl,
        textColor: msgData.user.textColor,
        backgroundColor: msgData.user.backgroundColor,
        status: msgData.user.status,
        isOnline: msgData.user.isOnline,
        createdAt: msgData.user.createdAt || msgData.createdAt,
        updatedAt: msgData.user.updatedAt || msgData.updatedAt,
        metadata: msgData.user.metadata || {},
        lastSeen: msgData.user.lastSeen || new Date(),
      } as UserWithoutPassword,
    };
  }
}
