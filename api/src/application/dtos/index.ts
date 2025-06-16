// Application DTOs - Data Transfer Objects
// Auth DTOs
export * from './auth.dto';
export * from './message.dto';
export * from './search.dto';

// Existing DTOs
import {
  User,
  Room,
  Attachment,
  EntityId,
  MessageType,
  UserStatus,
  HexColor,
  Optional,
} from '../../domain/entities';
import { UploadedFile } from '../../domain/interfaces';

// User DTOs
export type CreateUserDto = {
  username: string;
  email: string;
  password: string;
  textColor?: HexColor;
  backgroundColor?: HexColor;
};

export type UpdateUserDto = Optional<
  Pick<
    User,
    | 'username'
    | 'email'
    | 'textColor'
    | 'backgroundColor'
    | 'avatar'
    | 'avatarUrl'
  >,
  | 'username'
  | 'email'
  | 'textColor'
  | 'backgroundColor'
  | 'avatar'
  | 'avatarUrl'
>;

export type UserResponseDto = Omit<User, 'password' | 'deletedAt' | 'metadata'>;

export type UserProfileDto = Pick<
  User,
  | 'id'
  | 'username'
  | 'avatar'
  | 'avatarUrl'
  | 'textColor'
  | 'backgroundColor'
  | 'status'
  | 'isOnline'
  | 'lastSeen'
>;

// Authentication DTOs
export type LoginDto = {
  email: string;
  password: string;
};

export type RegisterDto = CreateUserDto;

export type AuthResponseDto = {
  user: UserResponseDto;
  accessToken: string;
  refreshToken: string;
};

// Message DTOs
export type CreateMessageDto = {
  content: string;
  roomId: EntityId;
  messageType: MessageType;
  attachmentIds?: EntityId[];
  replyToId?: EntityId;
};

export type UpdateMessageDto = {
  content: string;
};

export type MessageResponseDto = {
  id: EntityId;
  content: string;
  userId: EntityId;
  roomId: EntityId;
  messageType: MessageType;
  attachments: AttachmentResponseDto[];
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  user: UserProfileDto;
  replyTo?: MessageResponseDto;
};

// Room DTOs
export type CreateRoomDto = {
  name: string;
  description?: string;
  isPrivate: boolean;
  maxUsers: number;
};

export type UpdateRoomDto = Optional<
  Pick<Room, 'name' | 'description' | 'maxUsers'>,
  'name' | 'description' | 'maxUsers'
>;

export type RoomResponseDto = Omit<Room, 'deletedAt'> & {
  memberCount: number;
  isUserMember: boolean;
};

// Attachment DTOs
export type CreateAttachmentDto = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  messageId?: EntityId;
};

export type AttachmentResponseDto = Omit<
  Attachment,
  'uploadedBy' | 'deletedAt'
>;

// Upload DTOs
export type FileUploadDto = {
  file: UploadedFile;
  messageId?: EntityId;
};

// Pagination DTOs
export type PaginationDto = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PaginatedResponseDto<T> = {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Search DTOs
export type SearchMessagesDto = {
  query: string;
  dateFrom?: string; // ISO date string
  dateTo?: string; // ISO date string
  userId?: EntityId;
  roomId?: EntityId;
} & PaginationDto;

// WebSocket DTOs
export type SocketAuthDto = {
  token: string;
};

export type SocketJoinRoomDto = {
  roomId: EntityId;
};

export type SocketMessageDto = CreateMessageDto;

export type SocketTypingDto = {
  roomId: EntityId;
  isTyping: boolean;
};

export type SocketUserStatusDto = {
  status: UserStatus;
};

// Response wrapper DTOs
export type ApiResponseDto<T = any> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
};

export type ErrorResponseDto = {
  success: false;
  message: string;
  errors: string[];
  statusCode: number;
  timestamp: string;
  path: string;
};

// Re-export validation DTOs
export * from './validation.dto';
