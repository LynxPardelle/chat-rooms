import { appConfig } from '../config/app.config';
import type { ApiError, ValidationError } from '../types/api.types';

/**
 * Centralized error handling service with logging and user-friendly messages
 */
export class ErrorService {
  private static instance: ErrorService;
  private readonly enableLogging: boolean;

  private constructor() {
    this.enableLogging = appConfig.features.enableLogging;
  }

  public static getInstance(): ErrorService {
    if (!ErrorService.instance) {
      ErrorService.instance = new ErrorService();
    }
    return ErrorService.instance;
  }
  /**
   * Handle API errors with proper logging and user-friendly messages
   */
  public handleApiError(error: any): ApiError {
    // Debug logging to understand error structure
    if (this.enableLogging) {
      console.error('DEBUG - Raw error object:', {
        errorType: error.constructor.name,
        message: error.message,
        response: error.response,
        responseStatus: error.response?.status,
        responseData: error.response?.data,
        hasResponse: !!error.response,
        request: !!error.request,
        config: error.config
      });
    }

    // Handle MSW error structure (used in tests)
    // MSW errors have the error message in error.data.message instead of error.response.data.message
    if (error.data && error.data.message && !error.response) {
      const apiError: ApiError = {
        status: error.status || 500,
        message: error.data.message,
        code: error.data?.code || 'TEST_ERROR',
        details: this.enableLogging ? error.data : undefined,
        timestamp: new Date().toISOString()
      };

      if (this.enableLogging) {
        console.error('API Error (MSW):', apiError);
      }

      return apiError;
    }

    const apiError: ApiError = {
      status: error.response?.status || 500,
      message: this.getUserFriendlyMessage(error),
      code: error.response?.data?.code || 'UNKNOWN_ERROR',
      details: this.enableLogging ? error.response?.data : undefined,
      timestamp: new Date().toISOString()
    };

    if (this.enableLogging) {
      console.error('API Error:', {
        status: apiError.status,
        message: apiError.message,
        code: apiError.code,
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        details: error.response?.data,
        stack: error.stack
      });
    }

    return apiError;
  }

  /**
   * Handle WebSocket errors
   */
  public handleWebSocketError(error: any, context?: string): void {
    if (this.enableLogging) {
      console.error('WebSocket Error:', {
        context,
        error: error.message || error,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle validation errors
   */
  public handleValidationErrors(errors: ValidationError[]): string {
    const messages = errors.map(error => `${error.field}: ${error.message}`);
    
    if (this.enableLogging) {
      console.warn('Validation Errors:', errors);
    }
    
    return messages.join(', ');
  }

  /**
   * Log general errors with context
   */
  public logError(error: Error, context?: string): void {
    if (this.enableLogging) {
      console.error('Application Error:', {
        context,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    }

    // In production, you might want to send errors to an external service
    if (appConfig.environment === 'production' && appConfig.features.enableErrorReporting) {
      this.reportError(error, context);
    }
  }

  /**
   * Log warnings
   */
  public logWarning(message: string, context?: any): void {
    if (this.enableLogging) {
      console.warn('Warning:', {
        message,
        context,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log info messages
   */
  public logInfo(message: string, context?: any): void {
    if (this.enableLogging) {
      console.info('Info:', {
        message,
        context,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check if error is network-related
   */
  public isNetworkError(error: any): boolean {
    // Standard Axios error
    if (!error.response && error.request) {
      return true;
    }
    // MSW error
    if (!error.response && error.status === undefined) {
      return true;
    }
    return false;
  }

  /**
   * Check if error is due to authentication failure
   */
  public isAuthError(error: any): boolean {
    // Standard Axios error
    if (error.response?.status === 401 || error.response?.status === 403) {
      return true;
    }
    // MSW error
    if (error.status === 401 || error.status === 403) {
      return true;
    }
    return false;
  }

  /**
   * Check if error is due to rate limiting
   */
  public isRateLimitError(error: any): boolean {
    // Standard Axios error
    if (error.response?.status === 429) {
      return true;
    }
    // MSW error
    if (error.status === 429) {
      return true;
    }
    return false;
  }

  /**
   * Check if error is a server error
   */
  public isServerError(error: any): boolean {
    // Standard Axios error
    if (error.response?.status >= 500) {
      return true;
    }
    // MSW error
    if (error.status && error.status >= 500) {
      return true;
    }
    return false;
  }

  /**
   * Get recovery suggestions based on error type
   */
  public getRecoverySuggestion(error: any): string {
    if (this.isNetworkError(error)) {
      return 'Please check your internet connection and try again.';
    }
    
    if (this.isAuthError(error)) {
      return 'Please log in again to continue.';
    }
    
    if (this.isRateLimitError(error)) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    
    if (this.isServerError(error)) {
      return 'Server error occurred. Please try again later.';
    }
    
    return 'An error occurred. Please try again.';
  }

  /**
   * Convert technical errors to user-friendly messages
   */
  private getUserFriendlyMessage(error: any): string {
    // Check for MSW error structure first (used in tests)
    if (error.data && error.data.message) {
      return error.data.message;
    }
    
    // Standard Axios error structure
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (this.isNetworkError(error)) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    switch (error.response?.status || error.status) {
      case 400:
        return 'Invalid request. Please check your input and try again.';
      case 401:
        return 'Authentication required. Please log in.';
      case 403:
        return 'Access denied. You don\'t have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'Conflict occurred. The resource already exists or is in use.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 429:
        return 'Too many requests. Please wait before trying again.';
      case 500:
        return 'Server error occurred. Please try again later.';
      case 502:
        return 'Service temporarily unavailable. Please try again later.';
      case 503:
        return 'Service is currently under maintenance. Please try again later.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Report errors to external service (placeholder for production)
   */
  private reportError(error: Error, context?: string): void {
    // Placeholder for external error reporting service
    // In production, you would integrate with services like Sentry, LogRocket, etc.
    console.log('Error reported to external service:', {
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Generic error handler (convenience method)
   */
  public handleError(error: any): void {
    if (this.isNetworkError(error)) {
      this.logError(error, 'Network Error');
    } else if (this.isAuthError(error)) {
      this.logError(error, 'Authentication Error');
    } else if (this.isServerError(error)) {
      this.logError(error, 'Server Error');
    } else {
      this.logError(error, 'Unknown Error');
    }
  }
}

// Export singleton instance  
export default ErrorService.getInstance();

// Named export for compatibility
export const errorService = ErrorService.getInstance();
