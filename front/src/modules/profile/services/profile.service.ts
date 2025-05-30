import { ApiService } from '@/core/services/ApiService';
import type { UserProfile, ProfileSettings } from '../types/profile.types';
import { ErrorService } from '@/core/services/error.service';

/**
 * Service for managing user profile data and API interactions
 */
export class ProfileService {
  private _apiService: ApiService;
  private _errorService: ErrorService;
  
  constructor() {
    this._apiService = ApiService.getInstance();
    this._errorService = ErrorService.getInstance();
  }
  
  /**
   * Get current user profile
   * @param userId User ID
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await this._apiService.get<{ data: UserProfile }>(`/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Update user profile settings
   * @param userId User ID
   * @param settings Profile settings to update
   */
  async updateUserProfile(userId: string, settings: ProfileSettings): Promise<UserProfile> {
    try {
      const response = await this._apiService.patch<{ data: UserProfile }>(`/users/${userId}/profile`, settings);
      return response.data;
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Upload user avatar
   * @param userId User ID
   * @param file Avatar file to upload
   * @param onProgress Progress callback
   */
  async uploadAvatar(userId: string, file: File, onProgress?: (progress: number) => void): Promise<string> {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('avatar', file);
      
      // Configure upload with progress tracking
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent: ProgressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        }
      };
      
      const response = await this._apiService.post<{ data: { avatarUrl: string } }>(
        `/users/${userId}/avatar`,
        formData,
        config
      );
      
      return response.data.avatarUrl;
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Delete user avatar
   * @param userId User ID
   */
  async deleteAvatar(userId: string): Promise<void> {
    try {
      await this._apiService.delete(`/users/${userId}/avatar`);
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Update user preferences
   * @param userId User ID
   * @param preferences Preferences to update
   */
  async updateUserPreferences(userId: string, preferences: Partial<UserProfile['preferences']>): Promise<UserProfile> {
    try {
      const response = await this._apiService.patch<{ data: UserProfile }>(
        `/users/${userId}/preferences`,
        { preferences }
      );
      return response.data;
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
  
  /**
   * Get available color themes
   */
  async getColorThemes() {
    try {
      const response = await this._apiService.get<{ data: { themes: Array<{ name: string, textColor: string, backgroundColor: string }> } }>(
        '/theme/colors'
      );
      return response.data.themes;
    } catch (error) {
      this._errorService.handleApiError(error);
      throw error;
    }
  }
}
