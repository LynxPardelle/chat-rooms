/**
 * Profile Module
 * 
 * This module handles user profile management, including:
 * - Profile settings customization
 * - Avatar management
 * - User preferences
 * - Theme selection
 * - Accessibility features
 */

// Public types
export * from './types/profile.types';

// Store 
export { useProfileStore } from './stores/profile.store';

// Services
export { ProfileService } from './services/profile.service';

// Components
export { 
  ProfileSettings,
  AvatarUpload, 
  ColorPicker,
  UserPreferences as UserPrefsComponent,
  ProfileSummary 
} from './components';

// Main view
export { default as ProfileView } from './ProfileView.vue';
