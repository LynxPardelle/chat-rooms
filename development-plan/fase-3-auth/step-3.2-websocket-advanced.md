# 3.2 Sistema WebSocket Avanzado y Monitoreo

## Explicación

Implementaremos un sistema WebSocket empresarial con autenticación JWT, manejo avanzado de conexiones, rooms dinámicos, health checks, métricas de performance y monitoreo en tiempo real. El sistema será escalable y robusto para manejar miles de conexiones concurrentes.

## Objetivos

- Configurar WebSocket Gateway con autenticación JWT
- Implementar sistema de rooms dinámicos y gestión de usuarios
- Crear health checks y métricas de performance
- Establecer logging detallado y monitoreo de conexiones
- Configurar manejo de errores y reconexión automática
- Implementar rate limiting para mensajes WebSocket

## Prompt para Implementación

```typescript
Crea un sistema WebSocket avanzado que incluya:

Gateway WebSocket empresarial:
- Autenticación JWT automática en conexión
- Gestión de rooms dinámicos con permisos
- Eventos tipados para todas las operaciones
- Middleware para logging y validación
- Rate limiting por usuario para prevenir spam
- Manejo de errores graceful con códigos específicos

Funcionalidades de chat en tiempo real:
- Envío y recepción de mensajes
- Notificaciones de typing/stopped typing
- Estados de usuario (online/offline/away)
- Notificaciones de usuarios entrando/saliendo de rooms
- Reacciones a mensajes en tiempo real
- Historial de mensajes con paginación

Monitoreo y métricas:
- Health checks para verificar estado del gateway
- Métricas de conexiones activas, mensajes por segundo
- Logging detallado de eventos importantes
- Manejo de desconexiones inesperadas
- Estadísticas de performance por room
- Dashboard de monitoreo (preparado para Grafana)

Sistema de notificaciones:
- Notificaciones push para mensajes perdidos
- Eventos de sistema (usuario baneado, room eliminado)
- Notificaciones de moderación
- Alertas de seguridad
```

## Estructura de Archivos

```
api/src/
├── websocket/
│   ├── websocket.module.ts            # Módulo WebSocket principal
│   ├── websocket.gateway.ts           # Gateway principal de WebSocket
│   ├── events/
│   │   ├── message.events.ts          # Eventos relacionados con mensajes
│   │   ├── room.events.ts             # Eventos de rooms y usuarios
│   │   ├── typing.events.ts           # Eventos de typing indicators
│   │   └── notification.events.ts     # Eventos de notificaciones
│   ├── dto/
│   │   ├── send-message.dto.ts        # DTO para enviar mensajes
│   │   ├── join-room.dto.ts           # DTO para unirse a rooms
│   │   ├── typing.dto.ts              # DTO para eventos de typing
│   │   └── reaction.dto.ts            # DTO para reacciones
│   ├── guards/
│   │   ├── ws-auth.guard.ts           # Guard de autenticación WebSocket
│   │   └── ws-rate-limit.guard.ts     # Guard de rate limiting
│   ├── middleware/
│   │   ├── ws-logging.middleware.ts   # Middleware de logging
│   │   └── ws-validation.middleware.ts # Middleware de validación
│   ├── services/
│   │   ├── connection.service.ts      # Servicio de gestión de conexiones
│   │   ├── room.service.ts            # Servicio de gestión de rooms
│   │   ├── notification.service.ts    # Servicio de notificaciones
│   │   └── metrics.service.ts         # Servicio de métricas
│   └── types/
│       ├── websocket.types.ts         # Tipos TypeScript para eventos
│       └── connection.types.ts        # Tipos para conexiones y usuarios
├── health/
│   ├── health.module.ts               # Módulo de health checks
│   ├── health.controller.ts           # Controller para health endpoints
│   └── indicators/
│       ├── websocket.indicator.ts     # Health indicator para WebSocket
│       └── database.indicator.ts      # Health indicator para base de datos
└── metrics/
    ├── metrics.module.ts              # Módulo de métricas
    ├── metrics.controller.ts          # Controller para métricas
    └── services/
        └── prometheus.service.ts      # Servicio para métricas de Prometheus
```

## Tipos y Interfaces

### websocket/types/websocket.types.ts

```typescript
export interface ServerToClientEvents {
  // Eventos de mensajes
  'message:new': (data: MessageEventData) => void;
  'message:updated': (data: MessageEventData) => void;
  'message:deleted': (data: { messageId: string; roomId: string }) => void;
  'message:reaction': (data: ReactionEventData) => void;

  // Eventos de rooms
  'room:joined': (data: RoomEventData) => void;
  'room:left': (data: RoomEventData) => void;
  'room:updated': (data: RoomEventData) => void;
  'room:user_joined': (data: UserRoomEventData) => void;
  'room:user_left': (data: UserRoomEventData) => void;

  // Eventos de usuario
  'user:status_changed': (data: UserStatusEventData) => void;
  'user:typing': (data: TypingEventData) => void;
  'user:stopped_typing': (data: TypingEventData) => void;

  // Eventos de sistema
  'system:notification': (data: NotificationEventData) => void;
  'system:error': (data: ErrorEventData) => void;
  'system:disconnect': (data: { reason: string }) => void;

  // Eventos de monitoreo
  'health:status': (data: HealthStatusData) => void;
  'metrics:update': (data: MetricsEventData) => void;
}

export interface ClientToServerEvents {
  // Eventos de mensajes
  'message:send': (data: SendMessageDto, callback?: (response: any) => void) => void;
  'message:edit': (data: EditMessageDto, callback?: (response: any) => void) => void;
  'message:delete': (data: DeleteMessageDto, callback?: (response: any) => void) => void;
  'message:react': (data: ReactToMessageDto, callback?: (response: any) => void) => void;

  // Eventos de rooms
  'room:join': (data: JoinRoomDto, callback?: (response: any) => void) => void;
  'room:leave': (data: LeaveRoomDto, callback?: (response: any) => void) => void;
  'room:get_messages': (data: GetMessagesDto, callback?: (response: any) => void) => void;

  // Eventos de typing
  'typing:start': (data: TypingDto) => void;
  'typing:stop': (data: TypingDto) => void;

  // Eventos de usuario
  'user:status_update': (data: UpdateStatusDto) => void;

  // Eventos de sistema
  'system:ping': (callback: (latency: number) => void) => void;
  'system:get_health': (callback: (health: HealthStatusData) => void) => void;
}

export interface MessageEventData {
  id: string;
  content: string;
  type: string;
  senderId: string;
  senderName: string;
  roomId: string;
  timestamp: Date;
  attachments?: string[];
  parentMessageId?: string;
  reactions?: Record<string, string[]>;
}

export interface RoomEventData {
  id: string;
  name: string;
  type: string;
  participantCount: number;
  lastActivity: Date;
}

export interface UserRoomEventData {
  userId: string;
  username: string;
  displayName: string;
  roomId: string;
  roomName: string;
  timestamp: Date;
}

export interface UserStatusEventData {
  userId: string;
  username: string;
  status: string;
  lastSeen: Date;
}

export interface TypingEventData {
  userId: string;
  username: string;
  roomId: string;
  timestamp: Date;
}

export interface NotificationEventData {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  userId?: string;
  roomId?: string;
  timestamp: Date;
  persistent?: boolean;
}

export interface ErrorEventData {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface HealthStatusData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    database: 'up' | 'down';
    websocket: 'up' | 'down';
    redis: 'up' | 'down';
  };
  metrics: {
    activeConnections: number;
    totalRooms: number;
    messagesPerSecond: number;
    memoryUsage: number;
  };
}

export interface MetricsEventData {
  timestamp: Date;
  connections: {
    total: number;
    byRoom: Record<string, number>;
  };
  messages: {
    perSecond: number;
    perMinute: number;
    total: number;
  };
  performance: {
    averageLatency: number;
    errorRate: number;
  };
}
```

### websocket/types/connection.types.ts

```typescript
import { Socket } from 'socket.io';
import { User } from '../../domain/entities/user.entity';

export interface AuthenticatedSocket extends Socket {
  user: User;
  rooms: Set<string>;
  lastActivity: Date;
  messageCount: number;
  joinedAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface ConnectionMetrics {
  connectionId: string;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  messagesSent: number;
  roomsJoined: string[];
  ipAddress: string;
  userAgent: string;
}

export interface RoomMetrics {
  roomId: string;
  activeUsers: number;
  messagesPerMinute: number;
  lastActivity: Date;
  peakUsers: number;
  totalMessages: number;
}
```

## DTOs de WebSocket

### websocket/dto/send-message.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, IsArray, MinLength, MaxLength } from 'class-validator';
import { MessageType } from '../../domain/enums/message-type.enum';

export class SendMessageDto {
  @IsString()
  @MinLength(1, { message: 'El mensaje no puede estar vacío' })
  @MaxLength(4000, { message: 'El mensaje no puede exceder 4000 caracteres' })
  content: string;

  @IsString()
  roomId: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;

  @IsOptional()
  @IsString()
  parentMessageId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}
```

### websocket/dto/join-room.dto.ts

```typescript
import { IsString, IsOptional } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class LeaveRoomDto {
  @IsString()
  roomId: string;
}

export class GetMessagesDto {
  @IsString()
  roomId: string;

  @IsOptional()
  limit?: number = 50;

  @IsOptional()
  offset?: number = 0;

  @IsOptional()
  before?: Date;
}
```

### websocket/dto/typing.dto.ts

```typescript
import { IsString } from 'class-validator';

export class TypingDto {
  @IsString()
  roomId: string;
}
```

### websocket/dto/reaction.dto.ts

```typescript
import { IsString, IsEnum } from 'class-validator';

export class ReactToMessageDto {
  @IsString()
  messageId: string;

  @IsString()
  roomId: string;

  @IsString()
  emoji: string;

  @IsEnum(['add', 'remove'])
  action: 'add' | 'remove';
}
```

## Servicios de WebSocket

### websocket/services/connection.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedSocket, ConnectionMetrics } from '../types/connection.types';
import { UserStatus } from '../../domain/enums/user-status.enum';
import { UserRepository } from '../../infrastructure/repositories/user.repository';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);
  private connections = new Map<string, AuthenticatedSocket>();
  private userConnections = new Map<string, Set<string>>();
  private connectionMetrics = new Map<string, ConnectionMetrics>();

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.user.id;
    const socketId = socket.id;

    this.logger.log(`User ${socket.user.username} connected from ${socket.ipAddress}`);

    // Registrar conexión
    this.connections.set(socketId, socket);
    
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(socketId);

    // Métricas de conexión
    this.connectionMetrics.set(socketId, {
      connectionId: socketId,
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      messagesSent: 0,
      roomsJoined: [],
      ipAddress: socket.ipAddress,
      userAgent: socket.userAgent
    });

    // Actualizar estado del usuario a online
    await this.updateUserStatus(userId, UserStatus.ONLINE);

    // Unirse a sala personal para notificaciones privadas
    socket.join(`user:${userId}`);

    // Enviar estado inicial
    socket.emit('system:notification', {
      id: `welcome-${Date.now()}`,
      type: 'success',
      title: 'Conectado',
      message: 'Te has conectado exitosamente al chat',
      timestamp: new Date()
    });
  }

  async handleDisconnection(socket: AuthenticatedSocket): Promise<void> {
    const userId = socket.user.id;
    const socketId = socket.id;

    this.logger.log(`User ${socket.user.username} disconnected`);

    // Limpiar registros
    this.connections.delete(socketId);
    this.connectionMetrics.delete(socketId);

    const userSockets = this.userConnections.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      
      // Si no hay más conexiones del usuario, marcarlo como offline
      if (userSockets.size === 0) {
        this.userConnections.delete(userId);
        await this.updateUserStatus(userId, UserStatus.OFFLINE);
      }
    }

    // Notificar a rooms que el usuario se desconectó
    Array.from(socket.rooms).forEach(roomId => {
      if (roomId !== socketId && !roomId.startsWith('user:')) {
        socket.to(roomId).emit('room:user_left', {
          userId,
          username: socket.user.username,
          displayName: socket.user.displayName,
          roomId,
          roomName: '', // Se puede obtener del servicio de rooms
          timestamp: new Date()
        });
      }
    });
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getActiveUsers(): number {
    return this.userConnections.size;
  }

  getUserSockets(userId: string): AuthenticatedSocket[] {
    const socketIds = this.userConnections.get(userId) || new Set();
    return Array.from(socketIds)
      .map(id => this.connections.get(id))
      .filter(socket => socket !== undefined) as AuthenticatedSocket[];
  }

  getConnectionMetrics(): ConnectionMetrics[] {
    return Array.from(this.connectionMetrics.values());
  }

  updateActivity(socketId: string): void {
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics) {
      metrics.lastActivity = new Date();
    }
  }

  incrementMessageCount(socketId: string): void {
    const metrics = this.connectionMetrics.get(socketId);
    if (metrics) {
      metrics.messagesSent++;
    }
  }

  private async updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    try {
      await this.userRepository.updateStatus(userId, status);
      
      // Notificar a otros usuarios del cambio de estado
      const sockets = this.getUserSockets(userId);
      sockets.forEach(socket => {
        socket.broadcast.emit('user:status_changed', {
          userId,
          username: socket.user.username,
          status,
          lastSeen: new Date()
        });
      });
    } catch (error) {
      this.logger.error(`Error updating user status: ${error.message}`);
    }
  }

  constructor(private userRepository: UserRepository) {}
}
```

### websocket/services/room.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedSocket, RoomMetrics } from '../types/connection.types';
import { RoomRepository } from '../../infrastructure/repositories/room.repository';
import { MessageRepository } from '../../infrastructure/repositories/message.repository';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);
  private roomMetrics = new Map<string, RoomMetrics>();
  private typingUsers = new Map<string, Map<string, NodeJS.Timeout>>();

  async joinRoom(socket: AuthenticatedSocket, roomId: string, password?: string): Promise<boolean> {
    try {
      // Verificar que el room existe y el usuario puede acceder
      const room = await this.roomRepository.findById(roomId);
      if (!room || !room.isActive) {
        socket.emit('system:error', {
          code: 'ROOM_NOT_FOUND',
          message: 'La sala no existe o no está disponible',
          timestamp: new Date()
        });
        return false;
      }

      // Verificar permisos de acceso
      if (room.isPrivate && !room.isUserParticipant(socket.user.id)) {
        socket.emit('system:error', {
          code: 'ACCESS_DENIED',
          message: 'No tienes permisos para acceder a esta sala',
          timestamp: new Date()
        });
        return false;
      }

      // Unirse a la sala en Socket.IO
      await socket.join(roomId);
      socket.rooms.add(roomId);

      // Agregar usuario a la sala en la base de datos
      await this.roomRepository.addParticipant(roomId, socket.user.id);

      // Actualizar métricas
      this.updateRoomMetrics(roomId);

      // Notificar a otros usuarios
      socket.to(roomId).emit('room:user_joined', {
        userId: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        roomId,
        roomName: room.name,
        timestamp: new Date()
      });

      // Confirmar unión al usuario
      socket.emit('room:joined', {
        id: room.id,
        name: room.name,
        type: room.type,
        participantCount: room.participants.length,
        lastActivity: room.lastActivity
      });

      this.logger.log(`User ${socket.user.username} joined room ${room.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Error joining room: ${error.message}`);
      socket.emit('system:error', {
        code: 'JOIN_ROOM_ERROR',
        message: 'Error al unirse a la sala',
        details: error.message,
        timestamp: new Date()
      });
      return false;
    }
  }

  async leaveRoom(socket: AuthenticatedSocket, roomId: string): Promise<boolean> {
    try {
      const room = await this.roomRepository.findById(roomId);
      if (!room) {
        return false;
      }

      // Salir de la sala en Socket.IO
      await socket.leave(roomId);
      socket.rooms.delete(roomId);

      // Remover usuario de la sala en la base de datos
      await this.roomRepository.removeParticipant(roomId, socket.user.id);

      // Actualizar métricas
      this.updateRoomMetrics(roomId);

      // Notificar a otros usuarios
      socket.to(roomId).emit('room:user_left', {
        userId: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.displayName,
        roomId,
        roomName: room.name,
        timestamp: new Date()
      });

      // Confirmar salida al usuario
      socket.emit('room:left', {
        id: room.id,
        name: room.name,
        type: room.type,
        participantCount: Math.max(0, room.participants.length - 1),
        lastActivity: new Date()
      });

      this.logger.log(`User ${socket.user.username} left room ${room.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Error leaving room: ${error.message}`);
      return false;
    }
  }

  startTyping(socket: AuthenticatedSocket, roomId: string): void {
    const userId = socket.user.id;
    
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Map());
    }

    const roomTyping = this.typingUsers.get(roomId)!;
    
    // Limpiar timeout anterior si existe
    const existingTimeout = roomTyping.get(userId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Notificar que el usuario está escribiendo
    socket.to(roomId).emit('user:typing', {
      userId,
      username: socket.user.username,
      roomId,
      timestamp: new Date()
    });

    // Configurar timeout para parar automáticamente después de 3 segundos
    const timeout = setTimeout(() => {
      this.stopTyping(socket, roomId);
    }, 3000);

    roomTyping.set(userId, timeout);
  }

  stopTyping(socket: AuthenticatedSocket, roomId: string): void {
    const userId = socket.user.id;
    const roomTyping = this.typingUsers.get(roomId);
    
    if (roomTyping && roomTyping.has(userId)) {
      clearTimeout(roomTyping.get(userId)!);
      roomTyping.delete(userId);

      // Notificar que el usuario dejó de escribir
      socket.to(roomId).emit('user:stopped_typing', {
        userId,
        username: socket.user.username,
        roomId,
        timestamp: new Date()
      });
    }
  }

  getRoomMetrics(): RoomMetrics[] {
    return Array.from(this.roomMetrics.values());
  }

  private updateRoomMetrics(roomId: string): void {
    const existing = this.roomMetrics.get(roomId);
    if (existing) {
      existing.lastActivity = new Date();
    } else {
      this.roomMetrics.set(roomId, {
        roomId,
        activeUsers: 0,
        messagesPerMinute: 0,
        lastActivity: new Date(),
        peakUsers: 0,
        totalMessages: 0
      });
    }
  }

  constructor(
    private roomRepository: RoomRepository,
    private messageRepository: MessageRepository
  ) {}
}
```

### websocket/services/metrics.service.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectionService } from './connection.service';
import { RoomService } from './room.service';
import { MetricsEventData } from '../types/websocket.types';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private metricsHistory: MetricsEventData[] = [];
  private readonly MAX_HISTORY = 1440; // 24 horas con métricas cada minuto

  constructor(
    private connectionService: ConnectionService,
    private roomService: RoomService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  collectMetrics(): void {
    const metrics: MetricsEventData = {
      timestamp: new Date(),
      connections: {
        total: this.connectionService.getActiveConnections(),
        byRoom: this.getRoomConnectionCounts()
      },
      messages: {
        perSecond: this.calculateMessagesPerSecond(),
        perMinute: this.calculateMessagesPerMinute(),
        total: this.getTotalMessages()
      },
      performance: {
        averageLatency: this.calculateAverageLatency(),
        errorRate: this.calculateErrorRate()
      }
    };

    this.metricsHistory.push(metrics);
    
    // Mantener solo las últimas 24 horas
    if (this.metricsHistory.length > this.MAX_HISTORY) {
      this.metricsHistory.shift();
    }

    this.logger.debug(`Metrics collected: ${JSON.stringify(metrics)}`);
  }

  getLatestMetrics(): MetricsEventData | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(hours: number = 1): MetricsEventData[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  getSystemHealth(): any {
    const latest = this.getLatestMetrics();
    if (!latest) {
      return {
        status: 'unknown',
        timestamp: new Date(),
        services: {
          database: 'unknown',
          websocket: 'unknown',
          redis: 'unknown'
        },
        metrics: {
          activeConnections: 0,
          totalRooms: 0,
          messagesPerSecond: 0,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
        }
      };
    }

    return {
      status: this.determineHealthStatus(latest),
      timestamp: new Date(),
      services: {
        database: 'up', // Implementar check real
        websocket: latest.connections.total > 0 ? 'up' : 'degraded',
        redis: 'up' // Implementar check real
      },
      metrics: {
        activeConnections: latest.connections.total,
        totalRooms: Object.keys(latest.connections.byRoom).length,
        messagesPerSecond: latest.messages.perSecond,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
      }
    };
  }

  private getRoomConnectionCounts(): Record<string, number> {
    const roomMetrics = this.roomService.getRoomMetrics();
    const result: Record<string, number> = {};
    
    roomMetrics.forEach(metric => {
      result[metric.roomId] = metric.activeUsers;
    });

    return result;
  }

  private calculateMessagesPerSecond(): number {
    // Implementar cálculo basado en métricas de conexión
    const connections = this.connectionService.getConnectionMetrics();
    const now = new Date();
    const oneSecondAgo = new Date(now.getTime() - 1000);
    
    return connections.reduce((total, conn) => {
      return total + (conn.lastActivity >= oneSecondAgo ? 1 : 0);
    }, 0);
  }

  private calculateMessagesPerMinute(): number {
    if (this.metricsHistory.length < 2) return 0;
    
    const current = this.metricsHistory[this.metricsHistory.length - 1];
    const previous = this.metricsHistory[this.metricsHistory.length - 2];
    
    return current.messages.total - previous.messages.total;
  }

  private getTotalMessages(): number {
    // Implementar conteo total de mensajes
    return this.connectionService.getConnectionMetrics()
      .reduce((total, conn) => total + conn.messagesSent, 0);
  }

  private calculateAverageLatency(): number {
    // Implementar cálculo de latencia promedio
    // Por ahora retornamos un valor simulado
    return Math.random() * 100 + 20; // 20-120ms
  }

  private calculateErrorRate(): number {
    // Implementar cálculo de tasa de errores
    // Por ahora retornamos un valor simulado
    return Math.random() * 0.05; // 0-5%
  }

  private determineHealthStatus(metrics: MetricsEventData): 'healthy' | 'degraded' | 'unhealthy' {
    const { performance, connections } = metrics;
    
    if (performance.errorRate > 0.1 || performance.averageLatency > 1000) {
      return 'unhealthy';
    }
    
    if (performance.errorRate > 0.05 || performance.averageLatency > 500 || connections.total > 5000) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}
```

## Gateway Principal de WebSocket

### websocket/websocket.gateway.ts

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server } from 'socket.io';
import { AuthenticatedSocket, ServerToClientEvents, ClientToServerEvents } from './types/websocket.types';
import { WebSocketAuthGuard } from './guards/ws-auth.guard';
import { WsRateLimitGuard } from './guards/ws-rate-limit.guard';
import { ConnectionService } from './services/connection.service';
import { RoomService } from './services/room.service';
import { MetricsService } from './services/metrics.service';
import { MessageRepository } from '../infrastructure/repositories/message.repository';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinRoomDto, LeaveRoomDto, GetMessagesDto } from './dto/join-room.dto';
import { TypingDto } from './dto/typing.dto';
import { ReactToMessageDto } from './dto/reaction.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true
  },
  transports: ['websocket', 'polling'],
  namespace: '/chat'
})
@UseGuards(WebSocketAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(
    private connectionService: ConnectionService,
    private roomService: RoomService,
    private metricsService: MetricsService,
    private messageRepository: MessageRepository
  ) {}

  afterInit(server: Server): void {
    this.logger.log('WebSocket Gateway initialized');
    
    // Configurar middleware de autenticación
    server.use((socket, next) => {
      // La autenticación se maneja en el guard
      const authSocket = socket as AuthenticatedSocket;
      authSocket.rooms = new Set();
      authSocket.lastActivity = new Date();
      authSocket.messageCount = 0;
      authSocket.joinedAt = new Date();
      authSocket.ipAddress = socket.handshake.address;
      authSocket.userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
      next();
    });
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    await this.connectionService.handleConnection(client);
    this.logger.log(`Client connected: ${client.user.username} (${client.id})`);
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    await this.connectionService.handleDisconnection(client);
    this.logger.log(`Client disconnected: ${client.user.username} (${client.id})`);
  }

  // Eventos de mensajes
  @SubscribeMessage('message:send')
  @UseGuards(WsRateLimitGuard)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto
  ): Promise<any> {
    try {
      // Verificar que el usuario está en la sala
      if (!client.rooms.has(data.roomId)) {
        return {
          success: false,
          error: 'No estás en esta sala'
        };
      }

      // Crear mensaje en la base de datos
      const message = await this.messageRepository.create(data, client.user.id);

      // Actualizar métricas
      this.connectionService.updateActivity(client.id);
      this.connectionService.incrementMessageCount(client.id);

      // Emitir mensaje a todos los usuarios de la sala
      const messageEvent = {
        id: message.id,
        content: message.content,
        type: message.type,
        senderId: client.user.id,
        senderName: client.user.displayName,
        roomId: data.roomId,
        timestamp: message.createdAt,
        attachments: message.attachments,
        parentMessageId: message.parentMessageId,
        reactions: message.reactions
      };

      this.server.to(data.roomId).emit('message:new', messageEvent);

      return {
        success: true,
        message: messageEvent
      };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return {
        success: false,
        error: 'Error al enviar el mensaje'
      };
    }
  }

  @SubscribeMessage('message:react')
  async handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: ReactToMessageDto
  ): Promise<any> {
    try {
      const message = await this.messageRepository.findById(data.messageId);
      if (!message || message.roomId !== data.roomId) {
        return {
          success: false,
          error: 'Mensaje no encontrado'
        };
      }

      if (data.action === 'add') {
        await this.messageRepository.addReaction(data.messageId, data.emoji, client.user.id);
      } else {
        await this.messageRepository.removeReaction(data.messageId, data.emoji, client.user.id);
      }

      // Emitir reacción a todos los usuarios de la sala
      this.server.to(data.roomId).emit('message:reaction', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: client.user.id,
        action: data.action,
        timestamp: new Date()
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling reaction: ${error.message}`);
      return {
        success: false,
        error: 'Error al procesar la reacción'
      };
    }
  }

  // Eventos de salas
  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinRoomDto
  ): Promise<any> {
    const success = await this.roomService.joinRoom(client, data.roomId, data.password);
    return { success };
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: LeaveRoomDto
  ): Promise<any> {
    const success = await this.roomService.leaveRoom(client, data.roomId);
    return { success };
  }

  @SubscribeMessage('room:get_messages')
  async handleGetMessages(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: GetMessagesDto
  ): Promise<any> {
    try {
      if (!client.rooms.has(data.roomId)) {
        return {
          success: false,
          error: 'No estás en esta sala'
        };
      }

      const messages = await this.messageRepository.findByRoomId(
        data.roomId,
        data.limit,
        data.offset
      );

      return {
        success: true,
        messages: messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          type: msg.type,
          senderId: msg.senderId,
          roomId: msg.roomId,
          timestamp: msg.createdAt,
          attachments: msg.attachments,
          parentMessageId: msg.parentMessageId,
          reactions: msg.reactions,
          isEdited: msg.isEdited,
          editedAt: msg.editedAt
        }))
      };
    } catch (error) {
      this.logger.error(`Error getting messages: ${error.message}`);
      return {
        success: false,
        error: 'Error al obtener los mensajes'
      };
    }
  }

  // Eventos de typing
  @SubscribeMessage('typing:start')
  handleStartTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto
  ): void {
    if (client.rooms.has(data.roomId)) {
      this.roomService.startTyping(client, data.roomId);
    }
  }

  @SubscribeMessage('typing:stop')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingDto
  ): void {
    if (client.rooms.has(data.roomId)) {
      this.roomService.stopTyping(client, data.roomId);
    }
  }

  // Eventos de sistema
  @SubscribeMessage('system:ping')
  handlePing(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() timestamp: number
  ): number {
    const latency = Date.now() - timestamp;
    this.connectionService.updateActivity(client.id);
    return latency;
  }

  @SubscribeMessage('system:get_health')
  handleGetHealth(): any {
    return this.metricsService.getSystemHealth();
  }
}
```

## Guards de WebSocket

### websocket/guards/ws-rate-limit.guard.ts

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthenticatedSocket } from '../types/connection.types';

@Injectable()
export class WsRateLimitGuard implements CanActivate {
  private readonly rateLimits = new Map<string, { count: number; resetTime: number }>();
  private readonly MAX_MESSAGES_PER_MINUTE = 30;
  private readonly WINDOW_MS = 60 * 1000; // 1 minuto

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const userId = client.user.id;
    const now = Date.now();

    const userLimit = this.rateLimits.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      // Nueva ventana de tiempo
      this.rateLimits.set(userId, {
        count: 1,
        resetTime: now + this.WINDOW_MS
      });
      return true;
    }

    if (userLimit.count >= this.MAX_MESSAGES_PER_MINUTE) {
      // Rate limit excedido
      client.emit('system:error', {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Has enviado demasiados mensajes. Límite: ${this.MAX_MESSAGES_PER_MINUTE} por minuto`,
        timestamp: new Date()
      });
      return false;
    }

    // Incrementar contador
    userLimit.count++;
    return true;
  }
}
```

## Health Checks

### health/indicators/websocket.indicator.ts

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConnectionService } from '../../websocket/services/connection.service';
import { MetricsService } from '../../websocket/services/metrics.service';

@Injectable()
export class WebSocketHealthIndicator extends HealthIndicator {
  constructor(
    private connectionService: ConnectionService,
    private metricsService: MetricsService
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const connections = this.connectionService.getActiveConnections();
    const metrics = this.metricsService.getLatestMetrics();
    
    const isHealthy = connections >= 0 && (!metrics || metrics.performance.errorRate < 0.1);
    
    const result = this.getStatus(key, isHealthy, {
      activeConnections: connections,
      activeUsers: this.connectionService.getActiveUsers(),
      errorRate: metrics?.performance.errorRate || 0,
      averageLatency: metrics?.performance.averageLatency || 0
    });

    if (isHealthy) {
      return result;
    }

    throw new HealthCheckError('WebSocket check failed', result);
  }
}
```

### health/health.controller.ts

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { WebSocketHealthIndicator } from './indicators/websocket.indicator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private websocket: WebSocketHealthIndicator
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.mongoose.pingCheck('database'),
      () => this.websocket.isHealthy('websocket')
    ]);
  }

  @Get('websocket')
  @Public()
  @HealthCheck()
  checkWebSocket() {
    return this.health.check([
      () => this.websocket.isHealthy('websocket')
    ]);
  }
}
```

## Módulo WebSocket

### websocket/websocket.module.ts

```typescript
import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { ConnectionService } from './services/connection.service';
import { RoomService } from './services/room.service';
import { MetricsService } from './services/metrics.service';
import { WebSocketAuthGuard } from './guards/ws-auth.guard';
import { WsRateLimitGuard } from './guards/ws-rate-limit.guard';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule
  ],
  providers: [
    WebSocketGateway,
    ConnectionService,
    RoomService,
    MetricsService,
    WebSocketAuthGuard,
    WsRateLimitGuard
  ],
  exports: [
    ConnectionService,
    RoomService,
    MetricsService
  ]
})
export class WebSocketModule {}
```

## Checklist de Validación

### ✅ Configuración WebSocket
- [ ] Gateway configurado con autenticación JWT
- [ ] CORS configurado apropiadamente
- [ ] Transports WebSocket y polling habilitados
- [ ] Namespace `/chat` configurado

### ✅ Gestión de Conexiones
- [ ] Autenticación automática en conexión
- [ ] Registro y limpieza de conexiones
- [ ] Actualización de estado de usuario
- [ ] Métricas de conexión implementadas

### ✅ Sistema de Rooms
- [ ] Join/leave rooms con validaciones
- [ ] Notificaciones de usuarios entrando/saliendo
- [ ] Verificación de permisos de acceso
- [ ] Manejo de rooms privados

### ✅ Mensajería en Tiempo Real
- [ ] Envío y recepción de mensajes
- [ ] Reacciones a mensajes
- [ ] Typing indicators
- [ ] Rate limiting para prevenir spam

### ✅ Health Checks y Métricas
- [ ] Health checks para WebSocket
- [ ] Métricas de performance
- [ ] Logging de eventos importantes
- [ ] Dashboard de monitoreo preparado

### ✅ Seguridad
- [ ] Autenticación JWT obligatoria
- [ ] Rate limiting por usuario
- [ ] Validación de permisos por room
- [ ] Sanitización de datos de entrada

## Comandos de Validación

### Instalar dependencias
```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
npm install @nestjs/schedule @nestjs/terminus
npm install -D @types/socket.io
```

### Probar conexión WebSocket
```javascript
// Desde el frontend o herramienta de testing
const socket = io('http://localhost:3001/chat', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
  
  // Unirse a una sala
  socket.emit('room:join', { roomId: 'room-id' }, (response) => {
    console.log('Join room response:', response);
  });
  
  // Enviar mensaje
  socket.emit('message:send', {
    content: 'Hello World!',
    roomId: 'room-id'
  }, (response) => {
    console.log('Message sent:', response);
  });
});
```

### Verificar health checks
```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/websocket
```

## Troubleshooting

### Error: CORS no permitido
```bash
# Verificar configuración CORS en el gateway
# Asegurarse de que el origin del frontend está permitido
```

### Error: Autenticación fallida
```bash
# Verificar que el token JWT se envía correctamente
# Verificar que el WebSocketAuthGuard está configurado
```

### Performance: Muchas conexiones
```bash
# Monitorear métricas de memoria y CPU
# Considerar implementar clustering
# Verificar configuración de rate limiting
```
