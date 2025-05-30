/**
 * Profile Module Types
 * 
 * This file contains all TypeScript interfaces and type definitions specific to the user profile module.
 * It includes types for profile settings, avatar options, color themes, and constants for validation.
 */

import type { User } from '@/types';

/**
 * User profile settings interface
 */
export interface UserProfile extends User {
  textColor: string;
  backgroundColor: string;
  avatar?: string;
  preferences?: UserPreferences;
}

/**
 * Profile settings interface for updating user profile
 */
export interface ProfileSettings {
  textColor: string;
  backgroundColor: string;
  avatar?: File | string | null;
  username?: string;
}

/**
 * User preferences for notifications and display options
 */
export interface UserPreferences {
  enableNotifications: boolean;
  showStatusToOthers: boolean;
  displayReadReceipts: boolean;
  soundEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
}

/**
 * Avatar configuration options
 */
export interface AvatarOptions {
  size: number;
  shape: 'circle' | 'square' | 'rounded';
  defaultImage: string;
  allowUpload: boolean;
}

/**
 * Color theme interface for text/background color combinations
 */
export interface ColorTheme {
  name: string;
  textColor: string;
  backgroundColor: string;
  isAccessible: boolean;
  contrastRatio: number;
}

/**
 * Custom profile validation error interface
 */
export interface ProfileValidationError {
  field: string;
  message: string;
}

/**
 * Avatar upload status for tracking upload progress
 */
export type AvatarUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Color contrast validation result
 */
export interface ContrastValidationResult {
  isValid: boolean;
  ratio: number;
  recommendation?: string;
}

/**
 * Constants for avatar upload configuration
 */
export const AVATAR_CONSTRAINTS = {
  MAX_SIZE_MB: 2,
  MAX_SIZE_BYTES: 2 * 1024 * 1024, // 2MB
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  MAX_DIMENSIONS: { width: 1000, height: 1000 },
  MIN_DIMENSIONS: { width: 100, height: 100 }
};

/**
 * Constants for color selection validation
 */
export const COLOR_CONSTRAINTS = {
  MIN_CONTRAST_RATIO: 4.5, // WCAG AA standard for normal text
  LARGE_TEXT_MIN_CONTRAST_RATIO: 3, // WCAG AA standard for large text
  WCAG_AAA_CONTRAST_RATIO: 7 // WCAG AAA standard for normal text
};

/**
 * Predefined color themes that meet accessibility standards
 */
export const PREDEFINED_COLOR_THEMES: ColorTheme[] = [
  { name: 'Default', textColor: '#000000', backgroundColor: '#FFFFFF', isAccessible: true, contrastRatio: 21 },
  { name: 'Dark', textColor: '#FFFFFF', backgroundColor: '#333333', isAccessible: true, contrastRatio: 12.6 },
  { name: 'Ocean', textColor: '#003366', backgroundColor: '#E6F2FF', isAccessible: true, contrastRatio: 10.86 },
  { name: 'Forest', textColor: '#FFFFFF', backgroundColor: '#2E7D32', isAccessible: true, contrastRatio: 5.6 },
  { name: 'Sunset', textColor: '#000000', backgroundColor: '#FFB74D', isAccessible: true, contrastRatio: 11.5 },
];
