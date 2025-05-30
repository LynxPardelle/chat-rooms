import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { UserProfile, ProfileSettings, ProfileValidationError, AvatarUploadStatus, ContrastValidationResult } from '../types/profile.types';
import { ProfileService } from '../services/profile.service';
import { useAuthStore } from '@/stores/auth';
import { COLOR_CONSTRAINTS } from '../types/profile.types';

/**
 * Profile Store for managing user profile state and interactions
 */
export const useProfileStore = defineStore('profile', () => {
  // ================================
  // STATE
  // ================================
  
  const profile = ref<UserProfile | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  const validationErrors = ref<ProfileValidationError[]>([]);
  const avatarUploadStatus = ref<AvatarUploadStatus>('idle');
  const avatarUploadProgress = ref(0);
  const isDirty = ref(false);
  
  // Services
  const profileService = new ProfileService();
  const authStore = useAuthStore();

  // ================================
  // GETTERS
  // ================================
  
  const isProfileLoaded = computed(() => !!profile.value);
  
  const userInitials = computed(() => {
    if (!profile.value?.username) return '?';
    
    return profile.value.username
      .split(' ')
      .map(name => name.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  });
  
  const currentColorSettings = computed(() => {
    if (!profile.value) return { textColor: '#000000', backgroundColor: '#FFFFFF' };
    
    return {
      textColor: profile.value.textColor || '#000000',
      backgroundColor: profile.value.backgroundColor || '#FFFFFF'
    };
  });
  
  const colorContrast = computed((): ContrastValidationResult => {
    if (!profile.value) {
      return { isValid: false, ratio: 0 };
    }
    
    const ratio = calculateContrastRatio(
      profile.value.textColor || '#000000',
      profile.value.backgroundColor || '#FFFFFF'
    );
    
    const isValid = ratio >= COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO;
    
    let recommendation = '';
    if (!isValid) {
      recommendation = 'Consider using colors with higher contrast for better readability';
    }
    
    return { isValid, ratio, recommendation };
  });
  
  const hasProfile = computed(() => !!profile.value);

  // ================================
  // ACTIONS
  // ================================
  
  /**
   * Load user profile from the server
   */
  async function loadProfile() {
    if (!authStore.isAuthenticated) return;
    
    try {
      loading.value = true;
      error.value = null;
      
      const userId = authStore.user?.id;
      if (!userId) throw new Error('User not authenticated');
      
      const userProfile = await profileService.getUserProfile(userId);
      profile.value = userProfile;
      isDirty.value = false;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profile';
      console.error('Error loading profile:', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Update user profile settings
   */
  async function updateProfile(settings: ProfileSettings) {
    if (!authStore.isAuthenticated || !profile.value) return;
    
    try {
      saving.value = true;
      error.value = null;
      validationErrors.value = [];
      
      // Validate settings before saving
      const validationResult = validateProfileSettings(settings);
      if (!validationResult.valid) {
        validationErrors.value = validationResult.errors;
        throw new Error('Invalid profile settings');
      }
      
      const userId = authStore.user?.id;
      if (!userId) throw new Error('User not authenticated');
      
      // Process avatar upload separately if it's a File
      if (settings.avatar && settings.avatar instanceof File) {
        avatarUploadStatus.value = 'uploading';
        
        try {
          const avatarUrl = await profileService.uploadAvatar(userId, settings.avatar, 
            (progress) => { avatarUploadProgress.value = progress; }
          );
          
          settings.avatar = avatarUrl;
          avatarUploadStatus.value = 'success';
        } catch (uploadErr) {
          avatarUploadStatus.value = 'error';
          throw uploadErr;
        }
      }
      
      // Update profile with new settings
      const updatedProfile = await profileService.updateUserProfile(userId, settings);
      profile.value = { ...profile.value, ...updatedProfile };      
      // Sync with auth store if username was updated
      if (settings.username && authStore.user) {
        authStore.updateProfile({
          username: settings.username,
          textColor: settings.textColor,
          backgroundColor: settings.backgroundColor,
          avatar: typeof settings.avatar === 'string' ? settings.avatar : authStore.user.avatar
        });
      }
      
      isDirty.value = false;
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update profile';
      console.error('Error updating profile:', err);
      return false;
    } finally {
      saving.value = false;
    }
  }
  
  /**
   * Mark profile as dirty (unsaved changes)
   */
  function setDirty() {
    isDirty.value = true;
  }
  
  /**
   * Reset profile changes to last saved state
   */
  function resetChanges() {
    loadProfile();
  }
  
  /**
   * Delete user avatar
   */
  async function deleteAvatar() {
    if (!authStore.isAuthenticated || !profile.value?.id) return;
    
    try {
      saving.value = true;
      error.value = null;
      
      await profileService.deleteAvatar(profile.value.id);
      
      if (profile.value) {
        profile.value = { ...profile.value, avatar: undefined };
      }
        // Sync with auth store
      if (authStore.user) {
        authStore.updateProfile({
          avatar: undefined
        });
      }
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete avatar';
      console.error('Error deleting avatar:', err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Update user preferences
   */  async function updatePreferences(preferences: Partial<UserProfile['preferences']>) {
    if (!authStore.isAuthenticated || !profile.value?.id) return;
    
    try {
      saving.value = true;
      error.value = null;
      
      const updatedProfile = await profileService.updateUserPreferences(profile.value.id, preferences);
      
      if (profile.value) {
        // Ensure we have default preferences if none exist yet
        const currentPrefs = profile.value.preferences || {
          enableNotifications: true,
          showStatusToOthers: true,
          displayReadReceipts: true,
          soundEnabled: true,
          theme: 'light'
        };
        
        profile.value = { 
          ...profile.value, 
          preferences: { 
            ...currentPrefs,
            ...updatedProfile.preferences
          } 
        };
      }
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update preferences';
      console.error('Error updating preferences:', err);
      return false;
    } finally {
      saving.value = false;
    }
  }
  
  // ================================
  // HELPER FUNCTIONS
  // ================================
  
  /**
   * Validate profile settings
   */
  function validateProfileSettings(settings: ProfileSettings): { valid: boolean, errors: ProfileValidationError[] } {
    const errors: ProfileValidationError[] = [];
    
    // Validate text and background color contrast
    const ratio = calculateContrastRatio(settings.textColor, settings.backgroundColor);
    if (ratio < COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO) {
      errors.push({
        field: 'colors',
        message: `Color contrast ratio (${ratio.toFixed(2)}) is below the required minimum (${COLOR_CONSTRAINTS.MIN_CONTRAST_RATIO})`
      });
    }
    
    // Validate username if provided
    if (settings.username !== undefined) {
      if (!settings.username.trim()) {
        errors.push({
          field: 'username',
          message: 'Username cannot be empty'
        });
      } else if (settings.username.length < 3) {
        errors.push({
          field: 'username',
          message: 'Username must be at least 3 characters long'
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Calculate contrast ratio between two colors
   */
  function calculateContrastRatio(textColor: string, backgroundColor: string): number {
    // Convert hex to RGB
    const textRgb = hexToRgb(textColor);
    const bgRgb = hexToRgb(backgroundColor);
    
    if (!textRgb || !bgRgb) return 0;
    
    // Calculate luminance
    const textLuminance = calculateLuminance(textRgb);
    const bgLuminance = calculateLuminance(bgRgb);
    
    // Calculate contrast ratio
    const lighter = Math.max(textLuminance, bgLuminance);
    const darker = Math.min(textLuminance, bgLuminance);
    
    return (lighter + 0.05) / (darker + 0.05);
  }
  
  /**
   * Convert hex color to RGB
   */
  function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : null;
  }
  
  /**
   * Calculate relative luminance from RGB values
   */
  function calculateLuminance({ r, g, b }: { r: number, g: number, b: number }): number {
    // Convert RGB to sRGB
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;
    
    // Calculate luminance
    const R = sR <= 0.03928 ? sR / 12.92 : Math.pow((sR + 0.055) / 1.055, 2.4);
    const G = sG <= 0.03928 ? sG / 12.92 : Math.pow((sG + 0.055) / 1.055, 2.4);
    const B = sB <= 0.03928 ? sB / 12.92 : Math.pow((sB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
    // Initialize profile when auth state changes
  authStore.$subscribe((_mutation, state) => {
    if (state.isAuthenticated && state.user && !profile.value) {
      loadProfile();
    } else if (!state.isAuthenticated) {
      profile.value = null;
    }
  });
  
  // Load profile on initialization if authenticated
  if (authStore.isAuthenticated) {
    loadProfile();
  }

  return {
    // State
    profile: readonly(profile),
    loading: readonly(loading),
    saving: readonly(saving),
    error: readonly(error),
    validationErrors: readonly(validationErrors),
    avatarUploadStatus: readonly(avatarUploadStatus),
    avatarUploadProgress: readonly(avatarUploadProgress),
    isDirty: readonly(isDirty),
    
    // Getters
    isProfileLoaded,
    userInitials,
    currentColorSettings,
    colorContrast,
    hasProfile,
    
    // Actions
    loadProfile,
    updateProfile,
    setDirty,
    resetChanges,
    deleteAvatar,
    updatePreferences
  };
});
