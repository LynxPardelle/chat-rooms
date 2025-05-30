import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosError } from 'axios';
import { appConfig } from '../config/app.config';
import { StorageService } from './storage.service';
import { ErrorService } from './error.service';
import type {
  ApiRequestConfig,
  RetryConfig,
  RequestInterceptor,
  ResponseInterceptor,
  ApiError,
  RefreshTokenResponse
} from '../types/enhanced-api.types';

/**
 * Enterprise-grade API service with retry logic, interceptors, and error handling
 * Integrates with JWT authentication and WebSocket services
 */
export class ApiService {
  private static _instance: ApiService;
  private _axios: AxiosInstance;
  private _storageService: StorageService;
  private _errorService: ErrorService;
  private _isRefreshing = false;
  private _failedQueue: Array<{
    resolve: (value: string) => void;
    reject: (error: any) => void;
  }> = [];

  private constructor() {    this._storageService = StorageService.getInstance();
    this._errorService = ErrorService.getInstance();
    
    this._axios = axios.create({
      baseURL: appConfig.api.baseUrl,
      timeout: appConfig.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this._setupInterceptors();
  }

  public static getInstance(): ApiService {
    if (!ApiService._instance) {
      ApiService._instance = new ApiService();
    }
    return ApiService._instance;
  }

  /**
   * Setup request and response interceptors
   */
  private _setupInterceptors(): void {
    // Request interceptor for auth and logging
    this._axios.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = this._storageService.getSecure('accessToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracking
        const requestId = this._generateRequestId();
        config.headers['X-Request-ID'] = requestId;        // Log request in development
        if (appConfig.features.enableLogging) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            requestId,
            data: config.data,
            params: config.params
          });
        }

        return config;
      },
      (error) => {
        this._errorService.handleError(error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and token refresh
    this._axios.interceptors.response.use(
      (response) => {        // Log successful response in development
        if (appConfig.features.enableLogging) {
          console.log(`[API Response] ${response.status} ${response.config.url}`, {
            requestId: response.config.headers['X-Request-ID'],
            data: response.data
          });
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };        // Handle 401 errors with token refresh (but exclude auth endpoints)
        const isAuthEndpoint = originalRequest.url?.includes('/auth/');
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          if (this._isRefreshing) {
            return this._queueRequest(originalRequest);
          }

          originalRequest._retry = true;
          this._isRefreshing = true;

          try {
            const newToken = await this._refreshToken();
            this._processQueue(newToken, null);
            
            // Retry original request with new token
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this._axios(originalRequest);
          } catch (refreshError) {
            this._processQueue(null, refreshError);
            this._handleAuthenticationFailure();
            throw refreshError;
          } finally {
            this._isRefreshing = false;
          }
        }

        // Handle other errors
        this._errorService.handleError(error);
        return Promise.reject(this._createApiError(error));
      }
    );
  }

  /**
   * Refresh JWT token
   */
  private async _refreshToken(): Promise<string> {
    const refreshToken = this._storageService.getSecure('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {      const response = await axios.post<RefreshTokenResponse>(
        `${appConfig.api.baseUrl}/auth/refresh`,
        { refreshToken },
        { timeout: appConfig.api.timeout }
      );

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      
      this._storageService.setSecure('accessToken', accessToken);
      if (newRefreshToken) {
        this._storageService.setSecure('refreshToken', newRefreshToken);
      }

      return accessToken;
    } catch (error) {
      this._storageService.removeSecure('accessToken');
      this._storageService.removeSecure('refreshToken');
      throw error;
    }
  }

  /**
   * Queue failed requests during token refresh
   */
  private _queueRequest(config: AxiosRequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      this._failedQueue.push({ resolve, reject });
    }).then((token) => {
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return this._axios(config);
    });
  }

  /**
   * Process queued requests after token refresh
   */
  private _processQueue(token: string | null, error: any): void {
    this._failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token!);
      }
    });

    this._failedQueue = [];
  }

  /**
   * Handle authentication failure
   */
  private _handleAuthenticationFailure(): void {
    this._storageService.clearAll();
    
    // Emit auth failure event
    window.dispatchEvent(new CustomEvent('auth:failure'));
    
    // Redirect to login if not already there
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  /**
   * Generate unique request ID
   */
  private _generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized API error
   */
  private _createApiError(error: AxiosError): ApiError {
    return {
      message: error.message,
      status: error.response?.status,
      code: error.code,
      data: error.response?.data,
      timestamp: new Date().toISOString(),
      requestId: error.config?.headers?.['X-Request-ID'] as string
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  private async _requestWithRetry<T>(
    config: AxiosRequestConfig,
    retryConfig?: RetryConfig
  ): Promise<T> {    const {
      retries = appConfig.api.retryAttempts,
      retryDelay = appConfig.api.retryDelay,
      retryCondition = (error: AxiosError) => {
        return !error.response || error.response.status >= 500;
      }
    } = retryConfig || {};

    let lastError: AxiosError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this._axios.request<T>(config);
        return response.data;
      } catch (error) {
        lastError = error as AxiosError;

        if (attempt === retries || !retryCondition(lastError)) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  // Public HTTP methods with retry logic
  public async get<T = any>(
    url: string, 
    config?: ApiRequestConfig
  ): Promise<T> {
    return this._requestWithRetry<T>({ ...config, method: 'GET', url }, config?.retry);
  }

  public async post<T = any, D = any>(
    url: string, 
    data?: D, 
    config?: ApiRequestConfig
  ): Promise<T> {
    return this._requestWithRetry<T>({ ...config, method: 'POST', url, data }, config?.retry);
  }

  public async put<T = any, D = any>(
    url: string, 
    data?: D, 
    config?: ApiRequestConfig
  ): Promise<T> {
    return this._requestWithRetry<T>({ ...config, method: 'PUT', url, data }, config?.retry);
  }

  public async patch<T = any, D = any>(
    url: string, 
    data?: D, 
    config?: ApiRequestConfig
  ): Promise<T> {
    return this._requestWithRetry<T>({ ...config, method: 'PATCH', url, data }, config?.retry);
  }

  public async delete<T = any>(
    url: string, 
    config?: ApiRequestConfig
  ): Promise<T> {
    return this._requestWithRetry<T>({ ...config, method: 'DELETE', url }, config?.retry);
  }

  /**
   * Upload file with progress tracking
   */
  public async uploadFile<T = any>(
    url: string,
    file: File,
    options?: {
      onProgress?: (progress: number) => void;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (options?.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        formData.append(key, JSON.stringify(value));
      });
    }

    return this._requestWithRetry<T>({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (options?.onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          options.onProgress(progress);
        }
      },
    });
  }

  /**
   * Add custom request interceptor
   */
  public addRequestInterceptor(interceptor: RequestInterceptor): number {
    return this._axios.interceptors.request.use(
      interceptor.onFulfilled,
      interceptor.onRejected
    );
  }

  /**
   * Add custom response interceptor
   */
  public addResponseInterceptor(interceptor: ResponseInterceptor): number {
    return this._axios.interceptors.response.use(
      interceptor.onFulfilled,
      interceptor.onRejected
    );
  }

  /**
   * Remove interceptor
   */
  public removeInterceptor(type: 'request' | 'response', id: number): void {
    if (type === 'request') {
      this._axios.interceptors.request.eject(id);
    } else {
      this._axios.interceptors.response.eject(id);
    }
  }

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(): void {    // Create new axios instance to cancel all pending requests
    this._axios = axios.create({
      baseURL: appConfig.api.baseUrl,
      timeout: appConfig.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    
    this._setupInterceptors();
  }

  /**
   * Get current axios instance for advanced usage
   */
  public getAxiosInstance(): AxiosInstance {
    return this._axios;
  }
}

// Export singleton instance
export default ApiService.getInstance();
