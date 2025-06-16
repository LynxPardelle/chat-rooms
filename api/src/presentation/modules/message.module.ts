import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MessageController } from '../controllers/message.controller';
import { MessageService } from '../../application/services/message.service';
import { MessageSearchService } from '../../application/services/message-search.service';
import { MessageRepository } from '../../infrastructure/database/repositories/message.repository';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { ThreadRepository } from '../../infrastructure/database/repositories/thread.repository';
import { ReactionRepository } from '../../infrastructure/database/repositories/reaction.repository';
import { MentionService } from '../../infrastructure/services/mention.service';
import { CacheService } from '../../infrastructure/services/cache.service';
import { Message, MessageSchema } from '../../infrastructure/database/models/message.schema';
import { User, UserSchema } from '../../infrastructure/database/models/user.schema';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { MonitoringModule } from '../../infrastructure/monitoring/monitoring.module';
import { 
  MESSAGE_REPOSITORY_TOKEN, 
  USER_REPOSITORY_TOKEN,
  THREAD_REPOSITORY_TOKEN,
  REACTION_REPOSITORY_TOKEN,
  MENTION_SERVICE_TOKEN
} from '../../domain/constants';
import { 
  ChatGateway, 
  SocketService, 
  WebSocketConfigService, 
  WebSocketHealthController,
  RealtimeSyncService,
  BroadcastingService,
  MessageQueueService,
  PresenceService,
  TypingService,
  ReadReceiptService,
  NotificationService
} from '../../infrastructure/websockets';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SecurityModule,
    CacheModule,
    MonitoringModule,
  ],controllers: [MessageController, WebSocketHealthController],  providers: [
    MessageService,
    MessageSearchService,    ChatGateway,
    SocketService,
    WebSocketConfigService,
    // New WebSocket Services
    RealtimeSyncService,
    BroadcastingService,
    MessageQueueService,
    PresenceService,
    TypingService,
    ReadReceiptService,    NotificationService,
    // Repository providers (direct)
    MessageRepository,
    UserRepository,
    ThreadRepository,
    ReactionRepository,
    MentionService,
    CacheService,
    // Repository providers (tokens)
    {
      provide: MESSAGE_REPOSITORY_TOKEN,
      useClass: MessageRepository,
    },
    {
      provide: USER_REPOSITORY_TOKEN,
      useClass: UserRepository,
    },
    {
      provide: THREAD_REPOSITORY_TOKEN,
      useClass: ThreadRepository,
    },
    {
      provide: REACTION_REPOSITORY_TOKEN,
      useClass: ReactionRepository,
    },
    {
      provide: MENTION_SERVICE_TOKEN,
      useClass: MentionService,
    },
    {
      provide: 'CACHE_SERVICE',
      useClass: CacheService,
    },
  ],  exports: [
    MessageService, 
    MessageSearchService,    SocketService, 
    ChatGateway, 
    WebSocketConfigService,
    // New WebSocket Services
    RealtimeSyncService,
    BroadcastingService,
    MessageQueueService,
    PresenceService,
    TypingService,
    ReadReceiptService,
    NotificationService,
    // Repository tokens
    MESSAGE_REPOSITORY_TOKEN,
    USER_REPOSITORY_TOKEN,
    THREAD_REPOSITORY_TOKEN,
    REACTION_REPOSITORY_TOKEN,
    MENTION_SERVICE_TOKEN,
    'CACHE_SERVICE',
  ],
})
export class MessageModule {}
