import { appConfig } from '../config/app.config';
import { ApiService } from './ApiService';
import { StorageService } from './storage.service';
import { ErrorService } from './error.service';
import type {
  LoginRequest,
  RegisterRequest,
  TokenResponse,
  UserResponse,
  RefreshTokenResponse,
  AuthState
} from '../types/enhanced-api.types';

/**
 * Enterprise-grade authentication service with JWT token management,
 * automatic refresh, and integration with API and WebSocket services
 */
export class AuthService {
  private static _instance: AuthService;
  private _apiService: ApiService;
  private _storageService: StorageService;
  private _errorService: ErrorService;
  private _refreshTimer: number | null = null;
  private _authState: AuthState = {
    isAuthenticated: false,
    user: null,
    tokens: {
      accessToken: null,
      refreshToken: null,
    },
    loading: false,
    error: null,
  };
  
  // Event listeners for auth state changes
  private _authListeners = new Set<(state: AuthState) => void>();

  private constructor() {
    this._apiService = ApiService.getInstance();
    this._storageService = StorageService.getInstance();
    this._errorService = ErrorService.getInstance();
    
    // Initialize auth state from storage
    this._initializeFromStorage();
    
    // Setup auth failure listener
    window.addEventListener('auth:failure', this._handleAuthFailure.bind(this));
    window.addEventListener('auth:websocket-failure', this._handleWebSocketAuthFailure.bind(this));
  }

  public static getInstance(): AuthService {
    if (!AuthService._instance) {
      AuthService._instance = new AuthService();
    }
    return AuthService._instance;
  }

  /**
   * Initialize authentication state from stored tokens
   */
  private _initializeFromStorage(): void {
    const accessToken = this._storageService.getSecure<string>('accessToken');
    const refreshToken = this._storageService.getSecure<string>('refreshToken');
    const user = this._storageService.getSecure<UserResponse>('user');

    if (accessToken && refreshToken && user) {
      this._updateAuthState({
        isAuthenticated: true,
        user,
        tokens: { accessToken, refreshToken },
        loading: false,
        error: null,
      });

      // Schedule token refresh
      this._scheduleTokenRefresh();
    }
  }
  /**
   * Login with email and password
   */
  public async login(credentials: LoginRequest): Promise<UserResponse> {
    this._updateAuthState({ ...this._authState, loading: true, error: null });

    try {
      const response = await this._apiService.post<TokenResponse>('/auth/login', credentials);
      
      await this._handleSuccessfulAuth(response);
      return response.user;    } catch (error: any) {
      console.error('AUTH SERVICE - Original error:', {
        errorType: typeof error,
        constructor: error?.constructor?.name,
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data,
        hasResponseProperty: 'response' in error,
        keys: Object.keys(error || {}),
        fullError: error
      });
      
      const errorMessage = this._errorService.handleApiError(error).message;
      this._updateAuthState({
        ...this._authState,
        loading: false,
        error: errorMessage,
      });
      // Throw a new error with the processed message
      const processedError = new Error(errorMessage);
      processedError.name = 'AuthenticationError';
      throw processedError;
    }
  }
  /**
   * Register new user account
   */
  public async register(userData: RegisterRequest): Promise<UserResponse> {
    this._updateAuthState({ ...this._authState, loading: true, error: null });

    try {
      const response = await this._apiService.post<TokenResponse>('/auth/register', userData);
      
      await this._handleSuccessfulAuth(response);
      return response.user;    } catch (error: any) {
      console.error('AUTH SERVICE REGISTER - Original error:', {
        errorType: typeof error,
        constructor: error?.constructor?.name,
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data,
        hasResponseProperty: 'response' in error,
        keys: Object.keys(error || {}),
        fullError: error
      });
      
      const errorMessage = this._errorService.handleApiError(error).message;
      this._updateAuthState({
        ...this._authState,
        loading: false,
        error: errorMessage,      });
      // Throw a new error with the processed message
      const processedError = new Error(errorMessage);
      processedError.name = 'RegistrationError';
      throw processedError;
    }
  }

  /**
   * Logout user and clear all authentication data
   */
  public async logout(): Promise<void> {
    this._updateAuthState({ ...this._authState, loading: true });

    try {
      // Call logout endpoint to invalidate tokens on server
      await this._apiService.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      this._errorService.handleError(error);
    } finally {
      this._clearAuthData();
    }
  }

  /**
   * Refresh authentication tokens
   */
  public async refreshTokens(): Promise<string> {
    // Try to get refresh token from state first, then from storage as fallback
    const refreshToken = this._authState.tokens.refreshToken || 
                        this._storageService.getSecure<string>('refreshToken') ||
                        localStorage.getItem('refreshToken') || 
                        sessionStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this._apiService.post<RefreshTokenResponse>('/auth/refresh', {
        refreshToken
      });

      // Update stored tokens
      this._storageService.setSecure('accessToken', response.accessToken);
      if (response.refreshToken) {
        this._storageService.setSecure('refreshToken', response.refreshToken);
      }

      // Update auth state
      this._updateAuthState({
        ...this._authState,
        tokens: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken || refreshToken,
        },
      });

      // Reschedule next refresh
      this._scheduleTokenRefresh();

      return response.accessToken;
    } catch (error) {
      // If refresh fails, logout user
      this._clearAuthData();
      throw error;
    }
  }

  /**
   * Get current user profile
   */
  public async getCurrentUser(): Promise<UserResponse> {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const user = await this._apiService.get<UserResponse>('/auth/me');
      
      // Update stored user data
      this._storageService.setSecure('user', user);
      this._updateAuthState({
        ...this._authState,
        user,
      });

      return user;
    } catch (error) {
      this._errorService.handleError(error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  public async updateProfile(updates: Partial<UserResponse>): Promise<UserResponse> {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const updatedUser = await this._apiService.put<UserResponse>('/auth/profile', updates);
      
      // Update stored user data
      this._storageService.setSecure('user', updatedUser);
      this._updateAuthState({
        ...this._authState,
        user: updatedUser,
      });

      return updatedUser;
    } catch (error) {
      this._errorService.handleError(error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      await this._apiService.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
    } catch (error) {
      this._errorService.handleError(error);
      throw error;
    }
  }

  /**
   * Check if access token is expired or will expire soon
   */
  public isTokenExpiringSoon(): boolean {
    const token = this._storageService.getSecure<string>('accessToken');
    if (!token) return true;

    try {
      // Decode JWT to get expiry time
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Consider token as expiring if less than configured threshold
      const thresholdMs = appConfig.auth.tokenRefreshThreshold * 60 * 1000;
      
      return timeUntilExpiry < thresholdMs;
    } catch (error) {
      // If token can't be decoded, consider it expired
      return true;
    }
  }

  /**
   * Handle successful authentication
   */
  private async _handleSuccessfulAuth(response: TokenResponse): Promise<void> {
    // Store tokens and user data securely
    this._storageService.setSecure('accessToken', response.accessToken);
    this._storageService.setSecure('refreshToken', response.refreshToken);
    this._storageService.setSecure('user', response.user);

    // Update auth state
    this._updateAuthState({
      isAuthenticated: true,
      user: response.user,
      tokens: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      },
      loading: false,
      error: null,
    });

    // Schedule token refresh
    this._scheduleTokenRefresh();

    // Emit auth success event
    window.dispatchEvent(new CustomEvent('auth:success', {
      detail: { user: response.user }
    }));
  }

  /**
   * Clear all authentication data
   */
  private _clearAuthData(): void {
    // Clear refresh timer
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }

    // Clear stored data
    this._storageService.removeSecure('accessToken');
    this._storageService.removeSecure('refreshToken');
    this._storageService.removeSecure('user');

    // Update auth state
    this._updateAuthState({
      isAuthenticated: false,
      user: null,
      tokens: {
        accessToken: null,
        refreshToken: null,
      },
      loading: false,
      error: null,
    });

    // Emit logout event
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  /**
   * Schedule automatic token refresh
   */
  private _scheduleTokenRefresh(): void {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }

    const token = this._storageService.getSecure<string>('accessToken');
    if (!token) return;

    try {
      // Decode JWT to get expiry time
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Schedule refresh before expiry (with threshold)
      const thresholdMs = appConfig.auth.tokenRefreshThreshold * 60 * 1000;
      const refreshTime = Math.max(timeUntilExpiry - thresholdMs, 30000); // At least 30 seconds

      this._refreshTimer = window.setTimeout(() => {
        this.refreshTokens().catch((error) => {
          this._errorService.handleError(error);
        });
      }, refreshTime);

      if (appConfig.features.enableLogging) {
        console.log(`[Auth] Token refresh scheduled in ${Math.round(refreshTime / 1000)}s`);
      }
    } catch (error) {
      this._errorService.handleError(error);
    }
  }

  /**
   * Handle authentication failure events
   */
  private _handleAuthFailure(): void {
    this._clearAuthData();
  }

  /**
   * Handle WebSocket authentication failure
   */
  private _handleWebSocketAuthFailure(): void {
    // Try to refresh tokens if WebSocket auth fails
    if (this.isAuthenticated) {
      this.refreshTokens().catch(() => {
        this._clearAuthData();
      });
    }
  }

  /**
   * Update authentication state and notify listeners
   */
  private _updateAuthState(newState: AuthState): void {
    this._authState = { ...newState };
    
    // Notify all listeners
    this._authListeners.forEach(listener => {
      try {
        listener(this._authState);
      } catch (error) {
        this._errorService.handleError(error);
      }
    });
  }

  /**
   * Subscribe to authentication state changes
   */
  public onAuthStateChange(listener: (state: AuthState) => void): () => void {
    this._authListeners.add(listener);
    
    // Immediately call with current state
    listener(this._authState);
    
    // Return unsubscribe function
    return () => {
      this._authListeners.delete(listener);
    };
  }

  // =====================================
  // Public getters
  // =====================================

  /**
   * Check if user is authenticated
   */
  public get isAuthenticated(): boolean {
    return this._authState.isAuthenticated;
  }

  /**
   * Get current user
   */
  public get currentUser(): UserResponse | null {
    return this._authState.user;
  }

  /**
   * Get current authentication state
   */
  public get authState(): AuthState {
    return { ...this._authState };
  }

  /**
   * Get access token
   */
  public get accessToken(): string | null {
    return this._authState.tokens.accessToken;
  }

  /**
   * Check if authentication is loading
   */
  public get isLoading(): boolean {
    return this._authState.loading;
  }

  /**
   * Get authentication error
   */
  public get error(): string | null {
    return this._authState.error;
  }
}

// Export singleton instance
export default AuthService.getInstance();
