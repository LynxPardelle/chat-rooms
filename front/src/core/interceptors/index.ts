import type { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { appConfig } from '../config/app.config';
import { ErrorService } from '../services/error.service';

/**
 * Authentication interceptor for adding JWT tokens to requests
 */
export class AuthInterceptor {
  public static request(config: AxiosRequestConfig): AxiosRequestConfig {
    // Token is handled in ApiService, this interceptor can be used for additional auth logic
    
    if (appConfig.features.enableLogging) {
      console.log(`[Auth Interceptor] Processing request to ${config.url}`);
    }

    return config;
  }

  public static responseError(error: AxiosError): Promise<never> {
    if (error.response?.status === 401) {
      // Emit custom event for 401 errors
      window.dispatchEvent(new CustomEvent('auth:interceptor-401', {
        detail: { error, url: error.config?.url }
      }));
    }

    return Promise.reject(error);
  }
}

/**
 * Logging interceptor for request/response monitoring
 */
export class LoggingInterceptor {
  private static requestStartTimes = new Map<string, number>();

  public static request(config: AxiosRequestConfig): AxiosRequestConfig {
    if (!appConfig.features.enableLogging) {
      return config;
    }

    const requestId = config.headers?.['X-Request-ID'] as string;
    if (requestId) {
      LoggingInterceptor.requestStartTimes.set(requestId, Date.now());
    }

    console.log(`[HTTP] → ${config.method?.toUpperCase()} ${config.url}`, {
      requestId,
      data: config.data,
      params: config.params,
      headers: config.headers
    });

    return config;
  }

  public static response(response: AxiosResponse): AxiosResponse {
    if (!appConfig.features.enableLogging) {
      return response;
    }

    const requestId = response.config.headers?.['X-Request-ID'] as string;
    const startTime = LoggingInterceptor.requestStartTimes.get(requestId);
    const duration = startTime ? Date.now() - startTime : 0;

    if (requestId) {
      LoggingInterceptor.requestStartTimes.delete(requestId);
    }

    console.log(`[HTTP] ← ${response.status} ${response.config.url}`, {
      requestId,
      duration: `${duration}ms`,
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    return response;
  }

  public static responseError(error: AxiosError): Promise<never> {
    if (!appConfig.features.enableLogging) {
      return Promise.reject(error);
    }

    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    const startTime = requestId ? LoggingInterceptor.requestStartTimes.get(requestId) : undefined;
    const duration = startTime ? Date.now() - startTime : 0;

    if (requestId) {
      LoggingInterceptor.requestStartTimes.delete(requestId);
    }

    console.error(`[HTTP] ✗ ${error.response?.status || 'Network Error'} ${error.config?.url}`, {
      requestId,
      duration: `${duration}ms`,
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.message,
      data: error.response?.data
    });

    return Promise.reject(error);
  }
}

/**
 * Retry interceptor for handling failed requests with exponential backoff
 */
export class RetryInterceptor {
  private static errorService = ErrorService.getInstance();

  public static responseError(error: AxiosError): Promise<AxiosResponse> | Promise<never> {
    const config = error.config as AxiosRequestConfig & { 
      _retryCount?: number; 
      _retryConfig?: { 
        retries: number; 
        retryDelay: number; 
        retryCondition: (error: AxiosError) => boolean; 
      }; 
    };

    // Check if retry is configured and allowed
    const retryConfig = config._retryConfig;
    if (!retryConfig || !retryConfig.retryCondition(error)) {
      return Promise.reject(error);
    }

    const retryCount = config._retryCount || 0;
    if (retryCount >= retryConfig.retries) {
      RetryInterceptor.errorService.handleError(
        new Error(`Request failed after ${retryCount} retries: ${error.message}`)
      );
      return Promise.reject(error);
    }

    // Increment retry count
    config._retryCount = retryCount + 1;

    // Calculate delay with exponential backoff
    const delay = retryConfig.retryDelay * Math.pow(2, retryCount);

    if (appConfig.features.enableLogging) {
      console.log(`[Retry Interceptor] Retrying request to ${config.url} in ${delay}ms (attempt ${config._retryCount})`);
    }

    // Return promise that resolves after delay
    return new Promise((resolve) => {
      setTimeout(() => {
        // Import axios dynamically to avoid circular dependency
        import('axios').then(({ default: axios }) => {
          resolve(axios(config));
        });
      }, delay);
    });
  }
}

/**
 * Performance monitoring interceptor
 */
export class PerformanceInterceptor {
  private static readonly performanceData = new Map<string, {
    startTime: number;
    endpoint: string;
    method: string;
  }>();

  public static request(config: AxiosRequestConfig): AxiosRequestConfig {
    if (!appConfig.features.enablePerformanceMonitoring) {
      return config;
    }

    const requestId = config.headers?.['X-Request-ID'] as string;
    if (requestId) {
      PerformanceInterceptor.performanceData.set(requestId, {
        startTime: performance.now(),
        endpoint: config.url || '',
        method: config.method?.toUpperCase() || 'GET'
      });
    }

    return config;
  }

  public static response(response: AxiosResponse): AxiosResponse {
    if (!appConfig.features.enablePerformanceMonitoring) {
      return response;
    }

    PerformanceInterceptor.recordMetrics(response.config.headers?.['X-Request-ID'] as string, {
      success: true,
      statusCode: response.status,
      responseSize: JSON.stringify(response.data).length
    });

    return response;
  }

  public static responseError(error: AxiosError): Promise<never> {
    if (appConfig.features.enablePerformanceMonitoring) {
      PerformanceInterceptor.recordMetrics(error.config?.headers?.['X-Request-ID'] as string, {
        success: false,
        statusCode: error.response?.status || 0,
        responseSize: error.response?.data ? JSON.stringify(error.response.data).length : 0
      });
    }

    return Promise.reject(error);
  }

  private static recordMetrics(requestId: string, metrics: {
    success: boolean;
    statusCode: number;
    responseSize: number;
  }): void {
    if (!requestId) return;

    const requestData = PerformanceInterceptor.performanceData.get(requestId);
    if (!requestData) return;

    const duration = performance.now() - requestData.startTime;
    
    const performanceMetric = {
      requestDuration: duration,
      responseSize: metrics.responseSize,
      timestamp: new Date(),
      endpoint: requestData.endpoint,
      method: requestData.method as any,
      statusCode: metrics.statusCode,
      success: metrics.success
    };

    // Emit performance metric event
    window.dispatchEvent(new CustomEvent('performance:metric', {
      detail: performanceMetric
    }));

    // Log performance data in development
    if (appConfig.features.enableLogging) {
      console.log(`[Performance] ${requestData.method} ${requestData.endpoint}`, {
        duration: `${duration.toFixed(2)}ms`,
        size: `${(metrics.responseSize / 1024).toFixed(2)}KB`,
        status: metrics.statusCode,
        success: metrics.success
      });
    }

    // Clean up
    PerformanceInterceptor.performanceData.delete(requestId);
  }
}

/**
 * Security interceptor for additional security headers and validation
 */
export class SecurityInterceptor {
  private static readonly BLOCKED_HEADERS = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-csrf-token'
  ];

  public static request(config: AxiosRequestConfig): AxiosRequestConfig {
    // Add security headers
    if (!config.headers) {
      config.headers = {};
    }

    // Add CSRF protection for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    // Add security headers
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    config.headers['Cache-Control'] = 'no-cache';

    return config;
  }

  public static response(response: AxiosResponse): AxiosResponse {
    // Validate response headers for security
    SecurityInterceptor.validateResponseHeaders(response);
    
    // Log potential security issues
    if (appConfig.features.enableLogging) {
      SecurityInterceptor.logSecurityInfo(response);
    }

    return response;
  }

  private static validateResponseHeaders(response: AxiosResponse): void {
    const headers = response.headers;
    
    // Check for sensitive data exposure
    const blockedHeaders = SecurityInterceptor.BLOCKED_HEADERS.filter(header => 
      Object.keys(headers).some(key => key.toLowerCase() === header)
    );

    if (blockedHeaders.length > 0) {
      console.warn('[Security] Potentially sensitive headers detected:', blockedHeaders);
    }

    // Validate Content-Type
    const contentType = headers['content-type'];
    if (contentType && !contentType.includes('application/json') && response.config.url?.includes('/api/')) {
      console.warn('[Security] Unexpected content type for API response:', contentType);
    }
  }

  private static logSecurityInfo(response: AxiosResponse): void {
    const securityHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy'
    ];

    const presentHeaders = securityHeaders.filter(header => 
      response.headers[header]
    );

    if (presentHeaders.length > 0) {
      console.log(`[Security] Security headers present: ${presentHeaders.join(', ')}`);
    }
  }
}
