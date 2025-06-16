import { IsOptional, IsString, IsBoolean, IsNumber, IsObject, IsEnum, IsHexColor, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum ThemeType {
  LIGHT = 'light',
  DARK = 'dark',
  HIGH_CONTRAST = 'high-contrast',
  SEPIA = 'sepia',
  CUSTOM = 'custom',
}

export class UserThemeDto {
  @IsEnum(ThemeType)
  name: ThemeType;

  @IsOptional()
  @IsObject()
  customColors?: Record<string, string>;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AccessibilityConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(3.0)
  @Type(() => Number)
  fontSize?: number;

  @IsOptional()
  @IsNumber()
  @Min(1.0)
  @Max(2.5)
  @Type(() => Number)
  lineHeight?: number;

  @IsOptional()
  @IsBoolean()
  highContrast?: boolean;

  @IsOptional()
  @IsBoolean()
  reduceMotion?: boolean;

  @IsOptional()
  @IsBoolean()
  largeText?: boolean;

  @IsOptional()
  @IsBoolean()
  focusIndicator?: boolean;

  @IsOptional()
  @IsString()
  screenReaderMode?: string;
}

export class NotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  sound?: boolean;

  @IsOptional()
  @IsBoolean()
  vibration?: boolean;

  @IsOptional()
  @IsBoolean()
  desktop?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @Type(() => UserThemeDto)
  theme?: UserThemeDto;

  @IsOptional()
  @Type(() => AccessibilityConfigDto)
  accessibilityConfig?: AccessibilityConfigDto;

  @IsOptional()
  @Type(() => NotificationSettingsDto)
  notificationSettings?: NotificationSettingsDto;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UserSettingsResponseDto {
  id: string;
  username: string;
  email: string;
  textColor?: string;
  backgroundColor?: string;
  avatarUrl?: string;
  theme?: UserThemeDto;
  accessibilityConfig?: AccessibilityConfigDto;
  notificationSettings?: NotificationSettingsDto;
  language?: string;
  timezone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ExportSettingsDto {
  theme?: UserThemeDto;
  textColor?: string;
  backgroundColor?: string;
  accessibilityConfig?: AccessibilityConfigDto;
  notificationSettings?: NotificationSettingsDto;
  language?: string;
  timezone?: string;
  exportedAt: string;
  version: string;
}

export class ImportSettingsDto {
  @IsOptional()
  @Type(() => UserThemeDto)
  theme?: UserThemeDto;

  @IsOptional()
  @IsHexColor()
  textColor?: string;

  @IsOptional()
  @IsHexColor()
  backgroundColor?: string;

  @IsOptional()
  @Type(() => AccessibilityConfigDto)
  accessibilityConfig?: AccessibilityConfigDto;

  @IsOptional()
  @Type(() => NotificationSettingsDto)
  notificationSettings?: NotificationSettingsDto;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
