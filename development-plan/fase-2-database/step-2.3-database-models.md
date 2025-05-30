# 2.3 Modelos de Base de Datos

## Explicación

En este paso definiremos las entidades principales del dominio, DTOs de validación y la estructura de datos que permitirá escalabilidad futura. Implementaremos un diseño hexagonal con separación clara entre dominio, infraestructura y aplicación.

## Objetivos

- Definir entidades principales: User, Message, Room, Attachment
- Crear DTOs con validaciones robustas
- Implementar repositorios siguiendo principios DDD
- Establecer estructura escalable para funcionalidades avanzadas
- Configurar índices de base de datos para performance

## Estructura de Archivos

`
api/src/
├── domain/
│   ├── entities/
│   │   ├── user.entity.ts              # Entidad User con validaciones
│   │   ├── room.entity.ts              # Entidad Room con configuración
│   │   ├── message.entity.ts           # Entidad Message con referencias
│   │   └── attachment.entity.ts        # Entidad Attachment con metadata
│   ├── enums/
│   │   ├── user-status.enum.ts         # Estados de usuario
│   │   ├── room-type.enum.ts           # Tipos de sala
│   │   ├── message-type.enum.ts        # Tipos de mensaje
│   │   └── attachment-type.enum.ts     # Tipos de archivo
│   └── interfaces/
│       ├── user.interface.ts           # Interface desacoplada User
│       ├── room.interface.ts           # Interface desacoplada Room
│       ├── message.interface.ts        # Interface desacoplada Message
│       └── attachment.interface.ts     # Interface desacoplada Attachment
├── application/
│   └── dto/
│       ├── user/
│       │   ├── create-user.dto.ts      # DTO crear usuario
│       │   ├── update-user.dto.ts      # DTO actualizar usuario
│       │   └── user-response.dto.ts    # DTO respuesta usuario
│       ├── room/
│       │   ├── create-room.dto.ts      # DTO crear sala
│       │   ├── update-room.dto.ts      # DTO actualizar sala
│       │   ├── join-room.dto.ts        # DTO unirse a sala
│       │   └── room-response.dto.ts    # DTO respuesta sala
│       ├── message/
│       │   ├── create-message.dto.ts   # DTO crear mensaje
│       │   ├── update-message.dto.ts   # DTO actualizar mensaje
│       │   └── message-response.dto.ts # DTO respuesta mensaje
│       └── attachment/
│           ├── upload-attachment.dto.ts # DTO subir archivo
│           └── attachment-response.dto.ts # DTO respuesta archivo
└── infrastructure/
    └── repositories/
        ├── user.repository.ts          # Repositorio User
        ├── room.repository.ts          # Repositorio Room
        ├── message.repository.ts       # Repositorio Message
        └── attachment.repository.ts    # Repositorio Attachment
`

## Enums y Tipos Base

### domain/enums/user-status.enum.ts

```typescript
export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
  INVISIBLE = 'invisible'
}
```

### domain/enums/room-type.enum.ts

```typescript
export enum RoomType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  DIRECT = 'direct',
  GROUP = 'group',
  ANNOUNCEMENT = 'announcement'
}
```

### domain/enums/message-type.enum.ts

```typescript
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  SYSTEM = 'system',
  ANNOUNCEMENT = 'announcement'
}
```

### domain/enums/attachment-type.enum.ts

```typescript
export enum AttachmentType {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  OTHER = 'other'
}
```

## Interfaces de Dominio

### domain/interfaces/user.interface.ts

```typescript
import { UserStatus } from '../enums/user-status.enum';

export interface IUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  status: UserStatus;
  lastSeen: Date;
  isOnline: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Métodos de dominio
  setStatus(status: UserStatus): void;
  updateLastSeen(): void;
  canJoinRoom(roomId: string): boolean;
}
```

### domain/interfaces/room.interface.ts

```typescript
import { RoomType } from '../enums/room-type.enum';

export interface IRoom {
  id: string;
  name: string;
  description?: string;
  type: RoomType;
  isPrivate: boolean;
  maxUsers?: number;
  createdBy: string;
  participants: string[];
  administrators: string[];
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  
  // Métodos de dominio
  addParticipant(userId: string): void;
  removeParticipant(userId: string): void;
  isUserParticipant(userId: string): boolean;
  isUserAdmin(userId: string): boolean;
}
```

### domain/interfaces/message.interface.ts

```typescript
import { MessageType } from '../enums/message-type.enum';

export interface IMessage {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  roomId: string;
  parentMessageId?: string; // Para respuestas
  attachments: string[];
  reactions: Record<string, string[]>; // emoji -> userIds
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Métodos de dominio
  addReaction(emoji: string, userId: string): void;
  removeReaction(emoji: string, userId: string): void;
  markAsEdited(): void;
  markAsDeleted(): void;
}
```

### domain/interfaces/attachment.interface.ts

```typescript
import { AttachmentType } from '../enums/attachment-type.enum';

export interface IAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  type: AttachmentType;
  url: string;
  uploadedBy: string;
  messageId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  
  // Métodos de dominio
  getPublicUrl(): string;
  isImage(): boolean;
  isVideo(): boolean;
  isDocument(): boolean;
}
```

## Entidades MongoDB

### domain/entities/user.entity.ts

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from '../enums/user-status.enum';
import { IUser } from '../interfaces/user.interface';

@Schema({
  timestamps: true,
  collection: 'users'
})
export class User extends Document implements IUser {
  @Prop({ required: true, unique: true, minlength: 3, maxlength: 20 })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true, minlength: 6 })
  password: string;

  @Prop({ required: true, minlength: 2, maxlength: 50 })
  displayName: string;

  @Prop()
  avatar?: string;

  @Prop({ 
    type: String, 
    enum: Object.values(UserStatus), 
    default: UserStatus.OFFLINE 
  })
  status: UserStatus;

  @Prop({ default: Date.now })
  lastSeen: Date;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ type: [String], default: [] })
  joinedRooms: string[];

  @Prop({ type: Object, default: {} })
  preferences: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;

  // Métodos de dominio
  setStatus(status: UserStatus): void {
    this.status = status;
    this.updateLastSeen();
  }

  updateLastSeen(): void {
    this.lastSeen = new Date();
  }

  canJoinRoom(roomId: string): boolean {
    return this.isActive && !this.joinedRooms.includes(roomId);
  }
}

export const UserSchema = SchemaFactory.createForClass(User);

// Índices para optimización
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ lastSeen: -1 });
UserSchema.index({ isOnline: 1 });
```

### domain/entities/room.entity.ts

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RoomType } from '../enums/room-type.enum';
import { IRoom } from '../interfaces/room.interface';

@Schema({
  timestamps: true,
  collection: 'rooms'
})
export class Room extends Document implements IRoom {
  @Prop({ required: true, minlength: 2, maxlength: 50 })
  name: string;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ 
    type: String, 
    enum: Object.values(RoomType), 
    default: RoomType.PUBLIC 
  })
  type: RoomType;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ min: 2, max: 1000 })
  maxUsers?: number;

  @Prop({ required: true })
  createdBy: string;

  @Prop({ type: [String], default: [] })
  participants: string[];

  @Prop({ type: [String], default: [] })
  administrators: string[];

  @Prop({ type: [String], default: [] })
  bannedUsers: string[];

  @Prop({ default: Date.now })
  lastActivity: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Object, default: {} })
  settings: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;

  // Métodos de dominio
  addParticipant(userId: string): void {
    if (!this.participants.includes(userId) && !this.bannedUsers.includes(userId)) {
      this.participants.push(userId);
      this.lastActivity = new Date();
    }
  }

  removeParticipant(userId: string): void {
    this.participants = this.participants.filter(id => id !== userId);
    this.lastActivity = new Date();
  }

  isUserParticipant(userId: string): boolean {
    return this.participants.includes(userId);
  }

  isUserAdmin(userId: string): boolean {
    return this.administrators.includes(userId) || this.createdBy === userId;
  }
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Índices para optimización
RoomSchema.index({ name: 1 });
RoomSchema.index({ type: 1 });
RoomSchema.index({ isPrivate: 1 });
RoomSchema.index({ participants: 1 });
RoomSchema.index({ createdBy: 1 });
RoomSchema.index({ lastActivity: -1 });
RoomSchema.index({ isActive: 1 });
```

### domain/entities/message.entity.ts

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { MessageType } from '../enums/message-type.enum';
import { IMessage } from '../interfaces/message.interface';

@Schema({
  timestamps: true,
  collection: 'messages'
})
export class Message extends Document implements IMessage {
  @Prop({ required: true })
  content: string;

  @Prop({ 
    type: String, 
    enum: Object.values(MessageType), 
    default: MessageType.TEXT 
  })
  type: MessageType;

  @Prop({ required: true })
  senderId: string;

  @Prop({ required: true })
  roomId: string;

  @Prop()
  parentMessageId?: string;

  @Prop({ type: [String], default: [] })
  attachments: string[];

  @Prop({ type: Object, default: {} })
  reactions: Record<string, string[]>;

  @Prop({ default: false })
  isEdited: boolean;

  @Prop()
  editedAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: [String], default: [] })
  readBy: string[];

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;

  // Métodos de dominio
  addReaction(emoji: string, userId: string): void {
    if (!this.reactions[emoji]) {
      this.reactions[emoji] = [];
    }
    if (!this.reactions[emoji].includes(userId)) {
      this.reactions[emoji].push(userId);
    }
  }

  removeReaction(emoji: string, userId: string): void {
    if (this.reactions[emoji]) {
      this.reactions[emoji] = this.reactions[emoji].filter(id => id !== userId);
      if (this.reactions[emoji].length === 0) {
        delete this.reactions[emoji];
      }
    }
  }

  markAsEdited(): void {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  markAsDeleted(): void {
    this.isDeleted = true;
    this.deletedAt = new Date();
  }
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Índices para optimización
MessageSchema.index({ roomId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
MessageSchema.index({ type: 1 });
MessageSchema.index({ parentMessageId: 1 });
MessageSchema.index({ isDeleted: 1 });
MessageSchema.index({ createdAt: -1 });
```

### domain/entities/attachment.entity.ts

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { AttachmentType } from '../enums/attachment-type.enum';
import { IAttachment } from '../interfaces/attachment.interface';

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'attachments'
})
export class Attachment extends Document implements IAttachment {
  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true, min: 0 })
  size: number;

  @Prop({ 
    type: String, 
    enum: Object.values(AttachmentType), 
    required: true 
  })
  type: AttachmentType;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  uploadedBy: string;

  @Prop()
  messageId?: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;

  // Métodos de dominio
  getPublicUrl(): string {
    return `${process.env.API_BASE_URL || 'http://localhost:3001'}/uploads/${this.filename}`;
  }

  isImage(): boolean {
    return this.type === AttachmentType.IMAGE;
  }

  isVideo(): boolean {
    return this.type === AttachmentType.VIDEO;
  }

  isDocument(): boolean {
    return this.type === AttachmentType.DOCUMENT;
  }
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

// Índices para optimización
AttachmentSchema.index({ uploadedBy: 1 });
AttachmentSchema.index({ messageId: 1 });
AttachmentSchema.index({ type: 1 });
AttachmentSchema.index({ createdAt: -1 });
AttachmentSchema.index({ isActive: 1 });
```

## DTOs de Validación

### application/dto/user/create-user.dto.ts

```typescript
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '../../../domain/enums/user-status.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: 'Username debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'Username no puede exceder 20 caracteres' })
  @Transform(({ value }) => value.toLowerCase().trim())
  username: string;

  @IsEmail({}, { message: 'Email debe tener un formato válido' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password debe tener al menos 6 caracteres' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'Nombre no puede exceder 50 caracteres' })
  displayName: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus = UserStatus.OFFLINE;
}
```

### application/dto/user/update-user.dto.ts

```typescript
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserStatus } from '../../../domain/enums/user-status.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'Nombre no puede exceder 50 caracteres' })
  displayName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  preferences?: Record<string, any>;
}
```

### application/dto/user/user-response.dto.ts

```typescript
import { Exclude, Expose } from 'class-transformer';
import { UserStatus } from '../../../domain/enums/user-status.enum';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  username: string;

  @Expose()
  email: string;

  @Expose()
  displayName: string;

  @Expose()
  avatar?: string;

  @Expose()
  status: UserStatus;

  @Expose()
  lastSeen: Date;

  @Expose()
  isOnline: boolean;

  @Expose()
  createdAt: Date;

  @Exclude()
  password: string;

  @Exclude()
  joinedRooms: string[];

  @Exclude()
  preferences: Record<string, any>;
}
```

### application/dto/room/create-room.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';
import { RoomType } from '../../../domain/enums/room-type.enum';

export class CreateRoomDto {
  @IsString()
  @MinLength(2, { message: 'Nombre de sala debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'Nombre de sala no puede exceder 50 caracteres' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Descripción no puede exceder 500 caracteres' })
  description?: string;

  @IsOptional()
  @IsEnum(RoomType)
  type?: RoomType = RoomType.PUBLIC;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(2, { message: 'Una sala debe permitir al menos 2 usuarios' })
  @Max(1000, { message: 'Una sala no puede exceder 1000 usuarios' })
  maxUsers?: number;

  @IsOptional()
  settings?: Record<string, any>;
}
```

### application/dto/message/create-message.dto.ts

```typescript
import { IsString, IsOptional, IsEnum, IsArray, MinLength, MaxLength } from 'class-validator';
import { MessageType } from '../../../domain/enums/message-type.enum';

export class CreateMessageDto {
  @IsString()
  @MinLength(1, { message: 'El mensaje no puede estar vacío' })
  @MaxLength(4000, { message: 'El mensaje no puede exceder 4000 caracteres' })
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;

  @IsString()
  roomId: string;

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

## Repositorios

### infrastructure/repositories/user.repository.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../domain/entities/user.entity';
import { CreateUserDto } from '../../application/dto/user/create-user.dto';
import { UpdateUserDto } from '../../application/dto/user/update-user.dto';
import { UserStatus } from '../../domain/enums/user-status.enum';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username: username.toLowerCase() }).exec();
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).exec();
  }

  async updateStatus(id: string, status: UserStatus): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      id, 
      { 
        status, 
        lastSeen: new Date(),
        isOnline: status !== UserStatus.OFFLINE 
      }, 
      { new: true }
    ).exec();
  }

  async findOnlineUsers(): Promise<User[]> {
    return this.userModel.find({ isOnline: true }).exec();
  }

  async findByRoomId(roomId: string): Promise<User[]> {
    return this.userModel.find({ joinedRooms: roomId }).exec();
  }

  async joinRoom(userId: string, roomId: string): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { joinedRooms: roomId } },
      { new: true }
    ).exec();
  }

  async leaveRoom(userId: string, roomId: string): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $pull: { joinedRooms: roomId } },
      { new: true }
    ).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.userModel.findByIdAndUpdate(
      id, 
      { isActive: false }, 
      { new: true }
    ).exec();
    return !!result;
  }
}
```

### infrastructure/repositories/room.repository.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room } from '../../domain/entities/room.entity';
import { CreateRoomDto } from '../../application/dto/room/create-room.dto';
import { RoomType } from '../../domain/enums/room-type.enum';

@Injectable()
export class RoomRepository {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<Room>
  ) {}

  async create(createRoomDto: CreateRoomDto, createdBy: string): Promise<Room> {
    const room = new this.roomModel({
      ...createRoomDto,
      createdBy,
      participants: [createdBy],
      administrators: [createdBy]
    });
    return room.save();
  }

  async findById(id: string): Promise<Room | null> {
    return this.roomModel.findById(id).exec();
  }

  async findByUser(userId: string): Promise<Room[]> {
    return this.roomModel.find({ 
      participants: userId,
      isActive: true 
    }).sort({ lastActivity: -1 }).exec();
  }

  async findPublicRooms(): Promise<Room[]> {
    return this.roomModel.find({ 
      type: RoomType.PUBLIC,
      isPrivate: false,
      isActive: true 
    }).sort({ lastActivity: -1 }).exec();
  }

  async addParticipant(roomId: string, userId: string): Promise<Room | null> {
    return this.roomModel.findByIdAndUpdate(
      roomId,
      { 
        $addToSet: { participants: userId },
        lastActivity: new Date()
      },
      { new: true }
    ).exec();
  }

  async removeParticipant(roomId: string, userId: string): Promise<Room | null> {
    return this.roomModel.findByIdAndUpdate(
      roomId,
      { 
        $pull: { participants: userId },
        lastActivity: new Date()
      },
      { new: true }
    ).exec();
  }

  async updateLastActivity(roomId: string): Promise<Room | null> {
    return this.roomModel.findByIdAndUpdate(
      roomId,
      { lastActivity: new Date() },
      { new: true }
    ).exec();
  }

  async findByType(type: RoomType): Promise<Room[]> {
    return this.roomModel.find({ type, isActive: true }).exec();
  }

  async search(query: string): Promise<Room[]> {
    return this.roomModel.find({
      isActive: true,
      isPrivate: false,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    }).limit(20).exec();
  }
}
```

### infrastructure/repositories/message.repository.ts

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message } from '../../domain/entities/message.entity';
import { CreateMessageDto } from '../../application/dto/message/create-message.dto';
import { MessageType } from '../../domain/enums/message-type.enum';

@Injectable()
export class MessageRepository {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<Message>
  ) {}

  async create(createMessageDto: CreateMessageDto, senderId: string): Promise<Message> {
    const message = new this.messageModel({
      ...createMessageDto,
      senderId
    });
    return message.save();
  }

  async findById(id: string): Promise<Message | null> {
    return this.messageModel.findById(id).exec();
  }

  async findByRoomId(roomId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    return this.messageModel
      .find({ roomId, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('senderId', 'username displayName avatar')
      .exec();
  }

  async findBySender(senderId: string): Promise<Message[]> {
    return this.messageModel
      .find({ senderId, isDeleted: false })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(id: string, content: string): Promise<Message | null> {
    return this.messageModel.findByIdAndUpdate(
      id,
      { 
        content,
        isEdited: true,
        editedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async addReaction(messageId: string, emoji: string, userId: string): Promise<Message | null> {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      { $addToSet: { [`reactions.${emoji}`]: userId } },
      { new: true }
    ).exec();
  }

  async removeReaction(messageId: string, emoji: string, userId: string): Promise<Message | null> {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      { $pull: { [`reactions.${emoji}`]: userId } },
      { new: true }
    ).exec();
  }

  async markAsRead(messageId: string, userId: string): Promise<Message | null> {
    return this.messageModel.findByIdAndUpdate(
      messageId,
      { $addToSet: { readBy: userId } },
      { new: true }
    ).exec();
  }

  async softDelete(id: string): Promise<Message | null> {
    return this.messageModel.findByIdAndUpdate(
      id,
      { 
        isDeleted: true,
        deletedAt: new Date()
      },
      { new: true }
    ).exec();
  }

  async search(roomId: string, query: string): Promise<Message[]> {
    return this.messageModel.find({
      roomId,
      isDeleted: false,
      content: { $regex: query, $options: 'i' }
    }).sort({ createdAt: -1 }).limit(20).exec();
  }

  async getMessageHistory(roomId: string, before: Date): Promise<Message[]> {
    return this.messageModel
      .find({ 
        roomId, 
        isDeleted: false,
        createdAt: { $lt: before }
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();
  }
}
```

## Configuración de Base de Datos

### database.module.ts

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../domain/entities/user.entity';
import { Room, RoomSchema } from '../domain/entities/room.entity';
import { Message, MessageSchema } from '../domain/entities/message.entity';
import { Attachment, AttachmentSchema } from '../domain/entities/attachment.entity';
import { UserRepository } from '../infrastructure/repositories/user.repository';
import { RoomRepository } from '../infrastructure/repositories/room.repository';
import { MessageRepository } from '../infrastructure/repositories/message.repository';
import { AttachmentRepository } from '../infrastructure/repositories/attachment.repository';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: true,
        w: 'majority',
        authSource: 'admin',
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Room.name, schema: RoomSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Attachment.name, schema: AttachmentSchema },
    ]),
  ],
  providers: [
    UserRepository,
    RoomRepository,
    MessageRepository,
    AttachmentRepository,
  ],
  exports: [
    MongooseModule,
    UserRepository,
    RoomRepository,
    MessageRepository,
    AttachmentRepository,
  ],
})
export class DatabaseModule {}
```

## Checklist de Validación

### ✅ Entidades de Dominio

- [ ] `User` entidad con validaciones y métodos de dominio
- [ ] `Room` entidad con lógica de participantes
- [ ] `Message` entidad con soporte para reacciones y respuestas
- [ ] `Attachment` entidad con metadata de archivos

### ✅ Enums y Tipos

- [ ] `UserStatus` enum definido
- [ ] `RoomType` enum definido
- [ ] `MessageType` enum definido
- [ ] `AttachmentType` enum definido

### ✅ Interfaces de Dominio

- [ ] Interfaces desacopladas de la implementación
- [ ] Métodos de dominio definidos
- [ ] Tipos TypeScript estrictos

### ✅ DTOs de Validación

- [ ] DTOs para crear entidades con validaciones
- [ ] DTOs para actualizar entidades
- [ ] DTOs de respuesta con exclusión de campos sensibles
- [ ] Transformaciones apropiadas

### ✅ Repositorios

- [ ] Métodos CRUD básicos implementados
- [ ] Queries optimizadas para casos de uso frecuentes
- [ ] Soporte para búsqueda y filtrado
- [ ] Paginación implementada

### ✅ Configuración de Base de Datos

- [ ] Índices definidos para optimización
- [ ] Configuración de conexión robusta
- [ ] Module configurado correctamente
- [ ] Conexión con variables de entorno

### ✅ Testing

- [ ] Entidades validan correctamente
- [ ] DTOs rechazan datos inválidos
- [ ] Repositorios realizan queries correctas
- [ ] Índices mejoran performance

## Comandos de Validación

### Instalar dependencias necesarias

```bash
npm install @nestjs/mongoose mongoose class-validator class-transformer
npm install -D @types/mongoose
```

### Verificar conexión a base de datos

```bash
# En el backend, verificar que la conexión funciona
npm run start:dev

# Verificar logs de conexión exitosa
```

### Probar creación de entidades

```bash
# Usar REST client o Postman para probar endpoints básicos
# POST /users (crear usuario)
# POST /rooms (crear sala)
# POST /messages (crear mensaje)
```

### Verificar índices en MongoDB

```bash
# Conectar a MongoDB y verificar índices
mongosh
use livechat
db.users.getIndexes()
db.rooms.getIndexes()
db.messages.getIndexes()
```

## Troubleshooting

### Error: Esquema no registrado

```bash
# Verificar que el module está importado correctamente
# Verificar que los nombres de esquemas coinciden
```

### Error: Validación fallida

```bash
# Verificar que class-validator está configurado en el pipe global
# Verificar que los DTOs tienen las importaciones correctas
```

### Performance: Queries lentas

```bash
# Verificar que los índices están creados
# Usar explain() en queries complejas para optimizar
```
