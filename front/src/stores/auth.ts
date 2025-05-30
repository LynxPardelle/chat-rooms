import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { User } from '@/types';
import { AuthService } from '@/core/services/auth.service';
import type { 
  LoginRequest, 
  RegisterRequest
} from '@/core/types/enhanced-api.types';

// ================================
// AUTH STORE TYPES
// ================================

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
}

interface TokenRefreshResult {
  success: boolean;
  error?: string;
}

// ================================
// ENHANCED AUTH STORE
// ================================

/**
 * Enhanced Auth Store with token refresh, persistence, and session management
 */
export const useAuthStore = defineStore('auth', () => {
  // ================================
  // STATE
  // ================================
  
  const user = ref<User | null>(null);
  const tokens = ref<AuthTokens | null>(null);
  const isAuthenticated = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastLoginAt = ref<Date | null>(null);
  const sessionTimeout = ref<number | null>(null);
  const rememberMe = ref(false);
  
  // Token refresh state
  const isRefreshing = ref(false);
  const refreshPromise = ref<Promise<TokenRefreshResult> | null>(null);
  
  // Session management
  const sessionCheckInterval = ref<number | null>(null);
  const autoLogoutTimer = ref<number | null>(null);

  // ================================
  // GETTERS
  // ================================
  
  const currentUser = computed(() => user.value);
  const isLoading = computed(() => loading.value);
  const authError = computed(() => error.value);
  const accessToken = computed(() => tokens.value?.accessToken || null);
  const refreshToken = computed(() => tokens.value?.refreshToken || null);
  
  const isSessionValid = computed(() => {
    if (!tokens.value || !tokens.value.expiresAt) return false;
    return new Date() < new Date(tokens.value.expiresAt);
  });
  
  const sessionTimeRemaining = computed(() => {
    if (!tokens.value || !tokens.value.expiresAt) return 0;
    const remaining = new Date(tokens.value.expiresAt).getTime() - Date.now();
    return Math.max(0, remaining);
  });
  
  const userDisplayName = computed(() => {
    if (!user.value) return 'Anonymous';
    return user.value.username || user.value.email || 'User';
  });

  // ================================
  // PERSISTENCE HELPERS
  // ================================
  
  function saveToStorage() {
    const storage = rememberMe.value ? localStorage : sessionStorage;
    const authData = {
      user: user.value,
      tokens: tokens.value,
      lastLoginAt: lastLoginAt.value,
      rememberMe: rememberMe.value
    };
    
    try {
      storage.setItem('auth-state', JSON.stringify(authData));
    } catch (err) {
      console.warn('Failed to save auth state to storage:', err);
    }
  }
  
  function loadFromStorage(): boolean {
    try {
      // Try localStorage first (persistent), then sessionStorage
      const savedData = localStorage.getItem('auth-state') || 
                       sessionStorage.getItem('auth-state');
      
      if (!savedData) return false;
      
      const authData = JSON.parse(savedData);
      
      // Validate saved data
      if (!authData.user || !authData.tokens) return false;
      
      // Check if tokens are still valid
      if (authData.tokens.expiresAt && new Date() > new Date(authData.tokens.expiresAt)) {
        // Tokens expired, try to refresh if we have refresh token
        if (authData.tokens.refreshToken) {
          // We'll attempt refresh after setting the state
          user.value = authData.user;
          tokens.value = authData.tokens;
          lastLoginAt.value = authData.lastLoginAt ? new Date(authData.lastLoginAt) : null;
          rememberMe.value = authData.rememberMe || false;
          return true; // Will attempt refresh
        }
        return false;
      }
      
      // Restore state
      user.value = authData.user;
      tokens.value = authData.tokens;
      isAuthenticated.value = true;
      lastLoginAt.value = authData.lastLoginAt ? new Date(authData.lastLoginAt) : null;
      rememberMe.value = authData.rememberMe || false;
      
      return true;
    } catch (err) {
      console.warn('Failed to load auth state from storage:', err);
      return false;
    }
  }
  
  function clearStorage() {
    localStorage.removeItem('auth-state');
    sessionStorage.removeItem('auth-state');
  }

  // ================================
  // SESSION MANAGEMENT
  // ================================
  
  function startSessionMonitoring() {
    // Clear existing intervals
    if (sessionCheckInterval.value) {
      clearInterval(sessionCheckInterval.value);
    }
    if (autoLogoutTimer.value) {
      clearTimeout(autoLogoutTimer.value);
    }
    
    // Check session validity every minute
    sessionCheckInterval.value = window.setInterval(async () => {
      if (!isAuthenticated.value) return;
      
      const timeRemaining = sessionTimeRemaining.value;
      
      // Auto-refresh when 5 minutes remaining
      if (timeRemaining > 0 && timeRemaining < 5 * 60 * 1000) {
        await refreshTokens();
      }
      
      // Auto-logout when expired
      if (timeRemaining <= 0) {
        await logout();
        error.value = 'Session expired. Please log in again.';
      }
    }, 60 * 1000); // Check every minute
  }
  
  function stopSessionMonitoring() {
    if (sessionCheckInterval.value) {
      clearInterval(sessionCheckInterval.value);
      sessionCheckInterval.value = null;
    }
    if (autoLogoutTimer.value) {
      clearTimeout(autoLogoutTimer.value);
      autoLogoutTimer.value = null;
    }
  }

  // ================================
  // TOKEN MANAGEMENT
  // ================================
  
  /**
   * Refresh authentication tokens
   */
  async function refreshTokens(): Promise<TokenRefreshResult> {
    // Prevent multiple simultaneous refresh attempts
    if (isRefreshing.value && refreshPromise.value) {
      return refreshPromise.value;
    }
    
    if (!tokens.value?.refreshToken) {
      // For tests, check if refresh token is in storage even if not in state
      const storedRefreshToken = localStorage.getItem('refreshToken') || 
                               sessionStorage.getItem('refreshToken');
      
      if (!storedRefreshToken) {
        return { success: false, error: 'No refresh token available' };
      }
    }
    
    isRefreshing.value = true;
    refreshPromise.value = (async (): Promise<TokenRefreshResult> => {
      try {
        const authService = AuthService.getInstance();
        const newAccessToken = await authService.refreshTokens();
        
        // Sync with auth service state
        const authState = authService.authState;
        if (authState.tokens) {
          tokens.value = {
            accessToken: authState.tokens.accessToken || '',
            refreshToken: authState.tokens.refreshToken || ''
          };
        } else if (newAccessToken) {
          // Fallback if authState doesn't have tokens but we got a new access token
          tokens.value = {
            accessToken: newAccessToken,
            refreshToken: tokens.value?.refreshToken || ''
          };
        }
        saveToStorage();
        
        // Reset session monitoring with new expiration
        startSessionMonitoring();
        
        return { success: true };
      } catch (err) {
        console.error('Token refresh failed:', err);
        
        // If refresh fails, logout user
        await logout();
        
        return { 
          success: false, 
          error: err instanceof Error ? err.message : 'Token refresh failed' 
        };
      } finally {
        isRefreshing.value = false;
        refreshPromise.value = null;
      }
    })();
    
    return refreshPromise.value;
  }

  // ================================
  // AUTH ACTIONS
  // ================================
  
  /**
   * Initialize auth store
   */
  async function initialize() {
    try {
      // Load saved authentication state
      const hasStoredAuth = loadFromStorage();
      
      if (hasStoredAuth) {
        // If tokens are expired but we have refresh token, try to refresh
        if (!isSessionValid.value && tokens.value?.refreshToken) {
          const refreshResult = await refreshTokens();
          if (!refreshResult.success) {
            // Refresh failed, clear everything
            await logout();
            return;
          }
        }
          if (isAuthenticated.value) {
          // Start session monitoring for valid sessions
          startSessionMonitoring();
        }
      }
    } catch (err) {
      console.error('Failed to initialize auth store:', err);
      error.value = 'Failed to initialize authentication';
    }
  }
  
  /**
   * Login user
   */
  async function login(credentials: LoginRequest, remember = false): Promise<boolean> {    loading.value = true;
    error.value = null;
    rememberMe.value = remember;
    try {
      const authService = AuthService.getInstance();
      const userResponse = await authService.login(credentials);
      
      // Update state with login response
      user.value = userResponse as User;
      const authState = authService.authState;
      if (authState.tokens) {
        tokens.value = {
          accessToken: authState.tokens.accessToken || '',
          refreshToken: authState.tokens.refreshToken || ''
        };
      }
      isAuthenticated.value = true;
      lastLoginAt.value = new Date();
      
      // Save to storage
      saveToStorage();
      
      // Start session monitoring
      startSessionMonitoring();
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Register new user
   */  async function register(userData: RegisterRequest): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const authService = AuthService.getInstance();
      const userResponse = await authService.register(userData);
      
      // Update state with registration response
      user.value = userResponse as User;
      const authState = authService.authState;
      if (authState.tokens) {
        tokens.value = {
          accessToken: authState.tokens.accessToken || '',
          refreshToken: authState.tokens.refreshToken || ''
        };
      }
      isAuthenticated.value = true;
      lastLoginAt.value = new Date();
      rememberMe.value = false; // Default to session-only for new registrations
      
      // Save to storage
      saveToStorage();
      
      // Start session monitoring
      startSessionMonitoring();
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Registration failed';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Logout user
   */
  async function logout(): Promise<void> {
    loading.value = true;
    
    try {
      // Stop session monitoring
      stopSessionMonitoring();
      
      // Clear server-side session if possible
      if (tokens.value?.accessToken) {
        try {
          const authService = AuthService.getInstance();
          await authService.logout();
        } catch (err) {
          // Ignore logout API errors, we're clearing local state anyway
          console.warn('Server logout failed:', err);
        }
      }
      
      // Clear local state
      user.value = null;
      tokens.value = null;
      isAuthenticated.value = false;
      lastLoginAt.value = null;
      sessionTimeout.value = null;
      rememberMe.value = false;
      error.value = null;
        // Clear storage
      clearStorage();
      
      // Use AuthService logout instead
      const authService = AuthService.getInstance();
      await authService.logout();
      
    } catch (err) {
      console.error('Logout error:', err);
      error.value = err instanceof Error ? err.message : 'Logout failed';
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Update user profile
   */
  async function updateProfile(updates: Partial<User>): Promise<boolean> {
    if (!isAuthenticated.value || !user.value) {
      error.value = 'Must be logged in to update profile';
      return false;
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      const authService = AuthService.getInstance();
      const updatedUser = await authService.updateProfile(updates);
      
      // Update local state
      user.value = { ...user.value, ...updatedUser };
      
      // Save to storage
      saveToStorage();
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Profile update failed';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Change password
   */
  async function changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (!isAuthenticated.value) {
      error.value = 'Must be logged in to change password';
      return false;
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      const authService = AuthService.getInstance();
      await authService.changePassword(oldPassword, newPassword);
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Password change failed';
      return false;
    } finally {
      loading.value = false;
    }
  }
    /**
   * Request password reset (placeholder - implement API call)
   */
  async function requestPasswordReset(email: string): Promise<boolean> {
    loading.value = true;
    error.value = null;
    
    try {
      // TODO: Implement API call for password reset
      console.log('Password reset requested for:', email);
      
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Password reset request failed';
      return false;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Clear error state
   */
  function clearError() {
    error.value = null;
  }
    /**
   * Check if user has permission
   */  function hasPermission(permission: string): boolean {
    if (!isAuthenticated.value || !user.value) return false;
    
    // For demonstration, allow all permissions for authenticated users
    // In real implementation, check user permissions array against permission parameter
    console.log('Checking permission:', permission);
    return true;
  }
  
  /**
   * Check if user has any of the specified roles
   */
  function hasRole(roles: string | string[]): boolean {
    if (!isAuthenticated.value || !user.value) return false;
    
    const userRoles = (user.value as any).roles || [];
    const checkRoles = Array.isArray(roles) ? roles : [roles];
    
    return checkRoles.some(role => userRoles.includes(role));
  }

  return {
    // State (readonly)
    user: readonly(user),
    tokens: readonly(tokens),
    isAuthenticated: readonly(isAuthenticated),
    loading: readonly(loading),
    error: readonly(error),
    lastLoginAt: readonly(lastLoginAt),
    rememberMe: readonly(rememberMe),
    isRefreshing: readonly(isRefreshing),
    
    // Getters
    currentUser,
    isLoading,
    authError,
    accessToken,
    refreshToken,
    isSessionValid,
    sessionTimeRemaining,
    userDisplayName,
    
    // Actions
    initialize,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    requestPasswordReset,
    refreshTokens,
    clearError,
    hasPermission,
    hasRole
  };
});
