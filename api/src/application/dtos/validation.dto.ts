import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsArray,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  Matches,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MessageType, UserStatus } from '../../domain/entities';

// Color validation regex
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// User validation DTOs
export class CreateUserValidationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'Text color must be a valid hex color (e.g., #000000)',
  })
  textColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'Background color must be a valid hex color (e.g., #ffffff)',
  })
  backgroundColor?: string;
}

export class UpdateUserValidationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'Text color must be a valid hex color (e.g., #000000)',
  })
  textColor?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, {
    message: 'Background color must be a valid hex color (e.g., #ffffff)',
  })
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

// Authentication validation DTOs
export class LoginValidationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterValidationDto extends CreateUserValidationDto {}

// Message validation DTOs
export class CreateMessageValidationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content: string;

  @IsString()
  roomId: string;

  @IsEnum(MessageType)
  messageType: MessageType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentIds?: string[];

  @IsOptional()
  @IsString()
  replyToId?: string;
}

export class UpdateMessageValidationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content: string;
}

// Room validation DTOs
export class CreateRoomValidationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsBoolean()
  isPrivate: boolean;

  @IsNumber()
  @Min(2)
  @Max(1000)
  maxUsers: number;
}

export class UpdateRoomValidationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1000)
  maxUsers?: number;
}

// Pagination validation DTOs
export class PaginationValidationDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

// Search validation DTOs
export class SearchMessagesValidationDto extends PaginationValidationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  query: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}

// WebSocket validation DTOs
export class SocketJoinRoomValidationDto {
  @IsString()
  roomId: string;
}

export class SocketTypingValidationDto {
  @IsString()
  roomId: string;

  @IsBoolean()
  isTyping: boolean;
}

export class SocketUserStatusValidationDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

// WebSocket-specific DTOs for improved validation
export class SocketSendMessageValidationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  content: string;

  @IsString()
  roomId: string;

  @IsEnum(MessageType)
  @IsOptional()
  messageType?: MessageType = MessageType.TEXT;
}

export class SocketErrorDto {
  success: boolean = false;
  error: string;
  message?: string;
  statusCode?: number;
  timestamp: string = new Date().toISOString();
}

// File upload validation (to be used with multer interceptor)
export class FileUploadValidationDto {
  @IsOptional()
  @IsString()
  messageId?: string;
}

// Avatar upload specific validation
export class AvatarUploadValidationDto {
  @IsString()
  userId: string;
}
