# Step 7.1: Sistema de Notificaciones Avanzado

## Objetivos
- Implementar sistema de notificaciones en tiempo real
- Crear motor de reglas de notificación configurable
- Desarrollar múltiples canales de entrega
- Implementar sistema de preferencias de usuario

## Arquitectura del Sistema

### 1. Entities y Value Objects

```typescript
// src/notifications/domain/entities/notification.entity.ts
export class Notification {
  constructor(
    public readonly id: NotificationId,
    public readonly userId: UserId,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly content: NotificationContent,
    public readonly priority: NotificationPriority,
    public readonly metadata: NotificationMetadata,
    public readonly channels: DeliveryChannel[],
    public readonly scheduledAt?: Date,
    public readonly expiresAt?: Date,
    private _status: NotificationStatus = NotificationStatus.PENDING,
    private _readAt?: Date,
    private _deliveredAt?: Date,
    private readonly _createdAt: Date = new Date()
  ) {}

  markAsRead(): void {
    if (this._status !== NotificationStatus.DELIVERED) {
      throw new Error('Cannot mark undelivered notification as read');
    }
    this._readAt = new Date();
    this._status = NotificationStatus.READ;
  }

  markAsDelivered(): void {
    this._deliveredAt = new Date();
    this._status = NotificationStatus.DELIVERED;
  }

  isExpired(): boolean {
    return this.expiresAt ? new Date() > this.expiresAt : false;
  }

  get status(): NotificationStatus { return this._status; }
  get readAt(): Date | undefined { return this._readAt; }
  get deliveredAt(): Date | undefined { return this._deliveredAt; }
  get createdAt(): Date { return this._createdAt; }
}

// Value Objects
export class NotificationContent {
  constructor(
    public readonly body: string,
    public readonly actionUrl?: string,
    public readonly imageUrl?: string,
    public readonly data?: Record<string, any>
  ) {
    if (!body || body.trim().length === 0) {
      throw new Error('Notification body cannot be empty');
    }
  }
}

export class NotificationMetadata {
  constructor(
    public readonly source: string,
    public readonly sourceId: string,
    public readonly tags: string[] = [],
    public readonly customData: Record<string, any> = {}
  ) {}
}

export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  REACTION = 'reaction',
  FILE_SHARED = 'file_shared',
  THREAD_REPLY = 'thread_reply',
  SYSTEM = 'system',
  ANNOUNCEMENT = 'announcement'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum DeliveryChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
  WEBHOOK = 'webhook'
}
```

### 2. Preferences System

```typescript
// src/notifications/domain/entities/notification-preferences.entity.ts
export class NotificationPreferences {
  constructor(
    public readonly userId: UserId,
    private _globalEnabled: boolean = true,
    private _channelPreferences: Map<DeliveryChannel, ChannelPreference> = new Map(),
    private _typePreferences: Map<NotificationType, TypePreference> = new Map(),
    private _quietHours: QuietHours[] = []
  ) {}

  setChannelPreference(channel: DeliveryChannel, preference: ChannelPreference): void {
    this._channelPreferences.set(channel, preference);
  }

  setTypePreference(type: NotificationType, preference: TypePreference): void {
    this._typePreferences.set(type, preference);
  }

  addQuietHours(quietHours: QuietHours): void {
    this._quietHours.push(quietHours);
  }

  shouldReceiveNotification(
    type: NotificationType,
    channel: DeliveryChannel,
    timestamp: Date = new Date()
  ): boolean {
    if (!this._globalEnabled) return false;
    
    if (this.isInQuietHours(timestamp)) return false;
    
    const typePreference = this._typePreferences.get(type);
    if (typePreference && !typePreference.enabled) return false;
    
    const channelPreference = this._channelPreferences.get(channel);
    if (channelPreference && !channelPreference.enabled) return false;
    
    return true;
  }

  private isInQuietHours(timestamp: Date): boolean {
    return this._quietHours.some(qh => qh.isWithinQuietPeriod(timestamp));
  }

  get channelPreferences(): Map<DeliveryChannel, ChannelPreference> {
    return new Map(this._channelPreferences);
  }

  get typePreferences(): Map<NotificationType, TypePreference> {
    return new Map(this._typePreferences);
  }
}

export class ChannelPreference {
  constructor(
    public readonly enabled: boolean = true,
    public readonly minimumPriority: NotificationPriority = NotificationPriority.NORMAL
  ) {}
}

export class TypePreference {
  constructor(
    public readonly enabled: boolean = true,
    public readonly channels: DeliveryChannel[] = []
  ) {}
}

export class QuietHours {
  constructor(
    public readonly startTime: string, // HH:mm format
    public readonly endTime: string,   // HH:mm format
    public readonly daysOfWeek: number[] = [1, 2, 3, 4, 5, 6, 7] // 1=Monday
  ) {}

  isWithinQuietPeriod(timestamp: Date): boolean {
    const day = timestamp.getDay() || 7; // Convert Sunday from 0 to 7
    if (!this.daysOfWeek.includes(day)) return false;

    const timeStr = timestamp.toTimeString().substring(0, 5);
    
    if (this.startTime <= this.endTime) {
      return timeStr >= this.startTime && timeStr <= this.endTime;
    } else {
      // Crosses midnight
      return timeStr >= this.startTime || timeStr <= this.endTime;
    }
  }
}
```

### 3. Repository Interfaces

```typescript
// src/notifications/domain/repositories/notification.repository.ts
export interface INotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: NotificationId): Promise<Notification | null>;
  findByUserId(userId: UserId, options?: FindOptions): Promise<Notification[]>;
  findUnread(userId: UserId): Promise<Notification[]>;
  markAsRead(id: NotificationId): Promise<void>;
  markAllAsRead(userId: UserId): Promise<void>;
  delete(id: NotificationId): Promise<void>;
  deleteExpired(): Promise<number>;
  countUnread(userId: UserId): Promise<number>;
}

export interface INotificationPreferencesRepository {
  save(preferences: NotificationPreferences): Promise<void>;
  findByUserId(userId: UserId): Promise<NotificationPreferences | null>;
  delete(userId: UserId): Promise<void>;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  types?: NotificationType[];
  status?: NotificationStatus[];
  fromDate?: Date;
  toDate?: Date;
}
```

### 4. Use Cases

```typescript
// src/notifications/application/use-cases/send-notification.use-case.ts
@Injectable()
export class SendNotificationUseCase {
  constructor(
    private readonly notificationRepository: INotificationRepository,
    private readonly preferencesRepository: INotificationPreferencesRepository,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly eventBus: IEventBus
  ) {}

  async execute(command: SendNotificationCommand): Promise<NotificationResult> {
    try {
      const preferences = await this.preferencesRepository.findByUserId(command.userId);
      
      const notification = new Notification(
        NotificationId.generate(),
        command.userId,
        command.type,
        command.title,
        new NotificationContent(command.body, command.actionUrl, command.imageUrl),
        command.priority,
        new NotificationMetadata(command.source, command.sourceId, command.tags),
        this.filterChannelsByPreferences(command.channels, preferences, command.type)
      );

      if (notification.channels.length === 0) {
        return NotificationResult.filtered();
      }

      await this.notificationRepository.save(notification);

      // Schedule or send immediately
      if (command.scheduledAt && command.scheduledAt > new Date()) {
        await this.scheduleNotification(notification);
      } else {
        await this.deliveryService.deliver(notification);
      }

      await this.eventBus.publish(new NotificationSentEvent(notification.id, command.userId));

      return NotificationResult.success(notification.id);
    } catch (error) {
      return NotificationResult.error(error.message);
    }
  }

  private filterChannelsByPreferences(
    channels: DeliveryChannel[],
    preferences: NotificationPreferences | null,
    type: NotificationType
  ): DeliveryChannel[] {
    if (!preferences) return channels;

    return channels.filter(channel =>
      preferences.shouldReceiveNotification(type, channel)
    );
  }

  private async scheduleNotification(notification: Notification): Promise<void> {
    // Integration with job scheduler (Bull, Agenda, etc.)
    // Implementation depends on chosen scheduler
  }
}

// src/notifications/application/use-cases/get-user-notifications.use-case.ts
@Injectable()
export class GetUserNotificationsUseCase {
  constructor(
    private readonly notificationRepository: INotificationRepository
  ) {}

  async execute(query: GetUserNotificationsQuery): Promise<NotificationPageResult> {
    const notifications = await this.notificationRepository.findByUserId(
      query.userId,
      {
        limit: query.limit,
        offset: query.offset,
        types: query.types,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate
      }
    );

    const unreadCount = await this.notificationRepository.countUnread(query.userId);

    return new NotificationPageResult(
      notifications.map(n => NotificationDto.fromEntity(n)),
      unreadCount,
      query.offset,
      query.limit
    );
  }
}
```

### 5. Delivery Service

```typescript
// src/notifications/infrastructure/services/notification-delivery.service.ts
@Injectable()
export class NotificationDeliveryService {
  private readonly deliveryProviders = new Map<DeliveryChannel, IDeliveryProvider>();

  constructor(
    private readonly inAppProvider: InAppDeliveryProvider,
    private readonly emailProvider: EmailDeliveryProvider,
    private readonly pushProvider: PushDeliveryProvider,
    private readonly smsProvider: SmsDeliveryProvider,
    private readonly webhookProvider: WebhookDeliveryProvider
  ) {
    this.deliveryProviders.set(DeliveryChannel.IN_APP, inAppProvider);
    this.deliveryProviders.set(DeliveryChannel.EMAIL, emailProvider);
    this.deliveryProviders.set(DeliveryChannel.PUSH, pushProvider);
    this.deliveryProviders.set(DeliveryChannel.SMS, smsProvider);
    this.deliveryProviders.set(DeliveryChannel.WEBHOOK, webhookProvider);
  }

  async deliver(notification: Notification): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const channel of notification.channels) {
      const provider = this.deliveryProviders.get(channel);
      if (!provider) {
        results.push(DeliveryResult.error(channel, 'Provider not found'));
        continue;
      }

      try {
        const result = await provider.deliver(notification);
        results.push(result);
      } catch (error) {
        results.push(DeliveryResult.error(channel, error.message));
      }
    }

    // Update notification status based on delivery results
    if (results.some(r => r.success)) {
      notification.markAsDelivered();
    }

    return results;
  }
}

// Delivery Providers
export interface IDeliveryProvider {
  deliver(notification: Notification): Promise<DeliveryResult>;
}

@Injectable()
export class InAppDeliveryProvider implements IDeliveryProvider {
  constructor(
    private readonly websocketGateway: WebSocketGateway
  ) {}

  async deliver(notification: Notification): Promise<DeliveryResult> {
    try {
      await this.websocketGateway.sendToUser(
        notification.userId.value,
        'notification',
        NotificationDto.fromEntity(notification)
      );
      return DeliveryResult.success(DeliveryChannel.IN_APP);
    } catch (error) {
      return DeliveryResult.error(DeliveryChannel.IN_APP, error.message);
    }
  }
}

@Injectable()
export class EmailDeliveryProvider implements IDeliveryProvider {
  constructor(
    private readonly emailService: EmailService,
    private readonly userRepository: IUserRepository
  ) {}

  async deliver(notification: Notification): Promise<DeliveryResult> {
    try {
      const user = await this.userRepository.findById(notification.userId);
      if (!user || !user.email) {
        return DeliveryResult.error(DeliveryChannel.EMAIL, 'User email not found');
      }

      await this.emailService.send({
        to: user.email.value,
        subject: notification.title,
        template: 'notification',
        context: {
          title: notification.title,
          body: notification.content.body,
          actionUrl: notification.content.actionUrl,
          imageUrl: notification.content.imageUrl
        }
      });

      return DeliveryResult.success(DeliveryChannel.EMAIL);
    } catch (error) {
      return DeliveryResult.error(DeliveryChannel.EMAIL, error.message);
    }
  }
}
```

### 6. Controllers y DTOs

```typescript
// src/notifications/infrastructure/controllers/notifications.controller.ts
@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly getUserNotificationsUseCase: GetUserNotificationsUseCase,
    private readonly markAsReadUseCase: MarkNotificationAsReadUseCase,
    private readonly updatePreferencesUseCase: UpdateNotificationPreferencesUseCase
  ) {}

  @Get()
  async getNotifications(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: GetNotificationsQueryDto
  ): Promise<NotificationPageResponseDto> {
    const result = await this.getUserNotificationsUseCase.execute(
      new GetUserNotificationsQuery(
        UserId.fromString(user.id),
        query.limit,
        query.offset,
        query.types,
        query.status,
        query.fromDate,
        query.toDate
      )
    );
    return NotificationPageResponseDto.fromResult(result);
  }

  @Post(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto
  ): Promise<void> {
    await this.markAsReadUseCase.execute(
      new MarkAsReadCommand(NotificationId.fromString(id), UserId.fromString(user.id))
    );
  }

  @Post('read-all')
  async markAllAsRead(@CurrentUser() user: CurrentUserDto): Promise<void> {
    await this.markAsReadUseCase.execute(
      new MarkAllAsReadCommand(UserId.fromString(user.id))
    );
  }

  @Get('preferences')
  async getPreferences(@CurrentUser() user: CurrentUserDto): Promise<NotificationPreferencesDto> {
    const result = await this.getPreferencesUseCase.execute(
      new GetPreferencesQuery(UserId.fromString(user.id))
    );
    return NotificationPreferencesDto.fromEntity(result);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: UpdatePreferencesDto
  ): Promise<void> {
    await this.updatePreferencesUseCase.execute(
      new UpdatePreferencesCommand(
        UserId.fromString(user.id),
        dto.globalEnabled,
        dto.channelPreferences,
        dto.typePreferences,
        dto.quietHours
      )
    );
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: CurrentUserDto): Promise<{ count: number }> {
    const count = await this.getUnreadCountUseCase.execute(
      new GetUnreadCountQuery(UserId.fromString(user.id))
    );
    return { count };
  }
}

// DTOs
export class NotificationDto {
  constructor(
    public readonly id: string,
    public readonly type: NotificationType,
    public readonly title: string,
    public readonly body: string,
    public readonly priority: NotificationPriority,
    public readonly status: NotificationStatus,
    public readonly actionUrl?: string,
    public readonly imageUrl?: string,
    public readonly data?: Record<string, any>,
    public readonly readAt?: Date,
    public readonly createdAt?: Date
  ) {}

  static fromEntity(notification: Notification): NotificationDto {
    return new NotificationDto(
      notification.id.value,
      notification.type,
      notification.title,
      notification.content.body,
      notification.priority,
      notification.status,
      notification.content.actionUrl,
      notification.content.imageUrl,
      notification.content.data,
      notification.readAt,
      notification.createdAt
    );
  }
}
```

### 7. Real-time Integration

```typescript
// src/notifications/infrastructure/websocket/notification.gateway.ts
@WebSocketGateway({
  namespace: 'notifications',
  cors: { origin: '*' }
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly authService: AuthService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.authService.validateSocketConnection(client);
      const userId = user.id;
      
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(client.id);
      
      client.join(`user:${userId}`);
      
      // Send unread count on connection
      const unreadCount = await this.getUnreadCountUseCase.execute(
        new GetUnreadCountQuery(UserId.fromString(userId))
      );
      client.emit('unread-count', { count: unreadCount });
      
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client.id)) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  @SubscribeMessage('mark-as-read')
  async handleMarkAsRead(
    client: Socket,
    payload: { notificationId: string }
  ) {
    try {
      const user = await this.authService.validateSocketConnection(client);
      await this.markAsReadUseCase.execute(
        new MarkAsReadCommand(
          NotificationId.fromString(payload.notificationId),
          UserId.fromString(user.id)
        )
      );
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  async sendNotificationToUser(userId: string, notification: NotificationDto) {
    this.server.to(`user:${userId}`).emit('notification', notification);
    
    // Update unread count
    const unreadCount = await this.getUnreadCountUseCase.execute(
      new GetUnreadCountQuery(UserId.fromString(userId))
    );
    this.server.to(`user:${userId}`).emit('unread-count', { count: unreadCount });
  }
}
```

## Tareas de Implementación

### Fase 1: Configuración Base (Días 1-2)
- [ ] Crear estructura de directorios para notifications
- [ ] Implementar entities y value objects básicos
- [ ] Configurar repositorios con TypeORM
- [ ] Crear migraciones de base de datos

### Fase 2: Casos de Uso Core (Días 3-4)
- [ ] Implementar SendNotificationUseCase
- [ ] Crear GetUserNotificationsUseCase
- [ ] Desarrollar MarkAsReadUseCase
- [ ] Implementar sistema de preferencias

### Fase 3: Delivery Providers (Días 5-6)
- [ ] Implementar InAppDeliveryProvider
- [ ] Crear EmailDeliveryProvider con templates
- [ ] Configurar PushDeliveryProvider (Firebase)
- [ ] Implementar SmsDeliveryProvider (Twilio)

### Fase 4: API y WebSocket (Días 7-8)
- [ ] Crear controllers REST
- [ ] Implementar NotificationGateway
- [ ] Crear DTOs y validaciones
- [ ] Integrar con sistema de autenticación

### Fase 5: Features Avanzados (Días 9-10)
- [ ] Sistema de scheduling
- [ ] Batch notifications
- [ ] Analytics y métricas
- [ ] Rate limiting y throttling

## Testing

```typescript
// test/notifications/send-notification.use-case.spec.ts
describe('SendNotificationUseCase', () => {
  let useCase: SendNotificationUseCase;
  let notificationRepository: MockType<INotificationRepository>;
  let preferencesRepository: MockType<INotificationPreferencesRepository>;
  let deliveryService: MockType<NotificationDeliveryService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SendNotificationUseCase,
        {
          provide: INotificationRepository,
          useFactory: createMockRepository
        },
        {
          provide: INotificationPreferencesRepository,
          useFactory: createMockRepository
        },
        {
          provide: NotificationDeliveryService,
          useFactory: createMockService
        }
      ]
    }).compile();

    useCase = module.get(SendNotificationUseCase);
    notificationRepository = module.get(INotificationRepository);
    preferencesRepository = module.get(INotificationPreferencesRepository);
    deliveryService = module.get(NotificationDeliveryService);
  });

  it('should send notification successfully', async () => {
    // Test implementation
  });

  it('should filter channels based on user preferences', async () => {
    // Test implementation
  });

  it('should respect quiet hours', async () => {
    // Test implementation
  });
});
```

## Métricas y Monitoreo

- **Delivery Rate**: Porcentaje de notificaciones entregadas exitosamente
- **Read Rate**: Porcentaje de notificaciones leídas
- **Channel Performance**: Efectividad por canal de entrega
- **Error Rate**: Tasa de errores por proveedor
- **Latency**: Tiempo de entrega de notificaciones
- **User Engagement**: Interacciones con notificaciones

Este sistema proporcionará una base sólida para notificaciones en tiempo real con múltiples canales de entrega y alta configurabilidad.
