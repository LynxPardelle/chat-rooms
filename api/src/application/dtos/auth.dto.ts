import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

/**
 * Login DTO with validation
 */
export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

/**
 * Register DTO with validation
 */
export class RegisterDto {
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must be at most 20 characters long' })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: 'Username can only contain letters, numbers, and underscores' 
  })
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(50, { message: 'Password must be at most 50 characters long' })
  password: string;

  @IsOptional()
  @IsString({ message: 'Text color must be a string' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { 
    message: 'Text color must be a valid hex color (e.g., #000000)' 
  })
  textColor?: string;

  @IsOptional()
  @IsString({ message: 'Background color must be a string' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { 
    message: 'Background color must be a valid hex color (e.g., #ffffff)' 
  })
  backgroundColor?: string;
}

/**
 * Refresh Token DTO with validation
 */
export class RefreshTokenDto {
  @IsString({ message: 'Refresh token must be a string' })
  refreshToken: string;
}

/**
 * User Response DTO - for consistent API responses
 */
export class UserResponseDto {
  id: string;
  username: string;
  email: string;
  textColor: string;
  backgroundColor: string;
  isOnline: boolean;
  lastSeen: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Token Response DTO - for authentication endpoints
 */
export class TokenResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}

/**
 * Simple Test DTO - for testing endpoints
 */
export class SimpleTestDto {
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;
}
