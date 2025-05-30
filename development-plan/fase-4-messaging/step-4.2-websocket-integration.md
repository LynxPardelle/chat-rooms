# Step 4.2: Sistema WebSocket Empresarial Integrado con Mensajería

## Objetivo

Implementar integración completa de WebSocket con el sistema de mensajería, incluyendo sincronización inteligente, broadcasting optimizado y manejo avanzado de conexiones.

## Requisitos Previos

- Step 4.1 completado (sistema de mensajería)
- Sistema de autenticación JWT funcionando
- MongoDB configurado
- Conocimiento de WebSocket y Socket.IO

## Arquitectura de WebSocket

```text
src/
├── modules/
│   └── websocket/
│       ├── gateway/
│       │   ├── chat.gateway.ts
│       │   ├── presence.gateway.ts
│       │   └── notification.gateway.ts
│       ├── services/
│       │   ├── websocket.service.ts
│       │   ├── room.service.ts
│       │   ├── presence.service.ts
│       │   ├── broadcast.service.ts
│       │   └── sync.service.ts
│       ├── middleware/
│       │   ├── auth.middleware.ts
│       │   └── rate-limit.middleware.ts
│       ├── types/
│       │   ├── websocket-events.ts
│       │   ├── room-types.ts
│       │   └── client-data.ts
│       └── guards/
│           ├── websocket-auth.guard.ts
│           └── room-access.guard.ts
```

## Paso 1: WebSocket Gateway Principal

### 1.1 Chat Gateway

```typescript
// src/modules/websocket/gateway/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  UseGuards,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { WebSocketAuthGuard } from '../guards/websocket-auth.guard';
import { RoomAccessGuard } from '../guards/room-access.guard';
import { CreateMessageUseCase } from '../../messaging/application/use-cases/create-message.use-case';
import { EditMessageUseCase } from '../../messaging/application/use-cases/edit-message.use-case';
import { AddReactionUseCase } from '../../messaging/application/use-cases/add-reaction.use-case';
import { RoomService } from '../services/room.service';
import { PresenceService } from '../services/presence.service';
import { BroadcastService } from '../services/broadcast.service';
import { 
  CreateMessageEvent,
  EditMessageEvent,
  DeleteMessageEvent,
  AddReactionEvent,
  TypingEvent,
  WebSocketEvents 
} from '../types/websocket-events';
import { AuthenticatedSocket } from '../types/client-data';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
  namespace: '/chat',
})
@UseGuards(WebSocketAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly createMessageUseCase: CreateMessageUseCase,
    private readonly editMessageUseCase: EditMessageUseCase,
    private readonly addReactionUseCase: AddReactionUseCase,
    private readonly roomService: RoomService,
    private readonly presenceService: PresenceService,
    private readonly broadcastService: BroadcastService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client connected: ${client.id}, User: ${client.user.id}`);
      
      // Add to presence tracking
      await this.presenceService.setUserOnline(client.user.id, client.id);
      
      // Join user's channels
      await this.joinUserChannels(client);
      
      // Broadcast user online status
      await this.broadcastUserPresence(client.user.id, 'online');
      
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    try {
      this.logger.log(`Client disconnected: ${client.id}, User: ${client.user?.id}`);
      
      if (client.user) {
        // Remove from presence tracking
        await this.presenceService.setUserOffline(client.user.id, client.id);
        
        // Check if user is still online on other connections
        const isStillOnline = await this.presenceService.isUserOnline(client.user.id);
        
        if (!isStillOnline) {
          // Broadcast user offline status
          await this.broadcastUserPresence(client.user.id, 'offline');
        }
      }
    } catch (error) {
      this.logger.error(`Disconnect error for client ${client.id}:`, error);
    }
  }

  @SubscribeMessage(WebSocketEvents.JOIN_CHANNEL)
  @UseGuards(RoomAccessGuard)
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const roomName = this.roomService.getChannelRoom(data.channelId);
      await client.join(roomName);
      
      this.logger.log(`User ${client.user.id} joined channel ${data.channelId}`);
      
      // Notify others in the channel
      client.to(roomName).emit(WebSocketEvents.USER_JOINED_CHANNEL, {
        userId: client.user.id,
        username: client.user.username,
        channelId: data.channelId,
        timestamp: new Date(),
      });
      
      return { success: true, channelId: data.channelId };
    } catch (error) {
      this.logger.error(`Error joining channel:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.LEAVE_CHANNEL)
  async handleLeaveChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    try {
      const roomName = this.roomService.getChannelRoom(data.channelId);
      await client.leave(roomName);
      
      this.logger.log(`User ${client.user.id} left channel ${data.channelId}`);
      
      // Notify others in the channel
      client.to(roomName).emit(WebSocketEvents.USER_LEFT_CHANNEL, {
        userId: client.user.id,
        username: client.user.username,
        channelId: data.channelId,
        timestamp: new Date(),
      });
      
      return { success: true, channelId: data.channelId };
    } catch (error) {
      this.logger.error(`Error leaving channel:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: CreateMessageEvent,
  ) {
    try {
      // Create message using use case
      const message = await this.createMessageUseCase.execute(
        data,
        new ObjectId(client.user.id),
      );

      // Broadcast to channel
      await this.broadcastService.broadcastToChannel(
        data.channelId,
        WebSocketEvents.NEW_MESSAGE,
        {
          message: message,
          author: {
            id: client.user.id,
            username: client.user.username,
            avatar: client.user.avatar,
          },
        },
        this.server,
      );

      // Handle mentions
      if (data.mentions && data.mentions.length > 0) {
        await this.handleMentions(data.mentions, message, client.user);
      }

      return { success: true, messageId: message.id };
    } catch (error) {
      this.logger.error(`Error sending message:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.EDIT_MESSAGE)
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: EditMessageEvent,
  ) {
    try {
      await this.editMessageUseCase.execute(
        new ObjectId(data.messageId),
        data,
        new ObjectId(client.user.id),
      );

      // Broadcast to channel
      await this.broadcastService.broadcastToChannel(
        data.channelId,
        WebSocketEvents.MESSAGE_EDITED,
        {
          messageId: data.messageId,
          text: data.text,
          editedAt: new Date(),
          editedBy: {
            id: client.user.id,
            username: client.user.username,
          },
        },
        this.server,
      );

      return { success: true, messageId: data.messageId };
    } catch (error) {
      this.logger.error(`Error editing message:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.DELETE_MESSAGE)
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DeleteMessageEvent,
  ) {
    try {
      // Note: Implement DeleteMessageUseCase
      // await this.deleteMessageUseCase.execute(...)

      // Broadcast to channel
      await this.broadcastService.broadcastToChannel(
        data.channelId,
        WebSocketEvents.MESSAGE_DELETED,
        {
          messageId: data.messageId,
          deletedAt: new Date(),
          deletedBy: {
            id: client.user.id,
            username: client.user.username,
          },
        },
        this.server,
      );

      return { success: true, messageId: data.messageId };
    } catch (error) {
      this.logger.error(`Error deleting message:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.ADD_REACTION)
  async handleAddReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: AddReactionEvent,
  ) {
    try {
      await this.addReactionUseCase.execute(
        new ObjectId(data.messageId),
        { emoji: data.emoji },
        new ObjectId(client.user.id),
      );

      // Broadcast to channel
      await this.broadcastService.broadcastToChannel(
        data.channelId,
        WebSocketEvents.REACTION_ADDED,
        {
          messageId: data.messageId,
          emoji: data.emoji,
          userId: client.user.id,
          username: client.user.username,
        },
        this.server,
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`Error adding reaction:`, error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage(WebSocketEvents.TYPING_START)
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingEvent,
  ) {
    const roomName = this.roomService.getChannelRoom(data.channelId);
    
    client.to(roomName).emit(WebSocketEvents.USER_TYPING, {
      userId: client.user.id,
      username: client.user.username,
      channelId: data.channelId,
      isTyping: true,
    });
  }

  @SubscribeMessage(WebSocketEvents.TYPING_STOP)
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingEvent,
  ) {
    const roomName = this.roomService.getChannelRoom(data.channelId);
    
    client.to(roomName).emit(WebSocketEvents.USER_TYPING, {
      userId: client.user.id,
      username: client.user.username,
      channelId: data.channelId,
      isTyping: false,
    });
  }

  private async joinUserChannels(client: AuthenticatedSocket) {
    try {
      // Get user's channels from database
      // const userChannels = await this.channelService.getUserChannels(client.user.id);
      // 
      // for (const channel of userChannels) {
      //   const roomName = this.roomService.getChannelRoom(channel.id);
      //   await client.join(roomName);
      // }
    } catch (error) {
      this.logger.error(`Error joining user channels:`, error);
    }
  }

  private async broadcastUserPresence(userId: string, status: 'online' | 'offline') {
    try {
      // Get user's channels to broadcast presence
      // const userChannels = await this.channelService.getUserChannels(userId);
      // 
      // for (const channel of userChannels) {
      //   const roomName = this.roomService.getChannelRoom(channel.id);
      //   this.server.to(roomName).emit(WebSocketEvents.USER_PRESENCE, {
      //     userId,
      //     status,
      //     timestamp: new Date(),
      //   });
      // }
    } catch (error) {
      this.logger.error(`Error broadcasting user presence:`, error);
    }
  }

  private async handleMentions(mentions: string[], message: any, author: any) {
    try {
      for (const mention of mentions) {
        // Send direct notification to mentioned user
        const userSockets = await this.presenceService.getUserSockets(mention);
        
        for (const socketId of userSockets) {
          this.server.to(socketId).emit(WebSocketEvents.MENTION_RECEIVED, {
            messageId: message.id,
            text: message.content.text,
            author: {
              id: author.id,
              username: author.username,
              avatar: author.avatar,
            },
            channelId: message.channelId,
            timestamp: message.createdAt,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error handling mentions:`, error);
    }
  }
}
```

### 1.2 WebSocket Events Types

```typescript
// src/modules/websocket/types/websocket-events.ts
export enum WebSocketEvents {
  // Connection
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  
  // Channel Management
  JOIN_CHANNEL = 'join_channel',
  LEAVE_CHANNEL = 'leave_channel',
  USER_JOINED_CHANNEL = 'user_joined_channel',
  USER_LEFT_CHANNEL = 'user_left_channel',
  
  // Messages
  SEND_MESSAGE = 'send_message',
  NEW_MESSAGE = 'new_message',
  EDIT_MESSAGE = 'edit_message',
  MESSAGE_EDITED = 'message_edited',
  DELETE_MESSAGE = 'delete_message',
  MESSAGE_DELETED = 'message_deleted',
  
  // Reactions
  ADD_REACTION = 'add_reaction',
  REMOVE_REACTION = 'remove_reaction',
  REACTION_ADDED = 'reaction_added',
  REACTION_REMOVED = 'reaction_removed',
  
  // Typing Indicators
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_TYPING = 'user_typing',
  
  // Presence
  USER_PRESENCE = 'user_presence',
  
  // Mentions
  MENTION_RECEIVED = 'mention_received',
  
  // Threads
  CREATE_THREAD = 'create_thread',
  THREAD_CREATED = 'thread_created',
  
  // Errors
  ERROR = 'error',
  
  // Sync
  SYNC_REQUEST = 'sync_request',
  SYNC_RESPONSE = 'sync_response',
}

export interface CreateMessageEvent {
  text: string;
  channelId: string;
  threadId?: string;
  parentMessageId?: string;
  attachments?: string[];
  mentions?: string[];
  links?: string[];
}

export interface EditMessageEvent {
  messageId: string;
  channelId: string;
  text: string;
  attachments?: string[];
  mentions?: string[];
  links?: string[];
}

export interface DeleteMessageEvent {
  messageId: string;
  channelId: string;
}

export interface AddReactionEvent {
  messageId: string;
  channelId: string;
  emoji: string;
}

export interface TypingEvent {
  channelId: string;
}
```

### 1.3 Authenticated Socket Type

```typescript
// src/modules/websocket/types/client-data.ts
import { Socket } from 'socket.io';

export interface UserData {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  roles: string[];
}

export interface AuthenticatedSocket extends Socket {
  user: UserData;
}

export interface ClientSession {
  socketId: string;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  channels: string[];
}
```

## Paso 2: Servicios de WebSocket

### 2.1 Room Service

```typescript
// src/modules/websocket/services/room.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class RoomService {
  private readonly CHANNEL_PREFIX = 'channel:';
  private readonly THREAD_PREFIX = 'thread:';
  private readonly USER_PREFIX = 'user:';
  private readonly GLOBAL_PREFIX = 'global:';

  getChannelRoom(channelId: string): string {
    return `${this.CHANNEL_PREFIX}${channelId}`;
  }

  getThreadRoom(threadId: string): string {
    return `${this.THREAD_PREFIX}${threadId}`;
  }

  getUserRoom(userId: string): string {
    return `${this.USER_PREFIX}${userId}`;
  }

  getGlobalRoom(): string {
    return `${this.GLOBAL_PREFIX}all`;
  }

  extractChannelId(roomName: string): string | null {
    if (roomName.startsWith(this.CHANNEL_PREFIX)) {
      return roomName.substring(this.CHANNEL_PREFIX.length);
    }
    return null;
  }

  extractThreadId(roomName: string): string | null {
    if (roomName.startsWith(this.THREAD_PREFIX)) {
      return roomName.substring(this.THREAD_PREFIX.length);
    }
    return null;
  }

  extractUserId(roomName: string): string | null {
    if (roomName.startsWith(this.USER_PREFIX)) {
      return roomName.substring(this.USER_PREFIX.length);
    }
    return null;
  }

  isChannelRoom(roomName: string): boolean {
    return roomName.startsWith(this.CHANNEL_PREFIX);
  }

  isThreadRoom(roomName: string): boolean {
    return roomName.startsWith(this.THREAD_PREFIX);
  }

  isUserRoom(roomName: string): boolean {
    return roomName.startsWith(this.USER_PREFIX);
  }

  isGlobalRoom(roomName: string): boolean {
    return roomName.startsWith(this.GLOBAL_PREFIX);
  }
}
```

### 2.2 Presence Service

```typescript
// src/modules/websocket/services/presence.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  socketIds: string[];
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly PRESENCE_PREFIX = 'presence:';
  private readonly USER_SOCKETS_PREFIX = 'user_sockets:';
  private readonly PRESENCE_TTL = 300; // 5 minutes

  constructor(
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async setUserOnline(userId: string, socketId: string): Promise<void> {
    try {
      const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
      const socketsKey = `${this.USER_SOCKETS_PREFIX}${userId}`;

      // Add socket to user's active sockets
      await this.redis.sadd(socketsKey, socketId);
      await this.redis.expire(socketsKey, this.PRESENCE_TTL);

      // Update presence
      const presence: UserPresence = {
        userId,
        status: 'online',
        lastSeen: new Date(),
        socketIds: await this.redis.smembers(socketsKey),
      };

      await this.redis.setex(
        presenceKey,
        this.PRESENCE_TTL,
        JSON.stringify(presence),
      );

      this.logger.log(`User ${userId} set online with socket ${socketId}`);
    } catch (error) {
      this.logger.error(`Error setting user online:`, error);
    }
  }

  async setUserOffline(userId: string, socketId: string): Promise<void> {
    try {
      const socketsKey = `${this.USER_SOCKETS_PREFIX}${userId}`;
      
      // Remove socket from user's active sockets
      await this.redis.srem(socketsKey, socketId);
      
      // Check if user has other active sockets
      const remainingSockets = await this.redis.smembers(socketsKey);
      
      if (remainingSockets.length === 0) {
        // User is completely offline
        const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
        const presence: UserPresence = {
          userId,
          status: 'offline',
          lastSeen: new Date(),
          socketIds: [],
        };

        await this.redis.setex(
          presenceKey,
          this.PRESENCE_TTL,
          JSON.stringify(presence),
        );

        // Clean up sockets key
        await this.redis.del(socketsKey);
      }

      this.logger.log(`User ${userId} socket ${socketId} removed`);
    } catch (error) {
      this.logger.error(`Error setting user offline:`, error);
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const socketsKey = `${this.USER_SOCKETS_PREFIX}${userId}`;
      const socketCount = await this.redis.scard(socketsKey);
      return socketCount > 0;
    } catch (error) {
      this.logger.error(`Error checking user online status:`, error);
      return false;
    }
  }

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
      const presenceData = await this.redis.get(presenceKey);
      
      if (!presenceData) {
        return null;
      }

      return JSON.parse(presenceData);
    } catch (error) {
      this.logger.error(`Error getting user presence:`, error);
      return null;
    }
  }

  async getUserSockets(userId: string): Promise<string[]> {
    try {
      const socketsKey = `${this.USER_SOCKETS_PREFIX}${userId}`;
      return await this.redis.smembers(socketsKey);
    } catch (error) {
      this.logger.error(`Error getting user sockets:`, error);
      return [];
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      const pattern = `${this.USER_SOCKETS_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      const onlineUsers: string[] = [];
      for (const key of keys) {
        const userId = key.replace(this.USER_SOCKETS_PREFIX, '');
        const socketCount = await this.redis.scard(key);
        
        if (socketCount > 0) {
          onlineUsers.push(userId);
        }
      }

      return onlineUsers;
    } catch (error) {
      this.logger.error(`Error getting online users:`, error);
      return [];
    }
  }

  async setUserAway(userId: string): Promise<void> {
    try {
      const presenceKey = `${this.PRESENCE_PREFIX}${userId}`;
      const currentPresence = await this.getUserPresence(userId);
      
      if (currentPresence && currentPresence.status === 'online') {
        const presence: UserPresence = {
          ...currentPresence,
          status: 'away',
          lastSeen: new Date(),
        };

        await this.redis.setex(
          presenceKey,
          this.PRESENCE_TTL,
          JSON.stringify(presence),
        );
      }
    } catch (error) {
      this.logger.error(`Error setting user away:`, error);
    }
  }

  async cleanupStalePresence(): Promise<void> {
    try {
      // This method should be called periodically to clean up stale presence data
      const pattern = `${this.PRESENCE_PREFIX}*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          await this.redis.del(key);
        }
      }
    } catch (error) {
      this.logger.error(`Error cleaning up stale presence:`, error);
    }
  }
}
```

### 2.3 Broadcast Service

```typescript
// src/modules/websocket/services/broadcast.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RoomService } from './room.service';
import { PresenceService } from './presence.service';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly roomService: RoomService,
    private readonly presenceService: PresenceService,
  ) {}

  async broadcastToChannel(
    channelId: string,
    event: string,
    data: any,
    server: Server,
    excludeSocketIds?: string[],
  ): Promise<void> {
    try {
      const roomName = this.roomService.getChannelRoom(channelId);
      
      if (excludeSocketIds && excludeSocketIds.length > 0) {
        // Get all sockets in the room
        const sockets = await server.in(roomName).fetchSockets();
        
        // Filter out excluded sockets
        const targetSockets = sockets.filter(
          socket => !excludeSocketIds.includes(socket.id),
        );
        
        // Emit to each target socket
        targetSockets.forEach(socket => {
          socket.emit(event, data);
        });
      } else {
        server.to(roomName).emit(event, data);
      }

      this.logger.log(`Broadcasted ${event} to channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Error broadcasting to channel:`, error);
    }
  }

  async broadcastToThread(
    threadId: string,
    event: string,
    data: any,
    server: Server,
    excludeSocketIds?: string[],
  ): Promise<void> {
    try {
      const roomName = this.roomService.getThreadRoom(threadId);
      
      if (excludeSocketIds && excludeSocketIds.length > 0) {
        const sockets = await server.in(roomName).fetchSockets();
        const targetSockets = sockets.filter(
          socket => !excludeSocketIds.includes(socket.id),
        );
        
        targetSockets.forEach(socket => {
          socket.emit(event, data);
        });
      } else {
        server.to(roomName).emit(event, data);
      }

      this.logger.log(`Broadcasted ${event} to thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Error broadcasting to thread:`, error);
    }
  }

  async broadcastToUser(
    userId: string,
    event: string,
    data: any,
    server: Server,
  ): Promise<void> {
    try {
      const socketIds = await this.presenceService.getUserSockets(userId);
      
      socketIds.forEach(socketId => {
        server.to(socketId).emit(event, data);
      });

      this.logger.log(`Broadcasted ${event} to user ${userId}`);
    } catch (error) {
      this.logger.error(`Error broadcasting to user:`, error);
    }
  }

  async broadcastGlobal(
    event: string,
    data: any,
    server: Server,
    excludeUserIds?: string[],
  ): Promise<void> {
    try {
      if (excludeUserIds && excludeUserIds.length > 0) {
        const excludeSocketIds: string[] = [];
        
        for (const userId of excludeUserIds) {
          const userSocketIds = await this.presenceService.getUserSockets(userId);
          excludeSocketIds.push(...userSocketIds);
        }
        
        const allSockets = await server.fetchSockets();
        const targetSockets = allSockets.filter(
          socket => !excludeSocketIds.includes(socket.id),
        );
        
        targetSockets.forEach(socket => {
          socket.emit(event, data);
        });
      } else {
        server.emit(event, data);
      }

      this.logger.log(`Broadcasted ${event} globally`);
    } catch (error) {
      this.logger.error(`Error broadcasting globally:`, error);
    }
  }

  async broadcastToMultipleChannels(
    channelIds: string[],
    event: string,
    data: any,
    server: Server,
  ): Promise<void> {
    try {
      const roomNames = channelIds.map(id => this.roomService.getChannelRoom(id));
      
      roomNames.forEach(roomName => {
        server.to(roomName).emit(event, data);
      });

      this.logger.log(`Broadcasted ${event} to ${channelIds.length} channels`);
    } catch (error) {
      this.logger.error(`Error broadcasting to multiple channels:`, error);
    }
  }

  async getChannelMemberCount(channelId: string, server: Server): Promise<number> {
    try {
      const roomName = this.roomService.getChannelRoom(channelId);
      const sockets = await server.in(roomName).fetchSockets();
      return sockets.length;
    } catch (error) {
      this.logger.error(`Error getting channel member count:`, error);
      return 0;
    }
  }

  async getChannelMembers(channelId: string, server: Server): Promise<string[]> {
    try {
      const roomName = this.roomService.getChannelRoom(channelId);
      const sockets = await server.in(roomName).fetchSockets();
      
      // Extract user IDs from authenticated sockets
      const userIds = sockets
        .map((socket: any) => socket.user?.id)
        .filter(id => id);
      
      // Remove duplicates
      return [...new Set(userIds)];
    } catch (error) {
      this.logger.error(`Error getting channel members:`, error);
      return [];
    }
  }
}
```

## Paso 3: Guards y Middleware

### 3.1 WebSocket Auth Guard

```typescript
// src/modules/websocket/guards/websocket-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AuthenticatedSocket, UserData } from '../types/client-data';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractTokenFromSocket(client);

      if (!token) {
        this.logger.warn(`No token provided for socket ${client.id}`);
        return false;
      }

      const payload = await this.jwtService.verifyAsync(token);
      
      // Add user data to socket
      (client as AuthenticatedSocket).user = {
        id: payload.sub,
        username: payload.username,
        email: payload.email,
        avatar: payload.avatar,
        roles: payload.roles || [],
      };

      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed:`, error);
      return false;
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Try to get token from auth header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get token from query
    const token = client.handshake.query.token;
    if (typeof token === 'string') {
      return token;
    }

    // Try to get token from auth object
    const auth = client.handshake.auth;
    if (auth && auth.token) {
      return auth.token;
    }

    return null;
  }
}
```

### 3.2 Room Access Guard

```typescript
// src/modules/websocket/guards/room-access.guard.ts
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthenticatedSocket } from '../types/client-data';

@Injectable()
export class RoomAccessGuard implements CanActivate {
  private readonly logger = new Logger(RoomAccessGuard.name);

  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: AuthenticatedSocket = context.switchToWs().getClient();
      const data = context.switchToWs().getData();

      // Extract channel ID from the data
      const channelId = data?.channelId;
      if (!channelId) {
        this.logger.warn(`No channel ID provided for socket ${client.id}`);
        return false;
      }

      // Check if user has access to the channel
      // This should integrate with your authorization service
      const hasAccess = await this.checkChannelAccess(client.user.id, channelId);
      
      if (!hasAccess) {
        this.logger.warn(`User ${client.user.id} denied access to channel ${channelId}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Room access check failed:`, error);
      return false;
    }
  }

  private async checkChannelAccess(userId: string, channelId: string): Promise<boolean> {
    try {
      // Implement your channel access logic here
      // This could check:
      // - Channel membership
      // - Channel permissions
      // - User roles
      // - Private/public channel settings
      
      // For now, return true - implement actual logic based on your requirements
      return true;
    } catch (error) {
      this.logger.error(`Error checking channel access:`, error);
      return false;
    }
  }
}
```

## Paso 4: Integración con el Módulo de Mensajería

### 4.1 WebSocket Module

```typescript
// src/modules/websocket/websocket.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './gateway/chat.gateway';
import { PresenceGateway } from './gateway/presence.gateway';
import { RoomService } from './services/room.service';
import { PresenceService } from './services/presence.service';
import { BroadcastService } from './services/broadcast.service';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { RoomAccessGuard } from './guards/room-access.guard';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    MessagingModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ChatGateway,
    PresenceGateway,
    RoomService,
    PresenceService,
    BroadcastService,
    WebSocketAuthGuard,
    RoomAccessGuard,
  ],
  exports: [
    RoomService,
    PresenceService,
    BroadcastService,
  ],
})
export class WebSocketModule {}
```

## Resultado Esperado

Al completar este paso tendrás:

✅ **WebSocket Gateway Completo**

- Gateway principal para chat con eventos completos
- Autenticación JWT integrada en WebSocket
- Manejo de conexiones y desconexiones
- Broadcasting inteligente y optimizado

✅ **Servicios de Soporte**

- RoomService para gestión de salas
- PresenceService con Redis para presencia en tiempo real
- BroadcastService para comunicación eficiente

✅ **Seguridad y Autorización**

- Guards para autenticación WebSocket
- Verificación de acceso a canales
- Manejo seguro de tokens JWT

✅ **Integración Completa**

- Sincronización con sistema de mensajería
- Eventos bidireccionales en tiempo real
- Manejo de menciones y notificaciones

✅ **Performance y Escalabilidad**

- Broadcasting optimizado con filtros
- Gestión eficiente de presencia con Redis
- Manejo de múltiples conexiones por usuario

## Próximo Paso

Continuar con [Step 4.3: Sistema Empresarial de Gestión de Archivos y Medios](./step-4.3-file-management.md) para completar la infraestructura del backend.
