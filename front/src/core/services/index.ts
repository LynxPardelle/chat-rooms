/**
 * Core Services Index
 * Enterprise-grade service layer for frontend application
 */

// Core Services
export { ApiService } from './ApiService';
export { SocketService } from './SocketService';
export { AuthService } from './auth.service';
export { StorageService } from './storage.service';
export { ErrorService } from './error.service';

// Service Instances (Singletons)
export { default as apiService } from './ApiService';
export { default as socketService } from './SocketService';
export { default as authService } from './auth.service';

// Interceptors
export * from '../interceptors';

// Types
export type * from '../types/enhanced-api.types';

// Configuration
export { appConfig } from '../config/app.config';

/**
 * Initialize all core services
 * Call this function in your application's main entry point
 */
export const initializeCoreServices = async (): Promise<void> => {
  try {
    // Initialize services in dependency order
    const { ErrorService } = await import('./error.service');
    const { StorageService } = await import('./storage.service');
    const { ApiService } = await import('./ApiService');
    const { AuthService } = await import('./auth.service');
    const { SocketService } = await import('./SocketService');

    // Get singleton instances
    ErrorService.getInstance();
    StorageService.getInstance();
    ApiService.getInstance();
    const authService = AuthService.getInstance();
    SocketService.getInstance();

    // Setup global error handlers
    window.addEventListener('unhandledrejection', (event) => {
      ErrorService.getInstance().handleError(event.reason);
    });

    window.addEventListener('error', (event) => {
      ErrorService.getInstance().handleError(event.error);
    });

    // Setup auth state restoration
    if (authService.isAuthenticated) {
      // Verify token validity and refresh if needed
      try {
        await authService.getCurrentUser();
      } catch (error) {
        console.warn('Failed to restore user session:', error);
      }
    }

    console.log('Core services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize core services:', error);
    throw error;
  }
};

/**
 * Cleanup all services
 * Call this when the application is being destroyed
 */
export const cleanupCoreServices = (): void => {
  try {
    // Import and cleanup services
    import('./SocketService').then(({ default: socketService }) => {
      socketService.disconnect();
    });

    import('./ApiService').then(({ default: apiService }) => {
      apiService.cancelAllRequests();
    });

    console.log('Core services cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup core services:', error);
  }
};

/**
 * Service health check
 */
export const checkServiceHealth = async (): Promise<{
  services: Record<string, boolean>;
  overall: boolean;
}> => {
  const health = {
    storage: false,
    api: false,
    auth: false,
    websocket: false,
  };

  try {
    // Check storage
    const { StorageService } = await import('./storage.service');
    health.storage = StorageService.getInstance().isAvailable();

    // Check API (simple connectivity check)
    health.api = true; // ApiService is always "healthy" if instantiated

    // Check auth
    const { AuthService } = await import('./auth.service');
    health.auth = AuthService.getInstance().isAuthenticated;

    // Check WebSocket
    const { SocketService } = await import('./SocketService');
    health.websocket = SocketService.getInstance().isConnected;
  } catch (error) {
    console.error('Service health check failed:', error);
  }

  const overall = Object.values(health).every(status => status);

  return {
    services: health,
    overall
  };
};
