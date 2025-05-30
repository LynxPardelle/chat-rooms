# Step 4.1: Sistema Completo de Mensajería con Arquitectura Hexagonal y Real-Time

## Objetivo

Implementar un sistema de mensajería empresarial completo con arquitectura hexagonal, hilos de conversación, reacciones, menciones, búsqueda full-text y sincronización en tiempo real.

## Requisitos Previos

- Fase 3 completada (autenticación y seguridad)
- MongoDB configurado y funcionando
- Sistema JWT implementado
- WebSocket básico configurado

## Arquitectura Hexagonal del Sistema

```text
src/
├── modules/
│   └── messaging/
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── message.entity.ts
│       │   │   ├── thread.entity.ts
│       │   │   ├── reaction.entity.ts
│       │   │   └── mention.entity.ts
│       │   ├── interfaces/
│       │   │   ├── message.repository.interface.ts
│       │   │   ├── thread.repository.interface.ts
│       │   │   └── search.service.interface.ts
│       │   └── value-objects/
│       │       ├── message-content.vo.ts
│       │       └── message-metadata.vo.ts
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── create-message.use-case.ts
│       │   │   ├── edit-message.use-case.ts
│       │   │   ├── delete-message.use-case.ts
│       │   │   ├── add-reaction.use-case.ts
│       │   │   ├── create-thread.use-case.ts
│       │   │   ├── mention-user.use-case.ts
│       │   │   └── search-messages.use-case.ts
│       │   ├── services/
│       │   │   ├── message.service.ts
│       │   │   ├── thread.service.ts
│       │   │   ├── reaction.service.ts
│       │   │   └── mention.service.ts
│       │   └── dtos/
│       │       ├── create-message.dto.ts
│       │       ├── edit-message.dto.ts
│       │       ├── add-reaction.dto.ts
│       │       └── search-messages.dto.ts
│       └── infrastructure/
│           ├── repositories/
│           │   ├── message.repository.ts
│           │   ├── thread.repository.ts
│           │   └── mongoose/
│           │       ├── message.schema.ts
│           │       ├── thread.schema.ts
│           │       ├── reaction.schema.ts
│           │       └── mention.schema.ts
│           ├── services/
│           │   ├── elasticsearch.service.ts
│           │   └── full-text-search.service.ts
│           └── controllers/
│               ├── message.controller.ts
│               ├── thread.controller.ts
│               └── search.controller.ts
```

## Paso 1: Entidades del Dominio

### 1.1 Message Entity

```typescript
// src/modules/messaging/domain/entities/message.entity.ts
import { ObjectId } from 'mongoose';
import { MessageContent } from '../value-objects/message-content.vo';
import { MessageMetadata } from '../value-objects/message-metadata.vo';

export class Message {
  constructor(
    public readonly id: ObjectId,
    public content: MessageContent,
    public readonly authorId: ObjectId,
    public readonly channelId: ObjectId,
    public readonly threadId?: ObjectId,
    public readonly parentMessageId?: ObjectId,
    public metadata: MessageMetadata = new MessageMetadata(),
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public deletedAt?: Date,
  ) {}

  edit(newContent: MessageContent): void {
    this.content = newContent;
    this.updatedAt = new Date();
    this.metadata.addEdit();
  }

  delete(): void {
    this.deletedAt = new Date();
  }

  isDeleted(): boolean {
    return !!this.deletedAt;
  }

  isEdited(): boolean {
    return this.metadata.editCount > 0;
  }

  canBeEditedBy(userId: ObjectId): boolean {
    return this.authorId.equals(userId) && !this.isDeleted();
  }

  canBeDeletedBy(userId: ObjectId, isAdmin = false): boolean {
    return (this.authorId.equals(userId) || isAdmin) && !this.isDeleted();
  }
}
```

### 1.2 Thread Entity

```typescript
// src/modules/messaging/domain/entities/thread.entity.ts
import { ObjectId } from 'mongoose';

export class Thread {
  constructor(
    public readonly id: ObjectId,
    public readonly originalMessageId: ObjectId,
    public readonly channelId: ObjectId,
    public readonly createdById: ObjectId,
    public title: string,
    public messageCount: number = 0,
    public readonly participants: ObjectId[] = [],
    public lastMessageAt: Date = new Date(),
    public readonly createdAt: Date = new Date(),
    public isArchived: boolean = false,
  ) {}

  addMessage(): void {
    this.messageCount++;
    this.lastMessageAt = new Date();
  }

  addParticipant(userId: ObjectId): void {
    if (!this.participants.some(p => p.equals(userId))) {
      this.participants.push(userId);
    }
  }

  archive(): void {
    this.isArchived = true;
  }

  unarchive(): void {
    this.isArchived = false;
  }
}
```

### 1.3 Reaction Entity

```typescript
// src/modules/messaging/domain/entities/reaction.entity.ts
import { ObjectId } from 'mongoose';

export class Reaction {
  constructor(
    public readonly id: ObjectId,
    public readonly messageId: ObjectId,
    public readonly userId: ObjectId,
    public readonly emoji: string,
    public readonly createdAt: Date = new Date(),
  ) {}

  static create(messageId: ObjectId, userId: ObjectId, emoji: string): Reaction {
    return new Reaction(
      new ObjectId(),
      messageId,
      userId,
      emoji,
    );
  }
}
```

### 1.4 Mention Entity

```typescript
// src/modules/messaging/domain/entities/mention.entity.ts
import { ObjectId } from 'mongoose';

export class Mention {
  constructor(
    public readonly id: ObjectId,
    public readonly messageId: ObjectId,
    public readonly mentionedUserId: ObjectId,
    public readonly mentionedByUserId: ObjectId,
    public readonly mentionType: 'user' | 'channel' | 'everyone',
    public isRead: boolean = false,
    public readonly createdAt: Date = new Date(),
  ) {}

  markAsRead(): void {
    this.isRead = true;
  }

  static createUserMention(
    messageId: ObjectId,
    mentionedUserId: ObjectId,
    mentionedByUserId: ObjectId,
  ): Mention {
    return new Mention(
      new ObjectId(),
      messageId,
      mentionedUserId,
      mentionedByUserId,
      'user',
    );
  }
}
```

## Paso 2: Value Objects

### 2.1 Message Content Value Object

```typescript
// src/modules/messaging/domain/value-objects/message-content.vo.ts
export class MessageContent {
  constructor(
    public readonly text: string,
    public readonly attachments: string[] = [],
    public readonly mentions: string[] = [],
    public readonly links: string[] = [],
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.text && this.attachments.length === 0) {
      throw new Error('Message must have text or attachments');
    }

    if (this.text && this.text.length > 4000) {
      throw new Error('Message text cannot exceed 4000 characters');
    }
  }

  extractMentions(): string[] {
    const mentionRegex = /@(\w+)/g;
    const matches = this.text.match(mentionRegex);
    return matches ? matches.map(match => match.slice(1)) : [];
  }

  extractLinks(): string[] {
    const linkRegex = /https?:\/\/[^\s]+/g;
    return this.text.match(linkRegex) || [];
  }

  getPlainText(): string {
    return this.text
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/https?:\/\/[^\s]+/g, '') // Remove links
      .trim();
  }
}
```

### 2.2 Message Metadata Value Object

```typescript
// src/modules/messaging/domain/value-objects/message-metadata.vo.ts
export class MessageMetadata {
  constructor(
    public editCount: number = 0,
    public lastEditAt?: Date,
    public isPinned: boolean = false,
    public pinnedAt?: Date,
    public pinnedBy?: string,
    public reactions: Map<string, string[]> = new Map(),
  ) {}

  addEdit(): void {
    this.editCount++;
    this.lastEditAt = new Date();
  }

  pin(userId: string): void {
    this.isPinned = true;
    this.pinnedAt = new Date();
    this.pinnedBy = userId;
  }

  unpin(): void {
    this.isPinned = false;
    this.pinnedAt = undefined;
    this.pinnedBy = undefined;
  }

  addReaction(emoji: string, userId: string): void {
    const users = this.reactions.get(emoji) || [];
    if (!users.includes(userId)) {
      users.push(userId);
      this.reactions.set(emoji, users);
    }
  }

  removeReaction(emoji: string, userId: string): void {
    const users = this.reactions.get(emoji) || [];
    const filteredUsers = users.filter(id => id !== userId);
    
    if (filteredUsers.length === 0) {
      this.reactions.delete(emoji);
    } else {
      this.reactions.set(emoji, filteredUsers);
    }
  }

  getReactionCount(emoji: string): number {
    return this.reactions.get(emoji)?.length || 0;
  }

  getTotalReactions(): number {
    return Array.from(this.reactions.values())
      .reduce((total, users) => total + users.length, 0);
  }
}
```

## Paso 3: Repository Interfaces

### 3.1 Message Repository Interface

```typescript
// src/modules/messaging/domain/interfaces/message.repository.interface.ts
import { ObjectId } from 'mongoose';
import { Message } from '../entities/message.entity';

export interface IMessageRepository {
  create(message: Message): Promise<Message>;
  findById(id: ObjectId): Promise<Message | null>;
  findByChannelId(channelId: ObjectId, limit?: number, offset?: number): Promise<Message[]>;
  findByThreadId(threadId: ObjectId, limit?: number, offset?: number): Promise<Message[]>;
  update(message: Message): Promise<Message>;
  delete(id: ObjectId): Promise<void>;
  softDelete(id: ObjectId): Promise<void>;
  findByDateRange(channelId: ObjectId, startDate: Date, endDate: Date): Promise<Message[]>;
  findWithMentions(userId: ObjectId, isRead?: boolean): Promise<Message[]>;
  countByChannelId(channelId: ObjectId): Promise<number>;
  findPinned(channelId: ObjectId): Promise<Message[]>;
}
```

### 3.2 Thread Repository Interface

```typescript
// src/modules/messaging/domain/interfaces/thread.repository.interface.ts
import { ObjectId } from 'mongoose';
import { Thread } from '../entities/thread.entity';

export interface IThreadRepository {
  create(thread: Thread): Promise<Thread>;
  findById(id: ObjectId): Promise<Thread | null>;
  findByChannelId(channelId: ObjectId): Promise<Thread[]>;
  findByOriginalMessageId(messageId: ObjectId): Promise<Thread | null>;
  update(thread: Thread): Promise<Thread>;
  delete(id: ObjectId): Promise<void>;
  findByParticipant(userId: ObjectId): Promise<Thread[]>;
  findActive(channelId: ObjectId): Promise<Thread[]>;
  findArchived(channelId: ObjectId): Promise<Thread[]>;
}
```

### 3.3 Search Service Interface

```typescript
// src/modules/messaging/domain/interfaces/search.service.interface.ts
import { ObjectId } from 'mongoose';
import { Message } from '../entities/message.entity';

export interface SearchFilters {
  channelId?: ObjectId;
  authorId?: ObjectId;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachments?: boolean;
  mentions?: string[];
}

export interface SearchResult {
  messages: Message[];
  total: number;
  hasMore: boolean;
}

export interface ISearchService {
  indexMessage(message: Message): Promise<void>;
  removeFromIndex(messageId: ObjectId): Promise<void>;
  updateIndex(message: Message): Promise<void>;
  search(
    query: string,
    filters?: SearchFilters,
    limit?: number,
    offset?: number
  ): Promise<SearchResult>;
  searchByHashtag(hashtag: string, channelId?: ObjectId): Promise<Message[]>;
  findSimilarMessages(messageId: ObjectId, limit?: number): Promise<Message[]>;
}
```

## Paso 4: Casos de Uso (Use Cases)

### 4.1 Create Message Use Case

```typescript
// src/modules/messaging/application/use-cases/create-message.use-case.ts
import { Injectable } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { Message } from '../../domain/entities/message.entity';
import { MessageContent } from '../../domain/value-objects/message-content.vo';
import { IMessageRepository } from '../../domain/interfaces/message.repository.interface';
import { ISearchService } from '../../domain/interfaces/search.service.interface';
import { CreateMessageDto } from '../dtos/create-message.dto';

@Injectable()
export class CreateMessageUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly searchService: ISearchService,
  ) {}

  async execute(dto: CreateMessageDto, authorId: ObjectId): Promise<Message> {
    const content = new MessageContent(
      dto.text,
      dto.attachments,
      dto.mentions,
      dto.links,
    );

    const message = new Message(
      new ObjectId(),
      content,
      authorId,
      new ObjectId(dto.channelId),
      dto.threadId ? new ObjectId(dto.threadId) : undefined,
      dto.parentMessageId ? new ObjectId(dto.parentMessageId) : undefined,
    );

    const savedMessage = await this.messageRepository.create(message);
    
    // Index for search
    await this.searchService.indexMessage(savedMessage);

    return savedMessage;
  }
}
```

### 4.2 Edit Message Use Case

```typescript
// src/modules/messaging/application/use-cases/edit-message.use-case.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { MessageContent } from '../../domain/value-objects/message-content.vo';
import { IMessageRepository } from '../../domain/interfaces/message.repository.interface';
import { ISearchService } from '../../domain/interfaces/search.service.interface';
import { EditMessageDto } from '../dtos/edit-message.dto';

@Injectable()
export class EditMessageUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
    private readonly searchService: ISearchService,
  ) {}

  async execute(messageId: ObjectId, dto: EditMessageDto, userId: ObjectId): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!message.canBeEditedBy(userId)) {
      throw new ForbiddenException('Cannot edit this message');
    }

    const newContent = new MessageContent(
      dto.text,
      dto.attachments,
      dto.mentions,
      dto.links,
    );

    message.edit(newContent);
    
    await this.messageRepository.update(message);
    await this.searchService.updateIndex(message);
  }
}
```

### 4.3 Add Reaction Use Case

```typescript
// src/modules/messaging/application/use-cases/add-reaction.use-case.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { IMessageRepository } from '../../domain/interfaces/message.repository.interface';
import { AddReactionDto } from '../dtos/add-reaction.dto';

@Injectable()
export class AddReactionUseCase {
  constructor(
    private readonly messageRepository: IMessageRepository,
  ) {}

  async execute(messageId: ObjectId, dto: AddReactionDto, userId: ObjectId): Promise<void> {
    const message = await this.messageRepository.findById(messageId);
    
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.isDeleted()) {
      throw new BadRequestException('Cannot react to deleted message');
    }

    // Validate emoji
    if (!this.isValidEmoji(dto.emoji)) {
      throw new BadRequestException('Invalid emoji');
    }

    message.metadata.addReaction(dto.emoji, userId.toString());
    await this.messageRepository.update(message);
  }

  private isValidEmoji(emoji: string): boolean {
    // Basic emoji validation - can be enhanced
    const emojiRegex = /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u;
    return emojiRegex.test(emoji) || emoji.length <= 4; // Allow custom emoji names
  }
}
```

### 4.4 Search Messages Use Case

```typescript
// src/modules/messaging/application/use-cases/search-messages.use-case.ts
import { Injectable } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { ISearchService, SearchFilters, SearchResult } from '../../domain/interfaces/search.service.interface';
import { SearchMessagesDto } from '../dtos/search-messages.dto';

@Injectable()
export class SearchMessagesUseCase {
  constructor(
    private readonly searchService: ISearchService,
  ) {}

  async execute(dto: SearchMessagesDto): Promise<SearchResult> {
    const filters: SearchFilters = {
      channelId: dto.channelId ? new ObjectId(dto.channelId) : undefined,
      authorId: dto.authorId ? new ObjectId(dto.authorId) : undefined,
      dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
      dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
      hasAttachments: dto.hasAttachments,
      mentions: dto.mentions,
    };

    return await this.searchService.search(
      dto.query,
      filters,
      dto.limit || 20,
      dto.offset || 0,
    );
  }
}
```

## Paso 5: DTOs

### 5.1 Create Message DTO

```typescript
// src/modules/messaging/application/dtos/create-message.dto.ts
import { IsString, IsOptional, IsArray, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Message text content',
    example: 'Hello everyone! @john check this out',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @ApiProperty({
    description: 'Channel ID where the message will be sent',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  channelId: string;

  @ApiPropertyOptional({
    description: 'Thread ID if this is a reply in a thread',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({
    description: 'Parent message ID if this is a direct reply',
    example: '507f1f77bcf86cd799439013',
  })
  @IsOptional()
  @IsString()
  parentMessageId?: string;

  @ApiPropertyOptional({
    description: 'Array of attachment URLs',
    example: ['https://example.com/file1.jpg', 'https://example.com/file2.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Array of mentioned usernames',
    example: ['john', 'jane'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Array of links found in the message',
    example: ['https://example.com', 'https://github.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];
}
```

### 5.2 Edit Message DTO

```typescript
// src/modules/messaging/application/dtos/edit-message.dto.ts
import { IsString, IsOptional, IsArray, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({
    description: 'Updated message text content',
    example: 'Hello everyone! @john check this updated message',
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @ApiPropertyOptional({
    description: 'Updated array of attachment URLs',
    example: ['https://example.com/file1.jpg', 'https://example.com/file3.pdf'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: 'Updated array of mentioned usernames',
    example: ['john', 'jane', 'bob'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Updated array of links found in the message',
    example: ['https://example.com', 'https://github.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];
}
```

### 5.3 Add Reaction DTO

```typescript
// src/modules/messaging/application/dtos/add-reaction.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddReactionDto {
  @ApiProperty({
    description: 'Emoji or reaction identifier',
    example: '👍',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  emoji: string;
}
```

### 5.4 Search Messages DTO

```typescript
// src/modules/messaging/application/dtos/search-messages.dto.ts
import { IsString, IsOptional, IsArray, IsBoolean, IsDateString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchMessagesDto {
  @ApiProperty({
    description: 'Search query text',
    example: 'project update',
  })
  @IsString()
  @IsNotEmpty()
  query: string;

  @ApiPropertyOptional({
    description: 'Channel ID to search within',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  channelId?: string;

  @ApiPropertyOptional({
    description: 'Author ID to filter by',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({
    description: 'Start date for search range',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End date for search range',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter messages with attachments',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  hasAttachments?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by mentioned users',
    example: ['john', 'jane'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentions?: string[];

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of results to skip',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
```

## Paso 6: Validación y Testing

### 6.1 Message Entity Test

```typescript
// src/modules/messaging/domain/entities/__tests__/message.entity.spec.ts
import { ObjectId } from 'mongoose';
import { Message } from '../message.entity';
import { MessageContent } from '../../value-objects/message-content.vo';

describe('Message Entity', () => {
  let message: Message;
  const messageId = new ObjectId();
  const authorId = new ObjectId();
  const channelId = new ObjectId();

  beforeEach(() => {
    const content = new MessageContent('Test message', [], [], []);
    message = new Message(
      messageId,
      content,
      authorId,
      channelId,
    );
  });

  describe('edit', () => {
    it('should update content and timestamp', () => {
      const originalUpdatedAt = message.updatedAt;
      const newContent = new MessageContent('Updated message', [], [], []);
      
      message.edit(newContent);
      
      expect(message.content.text).toBe('Updated message');
      expect(message.updatedAt).not.toEqual(originalUpdatedAt);
      expect(message.isEdited()).toBe(true);
    });
  });

  describe('delete', () => {
    it('should mark message as deleted', () => {
      message.delete();
      
      expect(message.isDeleted()).toBe(true);
      expect(message.deletedAt).toBeDefined();
    });
  });

  describe('canBeEditedBy', () => {
    it('should allow author to edit', () => {
      expect(message.canBeEditedBy(authorId)).toBe(true);
    });

    it('should not allow other users to edit', () => {
      const otherUserId = new ObjectId();
      expect(message.canBeEditedBy(otherUserId)).toBe(false);
    });

    it('should not allow editing deleted messages', () => {
      message.delete();
      expect(message.canBeEditedBy(authorId)).toBe(false);
    });
  });

  describe('canBeDeletedBy', () => {
    it('should allow author to delete', () => {
      expect(message.canBeDeletedBy(authorId)).toBe(true);
    });

    it('should allow admin to delete', () => {
      const otherUserId = new ObjectId();
      expect(message.canBeDeletedBy(otherUserId, true)).toBe(true);
    });

    it('should not allow non-admin other users to delete', () => {
      const otherUserId = new ObjectId();
      expect(message.canBeDeletedBy(otherUserId, false)).toBe(false);
    });
  });
});
```

## Resultado Esperado

Al completar este paso tendrás:

✅ **Arquitectura Hexagonal Implementada**
- Separación clara entre dominio, aplicación e infraestructura
- Entidades del dominio con lógica de negocio encapsulada
- Value objects para contenido y metadata de mensajes

✅ **Sistema de Mensajería Completo**
- CRUD operations para mensajes con validaciones
- Sistema de hilos de conversación
- Reacciones con emoji y contadores
- Menciones de usuarios con notificaciones

✅ **Casos de Uso Bien Definidos**
- Creación, edición y eliminación de mensajes
- Gestión de reacciones y menciones
- Búsqueda full-text avanzada con filtros

✅ **Validación y Seguridad**
- DTOs con validación completa
- Autorización para edición y eliminación
- Sanitización de contenido
- Tests unitarios para entidades principales

✅ **Preparación para Real-Time**
- Estructura preparada para integración con WebSocket
- Metadata para sincronización de estado
- Eventos de dominio listos para broadcasting

## Próximo Paso

Continuar con [Step 4.2: Sistema WebSocket Empresarial Integrado con Mensajería](./step-4.2-websocket-integration.md) para implementar la sincronización en tiempo real.
