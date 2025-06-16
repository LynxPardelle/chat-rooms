import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, Inject } from '@nestjs/common';
import { WsJwtGuard, CurrentUser } from '../security';
import { UserWithoutPassword } from '../../domain/entities';
import { UserStatus } from '../../domain/types';
import { MessageService } from '../../application/services';
import {
  CreateMessageDto,
  TypingIndicatorDto,
  MessageResponseDto,
  MessageType,
  MessagePriority,
  AddReactionDto
} from '../../application/dtos/message.dto';
import { WebSocketConfigService } from './websocket.config';
import { SocketErrorDto } from './dto/socket-error.dto';
// Import optimization services
import { RedisCacheService } from '../cache/redis-cache.service';
import { PerformanceService } from '../monitoring/performance.service';
// Import new WebSocket services
import {
  RealtimeSyncService,
  BroadcastingService,
  MessageQueueService,
  PresenceService,
  TypingService,
  ReadReceiptService,
  NotificationService
} from './services';
import { SocketService } from './socket.service';

// Enhanced rate limiting types
interface UserRateLimits {
  messages: { count: number; lastReset: number };
  typing: { count: number; lastReset: number; lastEmit: number };
  joinRoom: { count: number; lastReset: number };
}

// Enhanced typing indicator type
interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

// Room management optimizations
interface RoomOptimizations {
  lastBroadcast: number;
  cachedUserCount: number;
  messageBuffer: any[];
  lastCleanup: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: 'chat'
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedClients = new Map<string, Socket>();
  private readonly connectedUsers = new Map<string, string>(); // userId -> socketId
  private readonly userRateLimits = new Map<string, UserRateLimits>();
  private readonly typingUsers = new Map<string, Set<TypingUser>>();
  private readonly roomParticipants = new Map<string, Set<string>>();
  private readonly threadParticipants = new Map<string, Set<string>>();
  
  // Optimization enhancements
  private readonly roomOptimizations = new Map<string, RoomOptimizations>();
  private readonly connectionPools = new Map<string, Set<string>>();
  private readonly messageBuffer = new Map<string, any[]>();
  private readonly lastCleanupTime: number = Date.now();
  private readonly compressionEnabled: boolean = true;
  private readonly connectionLimits = {
    maxConnectionsPerUser: 5,
    maxConnectionsTotal: 10000,
    connectionTimeoutMs: 30000,
    heartbeatIntervalMs: 30000
  };

  // Settings loaded from config
  private readonly heartbeatInterval: NodeJS.Timeout;
  private readonly TYPING_TIMEOUT_MS = 5000; // Time when typing indicator expires
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly INACTIVE_TIMEOUT_MS = 120000; // 2 minutes
  private readonly TYPING_DEBOUNCE_MS = 1000; // Debounce for typing events
  private readonly MAX_RECONNECT_ATTEMPTS = 3;

  constructor(
    private readonly messageService: MessageService,
    private readonly configService: WebSocketConfigService,
    private readonly cacheService: RedisCacheService,
    private readonly performanceService: PerformanceService,
    private readonly realtimeSyncService: RealtimeSyncService,
    private readonly broadcastingService: BroadcastingService,
    private readonly messageQueueService: MessageQueueService,
    private readonly presenceService: PresenceService,
    private readonly typingService: TypingService,
    private readonly readReceiptService: ReadReceiptService,
    private readonly notificationService: NotificationService,
    private readonly socketService: SocketService
  ) {
    // Start heartbeat checks
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeatCheck();
    }, this.HEARTBEAT_INTERVAL_MS);
    
    // Start performance monitoring
    setInterval(() => {
      this.monitorPerformance();
    }, 60000); // Monitor every minute
    
    // Start cleanup operations
    setInterval(() => {
      this.performCleanupOperations();
    }, 300000); // Cleanup every 5 minutes
  }
  /**
   * Initialize gateway with configuration and settings
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    
    // Set server reference for BroadcastingService
    this.broadcastingService.setServer(server);
    
    // Configure Socket.io middleware for authentication
    server.use((socket, next) => {
      try {
        // Authentication happens through the WsJwtGuard
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });
  }

  /**
   * Handle new client connections
   */
  handleConnection(client: Socket) {
    try {
      // Skip authentication for connection - happens via WsJwtGuard in handlers
      this.logger.debug(`Client connected: ${client.id}`);
      
      // Initialize rate limiting for this client
      this.userRateLimits.set(client.id, {
        messages: { count: 0, lastReset: Date.now() },
        typing: { count: 0, lastReset: Date.now(), lastEmit: 0 },
        joinRoom: { count: 0, lastReset: Date.now() }
      });
      
      // Get user data from handshake auth if available
      const user = client.handshake.auth?.user as UserWithoutPassword;      // Store connection
      if (user?.id) {
        this.connectedClients.set(client.id, client);
        this.connectedUsers.set(user.id, client.id);
        
        // Register user with BroadcastingService
        this.broadcastingService.registerUser(user.id, client.id, client);
        
        // Set up message queue delivery callback
        this.messageQueueService.setDeliveryCallback(user.id, async (messages) => {
          for (const queuedMessage of messages) {
            try {
              client.emit(queuedMessage.eventType, queuedMessage.payload);
            } catch (error) {
              this.logger.error(`Failed to deliver queued message to ${user.id}: ${(error as Error).message}`);
              throw error; // Let the queue service handle retry logic
            }
          }
        });
          // Mark user as online in message queue service
        this.messageQueueService.markUserOnline(user.id).catch(error => {
          this.logger.error(`Failed to mark user online in message queue: ${(error as Error).message}`);
        });
        
        // Update presence service
        this.presenceService.setUserOnline(
          user.id, 
          client.id, // Use socket ID as device ID
          UserStatus.ONLINE, 
          undefined // No custom status
        ).catch(error => {
          this.logger.error(`Failed to set user online: ${error.message}`);
        });
        
        // Emit presence update
        this.server.emit('presence', {
          userId: user.id,
          username: user.username,
          status: 'online',
          timestamp: Date.now()
        });
        
        // Auto-join default room if configured
        const defaultRoom = this.configService.getDefaultRoom();
        if (defaultRoom) {
          this.joinRoom(client, { roomId: defaultRoom });
          // Also register with broadcasting service
          this.broadcastingService.joinRoom(user.id, defaultRoom);
        }
      }
    } catch (error) {
      this.logger.error(`Error in handleConnection: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle client disconnections
   */
  handleDisconnect(client: Socket) {
    try {
      const user = client.data.user as UserWithoutPassword | undefined;
      
      this.logger.log(`Client disconnected: ${client.id} ${user ? `(User: ${user.username})` : ''}`);
        // Clean up client data
      this.connectedClients.delete(client.id);
        if (user) {
        // Unregister from BroadcastingService
        this.broadcastingService.unregisterUser(user.id);
        
        // Remove message queue delivery callback and mark user offline
        this.messageQueueService.removeDeliveryCallback(user.id);
        this.messageQueueService.markUserOffline(user.id);
        
        // Update presence service
        this.presenceService.setUserOffline(user.id, client.id).catch(error => {
          this.logger.error(`Failed to set user offline: ${error.message}`);
        });
        
        // Remove from connected users
        this.connectedUsers.delete(user.id);
        
        // Remove from rate limits
        this.userRateLimits.delete(user.id);
          // Remove from typing indicators using new service
        const typingEvents = this.typingService.cleanupUserTyping(user.id);
        
        // Broadcast typing updates for all affected rooms
        for (const event of typingEvents) {
          this.broadcastingService.sendToRoom(
            event.threadId || event.roomId,
            'userTypingUpdate',
            event
          ).catch(error => {
            this.logger.error(`Failed to broadcast typing cleanup: ${error.message}`);
          });
        }
        
        // Remove from rooms
        this.removeUserFromAllRooms(user.id);
        
        // Broadcast user offline status
        this.server.emit('userOffline', {
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error(`Error handling disconnection: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle heartbeat to keep connection alive
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @CurrentUser() user: UserWithoutPassword
  ) {
    // Update last activity timestamp
    client.data.lastHeartbeat = Date.now();
    
    return {
      event: 'heartbeatResponse',
      data: {
        timestamp: new Date().toISOString(),
        userId: user.id
      }
    };
  }

  /**
   * Join a specific chat room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
    @CurrentUser() user?: UserWithoutPassword
  ) {
    try {
      if (!user) {
        user = client.data.user as UserWithoutPassword;
      }
      
      if (!user) {
        throw new WsException('User not authenticated');
      }
      
      const { roomId } = data;
      
      if (!roomId) {
        throw new WsException('Room ID is required');
      }
      
      // Check rate limiting for join room
      if (this.isRateLimited(user.id, 'joinRoom')) {
        throw new WsException('Rate limit exceeded for joining rooms');
      }
      
      // Update rate limit counter
      this.incrementRateLimit(user.id, 'joinRoom');      // Join the Socket.io room
      client.join(roomId);
      
      // Register with BroadcastingService
      this.broadcastingService.joinRoom(user.id, roomId);
      
      // Track room participants
      if (!this.roomParticipants.has(roomId)) {
        this.roomParticipants.set(roomId, new Set());
      }
      this.roomParticipants.get(roomId)?.add(user.id);
      
      this.logger.log(`User ${user.username} joined room ${roomId}`);
      
      // Notify others in the room using BroadcastingService
      await this.broadcastingService.sendToRoom(
        roomId,
        'userJoined',
        {
          userId: user.id,
          username: user.username,
          roomId,
          timestamp: new Date().toISOString()
        },
        [user.id] // Exclude the user who just joined
      ).catch(error => {
        this.logger.error(`Failed to broadcast user joined: ${error.message}`);
        // Fallback to direct emit
        client.to(roomId).emit('userJoined', {
          userId: user!.id,
          username: user!.username,
          roomId,
          timestamp: new Date().toISOString()
        });
      });
      
      // Respond to the client
      return {
        event: 'joinedRoom',
        data: {
          roomId,
          success: true,
          activeUsers: Array.from(this.roomParticipants.get(roomId) || []),
          timestamp: new Date().toISOString()
        }
      };    } catch (error) {
      return this.handleError(client, 'joinRoom', error);
    }
  }

  /**
   * Leave a specific chat room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  async leaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const { roomId } = data;
      
      if (!roomId) {
        throw new WsException('Room ID is required');
      }
        // Leave the Socket.io room
      client.leave(roomId);
      
      // Unregister from BroadcastingService
      this.broadcastingService.leaveRoom(user.id, roomId);
      
      // Update room participants
      if (this.roomParticipants.has(roomId)) {
        this.roomParticipants.get(roomId)?.delete(user.id);
        
        // Clean up empty rooms
        if ((this.roomParticipants.get(roomId)?.size || 0) === 0) {
          this.roomParticipants.delete(roomId);
        }
      }
      
      this.logger.log(`User ${user.username} left room ${roomId}`);
      
      // Notify others in the room using BroadcastingService
      await this.broadcastingService.sendToRoom(
        roomId,
        'userLeft',
        {
          userId: user.id,
          username: user.username,
          roomId,
          timestamp: new Date().toISOString()
        },
        [user.id] // Exclude the user who left
      ).catch(error => {
        this.logger.error(`Failed to broadcast user left: ${error.message}`);
        // Fallback to direct emit
        this.server.to(roomId).emit('userLeft', {
          userId: user.id,
          username: user.username,
          roomId,
          timestamp: new Date().toISOString()
        });
      });
      
      // Respond to the client
      return {
        event: 'leftRoom',
        data: {
          roomId,
          success: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'leaveRoom', error);
    }
  }

  /**
   * Send a message to a room
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageDto: CreateMessageDto,
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      // Check rate limiting for messages
      if (this.isRateLimited(user.id, 'messages')) {
        throw new WsException('Rate limit exceeded for sending messages');
      }
      
      // Increment rate limit counter
      this.incrementRateLimit(user.id, 'messages');
      
      // Get client metadata
      const metadata = {
        ipAddress: client.handshake.address,
        userAgent: client.handshake.headers['user-agent'] as string
      };

      // Create the message through the service
      const message = await this.messageService.createMessage(messageDto, user);
      
      // Sync message with realtime sync service
      const syncEvent = {
        id: `sync_${message.id}_${Date.now()}`,
        type: 'message' as const,
        payload: message,
        timestamp: Date.now(),
        userId: user.id,
        roomId: messageDto.roomId || 'default',
        threadId: messageDto.threadId,
        version: 1
      };
      
      await this.realtimeSyncService.syncEvent(syncEvent).catch(error => {
        this.logger.error(`Failed to sync message creation: ${error.message}`);
      });
        // Use BroadcastingService for intelligent message distribution
      const broadcastEvent = {
        id: `broadcast_${message.id}_${Date.now()}`,
        type: 'message',
        payload: message,
        timestamp: Date.now(),
        priority: (messageDto.priority as any) || 'normal',
        targetRooms: messageDto.roomId ? [messageDto.roomId] : [],
        targetUsers: message.mentions?.map(m => m.userId) || [],
        excludeUsers: []
      };
      
      // Broadcast using the intelligent broadcasting service
      await this.broadcastingService.broadcast(
        broadcastEvent as any
      ).catch(error => {
        this.logger.error(`Failed to broadcast message: ${error.message}`);
        // Fallback to direct broadcast
        this.fallbackBroadcast(messageDto, message);
      });
      
      // Queue message for offline users if needed
      await this.messageQueueService.queueMessage(
        message.id,
        messageDto.roomId || 'default',
        message,
        'high'
      ).catch(error => {
        this.logger.error(`Failed to queue message for offline users: ${error.message}`);
      });

      // Remove typing indicator after sending message  
      if (messageDto.threadId) {
        this.removeUserTyping(user.id, messageDto.roomId || 'default', messageDto.threadId);
      } else {
        this.removeUserTyping(user.id, messageDto.roomId || 'default');
      }
        // Handle special mention notifications through BroadcastingService
      if (message.mentions && message.mentions.length > 0) {
        const mentionEvent = {
          id: `mention_${message.id}_${Date.now()}`,
          type: 'mention',
          payload: {
            messageId: message.id,
            mentionedBy: user.username,
            roomId: messageDto.roomId,
            threadId: messageDto.threadId,
            message: message.content,
            timestamp: new Date().toISOString()
          },
          timestamp: Date.now(),
          priority: 'high',
          targetRooms: [],
          targetUsers: message.mentions.map(m => m.userId),
          excludeUsers: [user.id] // Don't notify the sender
        };
        
        await this.broadcastingService.broadcast(
          mentionEvent as any
        ).catch(error => {
          this.logger.error(`Failed to broadcast mentions: ${error.message}`);
        });
      }
        // If this is a thread message, also notify the room about activity
      if (messageDto.threadId && messageDto.roomId) {
        const threadActivityEvent = {
          id: `thread_activity_${message.id}_${Date.now()}`,
          type: 'thread_activity',
          payload: {
            threadId: messageDto.threadId,
            messageId: message.id,
            userId: user.id,
            username: user.username,
            timestamp: new Date().toISOString()
          },
          timestamp: Date.now(),
          priority: 'normal',
          targetRooms: [messageDto.roomId],
          targetUsers: [],
          excludeUsers: [user.id]
        };
        
        await this.broadcastingService.broadcast(
          threadActivityEvent as any
        ).catch(error => {
          this.logger.error(`Failed to broadcast thread activity: ${error.message}`);
        });
      }
        // Respond to sender
      return {
        event: 'messageSent',
        data: {
          id: message.id,
          success: true,
          timestamp: new Date().toISOString(),
          deliveredTo: this.broadcastingService.getRoomInfo(messageDto.roomId || 'default').members
        }
      };    } catch (error) {
      return this.handleError(client, 'sendMessage', error);
    }
  }

  /**
   * Fallback broadcast method when BroadcastingService fails
   */
  private fallbackBroadcast(messageDto: CreateMessageDto, message: any) {
    try {
      const targetRoom = messageDto.threadId || messageDto.roomId;
      
      if (targetRoom) {
        this.server.to(targetRoom).emit('receiveMessage', message);
      } else {
        this.server.emit('receiveMessage', message);
      }
      
      this.logger.warn('Used fallback broadcast due to BroadcastingService failure');
    } catch (fallbackError) {
      this.logger.error(`Fallback broadcast also failed: ${fallbackError.message}`);
    }
  }

  /**
   * Handle typing indicator
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: TypingIndicatorDto,
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      // Get current timestamp
      const now = Date.now();
      
      // Check rate limiting for typing
      if (this.isRateLimited(user.id, 'typing')) {
        // Don't throw exception for typing - just ignore
        return { event: 'typingUpdated', data: { success: false } };
      }
      
      // Check debounce - don't send typing events too frequently
      const userLimits = this.userRateLimits.get(user.id);
      if (userLimits && now - userLimits.typing.lastEmit < this.TYPING_DEBOUNCE_MS) {
        // Silently ignore rapid typing events
        return { event: 'typingUpdated', data: { success: false } };
      }      // Update typing status
      if (data.isTyping) {
        // Add user to typing set
        this.addUserTyping(user, data.roomId, data.threadId);
        
        // Update presence with typing activity
        try {
          this.presenceService.updateUserActivity(user.id, 'typing');
        } catch (error) {
          this.logger.error(`Failed to update typing activity: ${(error as Error).message}`);
        }
        
        // Update last emit time
        if (userLimits) {
          userLimits.typing.lastEmit = now;
        }
        
        // Increment rate limit counter
        this.incrementRateLimit(user.id, 'typing');
      } else {
        // Remove user from typing set
        this.removeUserTyping(user.id, data.roomId, data.threadId);
        
        // Update presence activity
        try {
          this.presenceService.updateUserActivity(user.id, 'idle');
        } catch (error) {
          this.logger.error(`Failed to update idle activity: ${(error as Error).message}`);
        }
      }
      
      // Broadcast typing status using BroadcastingService
      const targetRoom = data.threadId || data.roomId;
      const typingUsers = this.getTypingUsers(data.roomId, data.threadId)
        .filter(typingUser => typingUser.userId !== user.id); // Don't include the user that's typing
      
      await this.broadcastingService.sendToRoom(
        targetRoom,
        'typingStatus',
        {
          roomId: data.roomId,
          threadId: data.threadId,
          users: typingUsers.map(u => ({
            userId: u.userId,
            username: u.username
          })),
          timestamp: new Date().toISOString()
        },
        [user.id] // Exclude the typing user
      ).catch(error => {
        this.logger.error(`Failed to broadcast typing status: ${error.message}`);
        // Fallback to direct emit
        this.server.to(targetRoom).emit('typingStatus', {
          roomId: data.roomId,
          threadId: data.threadId,
          users: typingUsers.map(u => ({
            userId: u.userId,
            username: u.username
          })),
          timestamp: new Date().toISOString()
        });
      });
      
      return {
        event: 'typingUpdated',
        data: { 
          success: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'typing', error);
    }
  }

  /**
   * Enhanced typing start event using TypingService
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('userStartTyping')
  async handleUserStartTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; threadId?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const typingEvent = this.typingService.startTyping(
        user.id,
        user.username,
        data.roomId,
        data.threadId,
        client.id
      );

      if (typingEvent) {
        // Broadcast to room excluding the typing user
        await this.broadcastingService.sendToRoom(
          data.threadId || data.roomId,
          'userTypingUpdate',
          typingEvent,
          [user.id]
        );

        // Update presence activity
        this.presenceService.updateUserActivity(user.id, 'typing');
      }

      return { event: 'userStartTyping', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error handling user start typing: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to start typing indicator' } };
    }
  }

  /**
   * Enhanced typing stop event using TypingService
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('userStopTyping')
  async handleUserStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; threadId?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const typingEvent = this.typingService.stopTyping(
        user.id,
        data.roomId,
        data.threadId
      );

      if (typingEvent) {
        // Broadcast to room excluding the user
        await this.broadcastingService.sendToRoom(
          data.threadId || data.roomId,
          'userTypingUpdate',
          typingEvent,
          [user.id]
        );

        // Update presence activity
        this.presenceService.updateUserActivity(user.id, 'idle');
      }

      return { event: 'userStopTyping', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error handling user stop typing: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to stop typing indicator' } };
    }
  }

  /**
   * Enhanced presence update event
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('userPresenceUpdate')
  async handleUserPresenceUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status?: UserStatus; customStatus?: string; location?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {      // Update presence using existing service
      await this.presenceService.updateUserStatus(user.id, data.status || UserStatus.ONLINE, data.customStatus);      // Broadcast presence update to all connected users
      await this.broadcastingService.sendToRoom(
        'general', // or broadcast to all connected clients
        'presenceUpdate',
        {
          userId: user.id,
          username: user.username,
          status: data.status || UserStatus.ONLINE,
          customStatus: data.customStatus,
          timestamp: Date.now()
        }
      );

      return { event: 'userPresenceUpdate', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error handling presence update: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to update presence' } };
    }
  }

  /**
   * Mark message as read
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('messageRead')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; roomId: string; threadId?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const readReceipt = this.readReceiptService.markAsRead(
        data.messageId,
        user.id,
        user.username,
        data.roomId,
        data.threadId,
        client.id
      );

      // Get updated read status
      const readStatus = this.readReceiptService.getMessageReadStatus(data.messageId);

      // Broadcast read receipt to message sender and room participants
      await this.broadcastingService.sendToRoom(
        data.threadId || data.roomId,
        'messageReadUpdate',
        {
          messageId: data.messageId,
          readReceipt,
          readStatus,
          timestamp: Date.now()
        }
      );

      return { event: 'messageRead', data: { success: true, readReceipt } };
    } catch (error) {
      this.logger.error(`Error handling message read: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to mark message as read' } };
    }
  }

  /**
   * Handle user joining a room with enhanced presence tracking
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('userJoinedRoom')
  async handleUserJoinedRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      // Join the socket room
      await client.join(data.roomId);
      
      // Add to room participants tracking
      if (!this.roomParticipants.has(data.roomId)) {
        this.roomParticipants.set(data.roomId, new Set());
      }
      this.roomParticipants.get(data.roomId)!.add(user.id);      // Update presence activity (user is in room)
      this.presenceService.updateUserActivity(user.id, 'active');

      // Broadcast user joined to room
      await this.broadcastingService.sendToRoom(
        data.roomId,
        'userJoinedRoom',
        {
          userId: user.id,
          username: user.username,
          roomId: data.roomId,
          timestamp: Date.now()
        },
        [user.id] // Exclude the user who joined
      );      // Send current room participants to the user (simplified)
      const roomUsers = Array.from(this.roomParticipants.get(data.roomId) || []);
      client.emit('roomPresenceUpdate', {
        roomId: data.roomId,
        userIds: roomUsers,
        timestamp: Date.now()
      });

      return { event: 'userJoinedRoom', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error handling user joined room: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to join room' } };
    }
  }

  /**
   * Handle user leaving a room with enhanced presence tracking
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('userLeftRoom')
  async handleUserLeftRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      // Leave the socket room
      await client.leave(data.roomId);
      
      // Remove from room participants tracking
      this.roomParticipants.get(data.roomId)?.delete(user.id);

      // Cleanup typing indicators for this room
      this.typingService.stopTyping(user.id, data.roomId);      // Update presence activity when user leaves room
      this.presenceService.updateUserActivity(user.id, 'idle');

      // Broadcast user left to room
      await this.broadcastingService.sendToRoom(
        data.roomId,
        'userLeftRoom',
        {
          userId: user.id,
          username: user.username,
          roomId: data.roomId,
          timestamp: Date.now()
        }
      );

      return { event: 'userLeftRoom', data: { success: true } };
    } catch (error) {
      this.logger.error(`Error handling user left room: ${(error as Error).message}`);
      return { event: 'error', data: { message: 'Failed to leave room' } };
    }
  }

  /**
   * Get room statistics
   */  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getRoomStats')
  async handleGetRoomStats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
    @CurrentUser() user: UserWithoutPassword
  ): Promise<{ event: string; data: any }> {
    try {
      const { roomId } = data;
      
      if (!roomId) {
        throw new WsException('Room ID is required');
      }
      
      // Use socket service methods as expected by tests
      const roomUsers = this.socketService.getRoomUsers(roomId);
      const typingUsers = this.socketService.getTypingUsers(roomId);
      
      // Get room participants from our local tracking as fallback
      const participants = Array.from(this.roomParticipants.get(roomId) || []);
      
      const stats = {
        roomId,
        userCount: roomUsers?.length || participants.length,
        users: roomUsers || participants.map(userId => {
          const socketId = this.connectedUsers.get(userId);
          const socket = socketId ? this.connectedClients.get(socketId) : null;
          const userData = socket?.data.user as UserWithoutPassword;
          
          return {
            userId,
            username: userData?.username || 'Unknown'
          };
        }),
        typingUsers: typingUsers || [],
        timestamp: new Date().toISOString()
      };

      // Emit room stats to client as expected by tests
      client.emit('roomStats', stats);
      
      return {
        event: 'roomStatsRetrieved',
        data: {
          success: true,
          ...stats
        }
      };
    } catch (error) {
      return this.handleError(client, 'getRoomStats', error);
    }
  }

  /**
   * Update user presence status manually
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('updatePresence')
  async handleUpdatePresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: UserStatus; customStatus?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const { status, customStatus } = data;
        // Update presence service
      this.presenceService.updateUserStatus(user.id, status, customStatus);
      
      // Broadcast presence update using BroadcastingService
      await this.broadcastingService.broadcast({
        id: `presence_${user.id}_${Date.now()}`,
        type: 'presence',
        payload: {
          userId: user.id,
          username: user.username,
          status,
          customStatus,
          timestamp: new Date().toISOString()
        },
        timestamp: Date.now(),
        priority: 'normal',
        excludeUsers: [user.id] // Don't notify the user who updated their status
      }).catch(error => {
        this.logger.error(`Failed to broadcast presence update: ${error.message}`);
        // Fallback to direct emit
        this.server.emit('presenceUpdate', {
          userId: user.id,
          username: user.username,
          status,
          customStatus,
          timestamp: new Date().toISOString()
        });
      });
      
      return {
        event: 'presenceUpdated',
        data: {
          success: true,
          status,
          customStatus,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'updatePresence', error);
    }
  }

  /**
   * Get user presence information
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getPresence')
  async handleGetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userIds?: string[] },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const { userIds } = data;
      
      let presenceData;
      
      if (userIds && userIds.length > 0) {
        // Get specific users' presence
        presenceData = userIds.map(userId => {
          const presence = this.presenceService.getUserPresence(userId);
          return presence || { userId, status: UserStatus.OFFLINE, isOnline: false };
        });
      } else {        // Get all online users' presence
        presenceData = this.presenceService.getOnlineUsers();
      }
      
      return {
        event: 'presenceRetrieved',
        data: {
          success: true,
          presenceData,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'getPresence', error);
    }
  }

  /**
   * Get broadcasting and performance statistics
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getStats')
  async handleGetStats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { includeRoomStats?: boolean },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const { includeRoomStats = false } = data;
      
      // Get broadcasting stats
      const broadcastStats = this.broadcastingService.getStats();
      
      // Get presence stats
      const presenceStats = this.presenceService.getStats();
      
      // Get basic gateway stats
      const gatewayStats = {
        connectedClients: this.connectedClients.size,
        connectedUsers: this.connectedUsers.size,
        activeRooms: this.roomParticipants.size,
        typingUsers: Array.from(this.typingUsers.values()).reduce((total, set) => total + set.size, 0)
      };
      
      let roomStats = {};
      if (includeRoomStats) {
        // Get detailed room statistics
        for (const [roomId, participants] of this.roomParticipants.entries()) {
          const broadcastRoomInfo = this.broadcastingService.getRoomInfo(roomId);
          (roomStats as any)[roomId] = {
            participants: participants.size,
            broadcastSubscribers: broadcastRoomInfo.memberCount,
            isActive: broadcastRoomInfo.isActive,
            typingUsers: this.getTypingUsers(roomId).length
          };
        }
      }
      
      return {
        event: 'statsRetrieved',
        data: {
          success: true,
          stats: {
            gateway: gatewayStats,
            broadcasting: broadcastStats,
            presence: presenceStats,
            rooms: includeRoomStats ? roomStats : undefined
          },
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'getStats', error);
    }
  }
  /**
   * Get queued messages information for the current user
   */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('getQueuedMessages')
  async handleGetQueuedMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId?: string },
    @CurrentUser() user: UserWithoutPassword
  ) {
    try {
      const { roomId } = data;
      
      // Get queue information from MessageQueueService
      const queueInfo = this.messageQueueService.getUserQueueInfo(user.id);
      
      // Mark user as online to trigger delivery
      await this.messageQueueService.markUserOnline(user.id);
      
      return {
        event: 'queuedMessagesInfo',
        data: {
          success: true,
          queueInfo: {
            queueSize: queueInfo.queueSize,
            isOnline: queueInfo.isOnline,
            lastSeen: queueInfo.lastSeen,
            oldestMessage: queueInfo.oldestMessage,
            priorityCounts: queueInfo.priorityCounts
          },
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.handleError(client, 'getQueuedMessages', error);
    }
  }

  // Private methods

  /**
   * Add a user to the typing set
   */
  private addUserTyping(user: UserWithoutPassword, roomId: string, threadId?: string) {
    const key = this.getTypingKey(roomId, threadId);
    
    if (!this.typingUsers.has(key)) {
      this.typingUsers.set(key, new Set());
    }
    
    const typingUser: TypingUser = {
      userId: user.id,
      username: user.username,
      timestamp: Date.now()
    };
    
    this.typingUsers.get(key)?.add(typingUser);
  }

  /**
   * Remove a user from the typing set
   */
  private removeUserTyping(userId: string, roomId: string, threadId?: string) {
    const key = this.getTypingKey(roomId, threadId);
      if (this.typingUsers.has(key)) {
      const userSet = this.typingUsers.get(key);
      
      if (userSet) {
        const userToRemove = Array.from(userSet).find(u => u.userId === userId);
        
        if (userToRemove) {
          userSet.delete(userToRemove);
        }
        
        // Clean up empty sets
        if (userSet.size === 0) {
          this.typingUsers.delete(key);
        }
      }
    }
  }

  /**
   * Remove a user from all typing indicators
   */
  private removeUserFromTyping(userId: string) {
    for (const [key, userSet] of this.typingUsers.entries()) {
      const usersToRemove = Array.from(userSet).filter(u => u.userId === userId);
      
      for (const user of usersToRemove) {
        userSet.delete(user);
      }
      
      // Clean up empty sets
      if (userSet.size === 0) {
        this.typingUsers.delete(key);
      }
    }
  }

  /**
   * Get typing users for a room or thread
   */
  private getTypingUsers(roomId: string, threadId?: string): TypingUser[] {
    const key = this.getTypingKey(roomId, threadId);
    const now = Date.now();
    const typingTimeout = this.TYPING_TIMEOUT_MS;
      // Filter out expired typing indicators
    if (this.typingUsers.has(key)) {
      const userSet = this.typingUsers.get(key);
      
      if (userSet) {
        const expiredUsers: TypingUser[] = [];
        
        for (const user of userSet) {
          if (now - user.timestamp > typingTimeout) {
            expiredUsers.push(user);
          }
        }
        
        // Remove expired typing indicators
        for (const user of expiredUsers) {
          userSet.delete(user);
        }
        
        // Return active typing users
        return Array.from(userSet);
      }
    }
    
    return [];
  }

  /**
   * Get a key for typing users set based on roomId and threadId
   */
  private getTypingKey(roomId: string, threadId?: string): string {
    return threadId ? `${roomId}:thread:${threadId}` : roomId;
  }

  /**
   * Remove a user from all rooms
   */
  private removeUserFromAllRooms(userId: string) {
    for (const [roomId, userSet] of this.roomParticipants.entries()) {
      if (userSet.has(userId)) {
        userSet.delete(userId);
        
        // Notify others in the room
        this.server.to(roomId).emit('userLeft', {
          userId,
          roomId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Clean up empty rooms
      if (userSet.size === 0) {
        this.roomParticipants.delete(roomId);
      }
    }
    
    // Also remove from threads
    for (const [threadId, userSet] of this.threadParticipants.entries()) {
      if (userSet.has(userId)) {
        userSet.delete(userId);
      }
      
      // Clean up empty threads
      if (userSet.size === 0) {
        this.threadParticipants.delete(threadId);
      }
    }
  }

  /**
   * Check if a user is rate limited for a specific action
   */
  private isRateLimited(userId: string, action: keyof UserRateLimits): boolean {
    const limits = this.userRateLimits.get(userId);
    
    if (!limits) {
      return false;
    }
    
    const now = Date.now();
    const resetInterval = 60 * 1000; // 1 minute
    const config = this.configService.getRateLimits();
    
    // Reset counters if needed
    if (now - limits[action].lastReset > resetInterval) {
      limits[action].count = 0;
      limits[action].lastReset = now;
    }
      // Check if limit is exceeded
    switch (action) {
      case 'messages':
        return limits.messages.count >= config.maxMessagesPerWindow;
      case 'typing':
        return limits.typing.count >= config.maxTypingEventsPerWindow;
      case 'joinRoom':
        return limits.joinRoom.count >= config.maxJoinsPerWindow;
      default:
        return false;
    }
  }

  /**
   * Increment rate limit counter for a user action
   */
  private incrementRateLimit(userId: string, action: keyof UserRateLimits) {
    const limits = this.userRateLimits.get(userId);
    
    if (limits) {
      limits[action].count++;
    }
  }

  /**
   * Get list of active users
   */
  private getActiveUsers(): Array<{ userId: string; username: string }> {
    const activeUsers: Array<{ userId: string; username: string }> = [];
    
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      const socket = this.connectedClients.get(socketId);
      
      if (socket) {
        const userData = socket.data.user as UserWithoutPassword;
        
        if (userData) {
          activeUsers.push({
            userId: userData.id,
            username: userData.username
          });
        }
      }
    }
    
    return activeUsers;
  }

  /**
   * Perform heartbeat check to remove stale connections
   */
  private performHeartbeatCheck() {
    const now = Date.now();
    const staleConnections: string[] = [];
    
    for (const [socketId, socket] of this.connectedClients.entries()) {
      const lastHeartbeat = socket.data.lastHeartbeat || socket.handshake.issued;
      
      // Check if connection is stale
      if (now - lastHeartbeat > this.INACTIVE_TIMEOUT_MS) {
        staleConnections.push(socketId);
      }
    }
    
    // Clean up stale connections
    for (const socketId of staleConnections) {
      const socket = this.connectedClients.get(socketId);
      
      if (socket) {
        this.logger.log(`Closing stale connection: ${socketId}`);
        socket.disconnect(true);
      }
    }
    
    // Log stats
    this.logger.verbose(`Heartbeat check: ${this.connectedClients.size} connections, ${staleConnections.length} stale`);
  }

  /**
   * Monitor WebSocket performance metrics
   */
  private async monitorPerformance(): Promise<void> {
    try {
      const metrics = {
        connectedClients: this.connectedClients.size,
        connectedUsers: this.connectedUsers.size,
        activeRooms: this.roomParticipants.size,
        activeThreads: this.threadParticipants.size,
        messageBufferSize: this.messageBuffer.size,
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now(),
      };

      // Update performance service
      await this.performanceService.recordWebSocketMetrics(metrics);

      // Log performance warnings
      if (metrics.connectedClients > this.connectionLimits.maxConnectionsTotal * 0.8) {
        this.logger.warn(`High connection count: ${metrics.connectedClients}`);
      }

      if (metrics.memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        this.logger.warn(`High memory usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }

    } catch (error) {
      this.logger.error(`Performance monitoring error: ${error.message}`);
    }
  }

  /**
   * Perform cleanup operations to maintain performance
   */
  private performCleanupOperations(): Promise<void> {
    return new Promise((resolve) => {
      try {
        let cleanedCount = 0;

        // Clean up stale connections
        for (const [socketId, socket] of this.connectedClients.entries()) {
          if (!socket.connected) {
            this.connectedClients.delete(socketId);
            cleanedCount++;
          }
        }

        // Clean up orphaned user mappings
        for (const [userId, socketId] of this.connectedUsers.entries()) {
          if (!this.connectedClients.has(socketId)) {
            this.connectedUsers.delete(userId);
            cleanedCount++;
          }
        }

        // Clean up empty room optimizations
        for (const [roomId, optimization] of this.roomOptimizations.entries()) {
          if (!this.roomParticipants.has(roomId) || this.roomParticipants.get(roomId)?.size === 0) {
            this.roomOptimizations.delete(roomId);
            cleanedCount++;
          }
        }

        // Clear old message buffers
        const oldestAllowed = Date.now() - 300000; // 5 minutes
        for (const [roomId, buffer] of this.messageBuffer.entries()) {
          const filteredBuffer = buffer.filter(msg => msg.timestamp > oldestAllowed);
          if (filteredBuffer.length !== buffer.length) {
            this.messageBuffer.set(roomId, filteredBuffer);
            cleanedCount += buffer.length - filteredBuffer.length;
          }
        }

        if (cleanedCount > 0) {
          this.logger.log(`Cleanup completed: ${cleanedCount} items cleaned`);
        }

        resolve();
      } catch (error) {
        this.logger.error(`Cleanup operation error: ${error.message}`);
        resolve();
      }
    });
  }

  /**
   * Handle WebSocket errors with consistent format
   */
  private handleError(client: Socket, event: string, error: any) {
    const errorMessage = error instanceof WsException 
      ? error.message 
      : 'An unexpected error occurred';
    
    this.logger.error(`WebSocket error in ${event}: ${error.message}`, error.stack);
    
    // Create structured error response
    const errorResponse: SocketErrorDto = {
      event: `${event}Error`,
      error: {
        message: errorMessage,
        code: error.status || 'WEBSOCKET_ERROR',
        timestamp: new Date().toISOString()
      },
      success: false
    };
    
    // Send error to client
    client.emit('error', errorResponse);
    
    // Return error for the event
    return {
      event: `${event}Error`,
      data: errorResponse
    };
  }

  /**
   * Clean up resources on application shutdown
   */
  onApplicationShutdown() {
    // Clear heartbeat interval
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Disconnect all clients
    for (const [socketId, socket] of this.connectedClients.entries()) {
      this.logger.log(`Disconnecting client ${socketId} on shutdown`);
      socket.disconnect(true);
    }
  }
}
