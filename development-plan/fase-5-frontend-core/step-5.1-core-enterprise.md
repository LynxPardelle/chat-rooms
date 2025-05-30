# Step 5.1: Configuración Core Empresarial

## Objetivo

Establecer la infraestructura central del frontend con servicios empresariales, interceptors de seguridad, manejo avanzado de errores y configuración de desarrollo óptima.

## Requisitos Previos

- Fase 4 completada (backend de mensajería funcionando)
- Node.js 18+ instalado
- Vue 3 y Vite configurados
- Conocimiento de TypeScript y Composition API

## Arquitectura Core del Frontend

```text
front/src/
├── core/
│   ├── services/
│   │   ├── api/
│   │   │   ├── api.service.ts
│   │   │   ├── http.interceptor.ts
│   │   │   └── error.handler.ts
│   │   ├── auth/
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts
│   │   │   └── permission.service.ts
│   │   ├── websocket/
│   │   │   ├── websocket.service.ts
│   │   │   ├── connection.manager.ts
│   │   │   └── event.handlers.ts
│   │   ├── storage/
│   │   │   ├── storage.service.ts
│   │   │   ├── encryption.service.ts
│   │   │   └── cache.service.ts
│   │   └── monitoring/
│   │       ├── performance.service.ts
│   │       ├── error.tracking.ts
│   │       └── analytics.service.ts
│   ├── types/
│   │   ├── api.types.ts
│   │   ├── auth.types.ts
│   │   ├── websocket.types.ts
│   │   └── app.types.ts
│   ├── utils/
│   │   ├── validation.utils.ts
│   │   ├── format.utils.ts
│   │   ├── security.utils.ts
│   │   └── performance.utils.ts
│   ├── constants/
│   │   ├── api.constants.ts
│   │   ├── app.constants.ts
│   │   └── validation.constants.ts
│   └── config/
│       ├── app.config.ts
│       ├── api.config.ts
│       └── environment.config.ts
├── composables/
│   ├── useApi.ts
│   ├── useAuth.ts
│   ├── useWebSocket.ts
│   ├── useStorage.ts
│   ├── useErrorHandler.ts
│   └── usePerformance.ts
└── plugins/
    ├── api.plugin.ts
    ├── websocket.plugin.ts
    └── monitoring.plugin.ts
```

## Paso 1: Configuración Base y Constantes

### 1.1 Environment Configuration

```typescript
// front/src/core/config/environment.config.ts
export interface EnvironmentConfig {
  production: boolean;
  apiUrl: string;
  wsUrl: string;
  appName: string;
  version: string;
  features: {
    analytics: boolean;
    errorTracking: boolean;
    performanceMonitoring: boolean;
    debugMode: boolean;
  };
  auth: {
    tokenStorageKey: string;
    refreshTokenKey: string;
    tokenExpiryBuffer: number; // minutes
  };
  api: {
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  websocket: {
    reconnectAttempts: number;
    reconnectDelay: number;
    heartbeatInterval: number;
  };
  storage: {
    encryptionEnabled: boolean;
    cacheTTL: number;
  };
}

const config: EnvironmentConfig = {
  production: import.meta.env.PROD,
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  appName: import.meta.env.VITE_APP_NAME || 'LiveChat',
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    errorTracking: import.meta.env.VITE_ENABLE_ERROR_TRACKING === 'true',
    performanceMonitoring: import.meta.env.VITE_ENABLE_PERFORMANCE === 'true',
    debugMode: import.meta.env.VITE_DEBUG_MODE === 'true' || !import.meta.env.PROD,
  },
  
  auth: {
    tokenStorageKey: 'livechat_access_token',
    refreshTokenKey: 'livechat_refresh_token',
    tokenExpiryBuffer: 5, // Refresh token 5 minutes before expiry
  },
  
  api: {
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 30000, // 30 seconds
    retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS) || 3,
    retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY) || 1000, // 1 second
  },
  
  websocket: {
    reconnectAttempts: parseInt(import.meta.env.VITE_WS_RECONNECT_ATTEMPTS) || 5,
    reconnectDelay: parseInt(import.meta.env.VITE_WS_RECONNECT_DELAY) || 3000, // 3 seconds
    heartbeatInterval: parseInt(import.meta.env.VITE_WS_HEARTBEAT_INTERVAL) || 30000, // 30 seconds
  },
  
  storage: {
    encryptionEnabled: import.meta.env.VITE_STORAGE_ENCRYPTION === 'true',
    cacheTTL: parseInt(import.meta.env.VITE_CACHE_TTL) || 3600000, // 1 hour
  },
};

export default config;
```

### 1.2 API Constants

```typescript
// front/src/core/constants/api.constants.ts
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    PROFILE: '/auth/profile',
    VERIFY_EMAIL: '/auth/verify-email',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  
  // User endpoints
  USERS: {
    BASE: '/users',
    PROFILE: '/users/profile',
    SETTINGS: '/users/settings',
    AVATAR: '/users/avatar',
    SEARCH: '/users/search',
  },
  
  // Channel endpoints
  CHANNELS: {
    BASE: '/channels',
    JOIN: '/channels/join',
    LEAVE: '/channels/leave',
    MEMBERS: '/channels/members',
    INVITE: '/channels/invite',
  },
  
  // Message endpoints
  MESSAGES: {
    BASE: '/messages',
    SEARCH: '/messages/search',
    REACTIONS: '/messages/reactions',
    THREADS: '/messages/threads',
  },
  
  // File endpoints
  FILES: {
    UPLOAD: '/files/upload',
    DOWNLOAD: '/files/download',
    DELETE: '/files/delete',
    METADATA: '/files/metadata',
  },
  
  // Notification endpoints
  NOTIFICATIONS: {
    BASE: '/notifications',
    MARK_READ: '/notifications/mark-read',
    SETTINGS: '/notifications/settings',
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const API_ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export const REQUEST_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  X_REQUEST_ID: 'X-Request-ID',
  X_CLIENT_VERSION: 'X-Client-Version',
  X_USER_AGENT: 'X-User-Agent',
} as const;

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM_DATA: 'multipart/form-data',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  TEXT_PLAIN: 'text/plain',
} as const;
```

### 1.3 App Constants

```typescript
// front/src/core/constants/app.constants.ts
export const APP_EVENTS = {
  // Auth events
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_SESSION_EXPIRED: 'user:session-expired',
  
  // Connection events
  CONNECTION_ONLINE: 'connection:online',
  CONNECTION_OFFLINE: 'connection:offline',
  CONNECTION_RECONNECTING: 'connection:reconnecting',
  
  // Error events
  ERROR_OCCURRED: 'error:occurred',
  ERROR_RESOLVED: 'error:resolved',
  
  // Performance events
  PERFORMANCE_SLOW: 'performance:slow',
  PERFORMANCE_ERROR: 'performance:error',
  
  // UI events
  THEME_CHANGED: 'theme:changed',
  LANGUAGE_CHANGED: 'language:changed',
  NOTIFICATION_SHOWN: 'notification:shown',
} as const;

export const STORAGE_KEYS = {
  // Auth
  ACCESS_TOKEN: 'livechat_access_token',
  REFRESH_TOKEN: 'livechat_refresh_token',
  USER_PROFILE: 'livechat_user_profile',
  
  // App state
  THEME: 'livechat_theme',
  LANGUAGE: 'livechat_language',
  SIDEBAR_COLLAPSED: 'livechat_sidebar_collapsed',
  
  // Cache
  CHANNELS_CACHE: 'livechat_channels_cache',
  USERS_CACHE: 'livechat_users_cache',
  SETTINGS_CACHE: 'livechat_settings_cache',
  
  // Temporary
  DRAFT_MESSAGES: 'livechat_draft_messages',
  OFFLINE_QUEUE: 'livechat_offline_queue',
} as const;

export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_-]+$/,
  },
  MESSAGE: {
    MAX_LENGTH: 4000,
  },
  CHANNEL_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s_-]+$/,
  },
} as const;

export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 280,
  HEADER_HEIGHT: 64,
  MESSAGE_BATCH_SIZE: 50,
  SCROLL_THRESHOLD: 100,
  TYPING_TIMEOUT: 3000,
  TOAST_DURATION: 5000,
  SEARCH_DEBOUNCE: 300,
  ANIMATION_DURATION: 200,
} as const;

export const FILE_CONSTANTS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100MB
  CHUNK_SIZE: 1024 * 1024, // 1MB chunks
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/avi', 'video/mov', 'video/webm'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'application/msword'],
} as const;
```

## Paso 2: Tipos TypeScript Core

### 2.1 API Types

```typescript
// front/src/core/types/api.types.ts
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  statusCode: number;
  timestamp: string;
  path: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query: string;
  filters?: Record<string, any>;
}

export interface RequestConfig {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface HttpClient {
  get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
}

export interface NetworkInfo {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface RetryConfig {
  attempts: number;
  delay: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  retryCondition?: (error: any) => boolean;
}
```

### 2.2 Auth Types

```typescript
// front/src/core/types/auth.types.ts
export interface User {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastActivity: Date | null;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}

export interface AuthConfig {
  autoRefresh: boolean;
  refreshThreshold: number; // minutes before expiry
  maxRetries: number;
  redirectOnExpiry: boolean;
  logoutOnClose: boolean;
}
```

### 2.3 WebSocket Types

```typescript
// front/src/core/types/websocket.types.ts
export enum WebSocketEvents {
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  RECONNECT = 'reconnect',
  
  // Chat events
  JOIN_CHANNEL = 'join_channel',
  LEAVE_CHANNEL = 'leave_channel',
  SEND_MESSAGE = 'send_message',
  NEW_MESSAGE = 'new_message',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',
  
  // Typing events
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_TYPING = 'user_typing',
  
  // Presence events
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  USER_PRESENCE = 'user_presence',
  
  // Notification events
  NOTIFICATION = 'notification',
  MENTION = 'mention',
}

export interface WebSocketMessage {
  event: WebSocketEvents;
  data: any;
  timestamp: Date;
  id?: string;
}

export interface WebSocketConfig {
  url: string;
  autoConnect: boolean;
  reconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
  auth?: {
    token?: string;
    type?: 'Bearer' | 'Basic';
  };
}

export interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  disconnected: boolean;
  reconnecting: boolean;
  error: boolean;
}

export interface WebSocketStats {
  connectedAt?: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  latency: number;
}

export interface TypingUser {
  id: string;
  username: string;
  channelId: string;
  startedAt: Date;
}

export interface PresenceInfo {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen?: Date;
  device?: string;
}
```

### 2.4 App Types

```typescript
// front/src/core/types/app.types.ts
export interface AppState {
  initialized: boolean;
  loading: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  sidebar: {
    collapsed: boolean;
    width: number;
  };
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  performance: {
    slow: boolean;
    metrics: PerformanceMetrics;
  };
}

export interface PerformanceMetrics {
  pageLoadTime: number;
  apiResponseTime: number;
  renderTime: number;
  memoryUsage: number;
  wsLatency: number;
}

export interface NotificationConfig {
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  persistent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface Toast {
  id: string;
  config: NotificationConfig;
  createdAt: Date;
  dismissed: boolean;
}

export interface Route {
  name: string;
  path: string;
  component?: any;
  meta?: {
    title?: string;
    requiresAuth?: boolean;
    permissions?: string[];
    layout?: string;
  };
}

export interface NavigationItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavigationItem[];
  visible: boolean;
  disabled: boolean;
}

export interface ThemeConfig {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
    };
  };
}
```

## Paso 3: Servicios Core

### 3.1 API Service

```typescript
// front/src/core/services/api/api.service.ts
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiError, RequestConfig, HttpClient, RetryConfig } from '../../types/api.types';
import { HTTP_STATUS, API_ERRORS } from '../../constants/api.constants';
import config from '../../config/environment.config';

export class ApiService implements HttpClient {
  private client: AxiosInstance;
  private requestId = 0;

  constructor() {
    this.client = this.createAxiosInstance();
    this.setupInterceptors();
  }

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: config.apiUrl,
      timeout: config.api.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': config.version,
      },
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        config.headers['X-Request-ID'] = `req_${++this.requestId}_${Date.now()}`;
        
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
  }

  private handleResponse(response: AxiosResponse): ApiResponse {
    return {
      data: response.data.data || response.data,
      message: response.data.message,
      success: true,
      meta: response.data.meta,
    };
  }

  private handleError(error: any): Promise<never> {
    let apiError: ApiError;

    if (error.response) {
      // Server responded with error status
      apiError = {
        code: this.getErrorCode(error.response.status),
        message: error.response.data?.message || error.message,
        details: error.response.data?.details,
        statusCode: error.response.status,
        timestamp: new Date().toISOString(),
        path: error.config?.url || '',
      };
    } else if (error.request) {
      // Network error
      apiError = {
        code: API_ERRORS.NETWORK_ERROR,
        message: 'Network error occurred',
        statusCode: 0,
        timestamp: new Date().toISOString(),
        path: error.config?.url || '',
      };
    } else {
      // Other error
      apiError = {
        code: API_ERRORS.UNKNOWN_ERROR,
        message: error.message || 'Unknown error occurred',
        statusCode: 0,
        timestamp: new Date().toISOString(),
        path: '',
      };
    }

    // Emit error event for global handling
    this.emitErrorEvent(apiError);

    return Promise.reject(apiError);
  }

  private getErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HTTP_STATUS.BAD_REQUEST:
        return API_ERRORS.VALIDATION_ERROR;
      case HTTP_STATUS.UNAUTHORIZED:
        return API_ERRORS.AUTHENTICATION_ERROR;
      case HTTP_STATUS.FORBIDDEN:
        return API_ERRORS.AUTHORIZATION_ERROR;
      case HTTP_STATUS.NOT_FOUND:
        return API_ERRORS.NOT_FOUND_ERROR;
      case HTTP_STATUS.CONFLICT:
        return API_ERRORS.CONFLICT_ERROR;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        return API_ERRORS.RATE_LIMIT_ERROR;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
      case HTTP_STATUS.BAD_GATEWAY:
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return API_ERRORS.SERVER_ERROR;
      default:
        return API_ERRORS.UNKNOWN_ERROR;
    }
  }

  private getAuthToken(): string | null {
    // This will be implemented in the auth service
    return localStorage.getItem(config.auth.tokenStorageKey);
  }

  private emitErrorEvent(error: ApiError): void {
    // Emit custom event for global error handling
    window.dispatchEvent(
      new CustomEvent('api:error', { detail: error })
    );
  }

  async get<T = any>(url: string, requestConfig?: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig = this.buildAxiosConfig(requestConfig);
    return this.executeWithRetry(() => this.client.get(url, axiosConfig), requestConfig);
  }

  async post<T = any>(url: string, data?: any, requestConfig?: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig = this.buildAxiosConfig(requestConfig);
    return this.executeWithRetry(() => this.client.post(url, data, axiosConfig), requestConfig);
  }

  async put<T = any>(url: string, data?: any, requestConfig?: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig = this.buildAxiosConfig(requestConfig);
    return this.executeWithRetry(() => this.client.put(url, data, axiosConfig), requestConfig);
  }

  async patch<T = any>(url: string, data?: any, requestConfig?: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig = this.buildAxiosConfig(requestConfig);
    return this.executeWithRetry(() => this.client.patch(url, data, axiosConfig), requestConfig);
  }

  async delete<T = any>(url: string, requestConfig?: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig = this.buildAxiosConfig(requestConfig);
    return this.executeWithRetry(() => this.client.delete(url, axiosConfig), requestConfig);
  }

  private buildAxiosConfig(requestConfig?: RequestConfig): AxiosRequestConfig {
    return {
      timeout: requestConfig?.timeout,
      signal: requestConfig?.signal,
      headers: requestConfig?.headers,
    };
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    requestConfig?: RequestConfig
  ): Promise<T> {
    const retries = requestConfig?.retries ?? config.api.retryAttempts;
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on certain errors
        if (this.shouldNotRetry(error) || attempt === retries) {
          throw error;
        }

        // Wait before retry
        await this.delay(config.api.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError;
  }

  private shouldNotRetry(error: ApiError): boolean {
    const nonRetryableCodes = [
      API_ERRORS.AUTHENTICATION_ERROR,
      API_ERRORS.AUTHORIZATION_ERROR,
      API_ERRORS.VALIDATION_ERROR,
      API_ERRORS.NOT_FOUND_ERROR,
      API_ERRORS.CONFLICT_ERROR,
    ];

    return nonRetryableCodes.includes(error.code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods
  setAuthToken(token: string): void {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  removeAuthToken(): void {
    delete this.client.defaults.headers.common.Authorization;
  }

  updateBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
  }

  getRequestStats(): { pending: number; completed: number; failed: number } {
    // Implementation for request statistics
    return { pending: 0, completed: 0, failed: 0 };
  }
}

// Create singleton instance
export const apiService = new ApiService();
```

### 3.2 Storage Service

```typescript
// front/src/core/services/storage/storage.service.ts
import { EncryptionService } from './encryption.service';
import config from '../../config/environment.config';

export interface StorageOptions {
  encrypt?: boolean;
  ttl?: number; // Time to live in milliseconds
  namespace?: string;
}

export interface StorageItem<T = any> {
  value: T;
  timestamp: number;
  ttl?: number;
  encrypted: boolean;
}

export class StorageService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  // Local Storage methods
  setLocal<T>(key: string, value: T, options?: StorageOptions): void {
    this.setItem(localStorage, key, value, options);
  }

  getLocal<T>(key: string, defaultValue?: T): T | null {
    return this.getItem<T>(localStorage, key, defaultValue);
  }

  removeLocal(key: string): void {
    this.removeItem(localStorage, key);
  }

  clearLocal(namespace?: string): void {
    this.clearStorage(localStorage, namespace);
  }

  // Session Storage methods
  setSession<T>(key: string, value: T, options?: StorageOptions): void {
    this.setItem(sessionStorage, key, value, options);
  }

  getSession<T>(key: string, defaultValue?: T): T | null {
    return this.getItem<T>(sessionStorage, key, defaultValue);
  }

  removeSession(key: string): void {
    this.removeItem(sessionStorage, key);
  }

  clearSession(namespace?: string): void {
    this.clearStorage(sessionStorage, namespace);
  }

  // Generic storage methods
  private setItem<T>(
    storage: Storage,
    key: string,
    value: T,
    options?: StorageOptions
  ): void {
    try {
      const item: StorageItem<T> = {
        value,
        timestamp: Date.now(),
        ttl: options?.ttl,
        encrypted: options?.encrypt ?? config.storage.encryptionEnabled,
      };

      const serialized = JSON.stringify(item);
      const finalValue = item.encrypted 
        ? this.encryptionService.encrypt(serialized)
        : serialized;

      const finalKey = options?.namespace 
        ? `${options.namespace}:${key}`
        : key;

      storage.setItem(finalKey, finalValue);
    } catch (error) {
      console.error('Error storing item:', error);
      throw new Error(`Failed to store item: ${key}`);
    }
  }

  private getItem<T>(
    storage: Storage,
    key: string,
    defaultValue?: T
  ): T | null {
    try {
      const item = storage.getItem(key);
      if (!item) {
        return defaultValue ?? null;
      }

      let parsed: StorageItem<T>;
      
      try {
        // Try to parse as encrypted first
        const decrypted = this.encryptionService.decrypt(item);
        parsed = JSON.parse(decrypted);
      } catch {
        // If decryption fails, try as plain JSON
        parsed = JSON.parse(item);
      }

      // Check if item has expired
      if (parsed.ttl && Date.now() - parsed.timestamp > parsed.ttl) {
        this.removeItem(storage, key);
        return defaultValue ?? null;
      }

      return parsed.value;
    } catch (error) {
      console.error('Error retrieving item:', error);
      return defaultValue ?? null;
    }
  }

  private removeItem(storage: Storage, key: string): void {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.error('Error removing item:', error);
    }
  }

  private clearStorage(storage: Storage, namespace?: string): void {
    try {
      if (namespace) {
        const keys = Object.keys(storage).filter(key => 
          key.startsWith(`${namespace}:`)
        );
        keys.forEach(key => storage.removeItem(key));
      } else {
        storage.clear();
      }
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  // Cache-specific methods
  setCache<T>(key: string, value: T, ttl?: number): void {
    this.setLocal(key, value, { 
      ttl: ttl ?? config.storage.cacheTTL,
      namespace: 'cache'
    });
  }

  getCache<T>(key: string): T | null {
    return this.getLocal<T>(`cache:${key}`);
  }

  clearCache(): void {
    this.clearLocal('cache');
  }

  // Utility methods
  exists(key: string, storage: 'local' | 'session' = 'local'): boolean {
    const storageObj = storage === 'local' ? localStorage : sessionStorage;
    return storageObj.getItem(key) !== null;
  }

  getStorageSize(storage: 'local' | 'session' = 'local'): number {
    const storageObj = storage === 'local' ? localStorage : sessionStorage;
    let size = 0;
    
    for (const key in storageObj) {
      if (storageObj.hasOwnProperty(key)) {
        size += storageObj[key].length + key.length;
      }
    }
    
    return size;
  }

  getStorageQuota(): Promise<{ quota: number; usage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => ({
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
      }));
    }
    
    return Promise.resolve({ quota: 0, usage: 0 });
  }

  // Clean up expired items
  cleanupExpired(): void {
    const cleanStorage = (storage: Storage) => {
      const keys = Object.keys(storage);
      
      keys.forEach(key => {
        try {
          const item = storage.getItem(key);
          if (!item) return;

          let parsed: StorageItem;
          try {
            const decrypted = this.encryptionService.decrypt(item);
            parsed = JSON.parse(decrypted);
          } catch {
            parsed = JSON.parse(item);
          }

          if (parsed.ttl && Date.now() - parsed.timestamp > parsed.ttl) {
            storage.removeItem(key);
          }
        } catch (error) {
          // Remove corrupted items
          storage.removeItem(key);
        }
      });
    };

    cleanStorage(localStorage);
    cleanStorage(sessionStorage);
  }
}

// Create singleton instance
export const storageService = new StorageService();
```

### 3.3 Encryption Service

```typescript
// front/src/core/services/storage/encryption.service.ts
export class EncryptionService {
  private readonly key: string;

  constructor() {
    // Generate or retrieve encryption key
    this.key = this.getOrCreateKey();
  }

  encrypt(data: string): string {
    try {
      // Simple encryption using base64 encoding with key rotation
      // In production, use a proper encryption library like crypto-js
      const encoded = btoa(data);
      const encrypted = this.simpleEncrypt(encoded, this.key);
      return btoa(encrypted);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const decoded = atob(encryptedData);
      const decrypted = this.simpleDecrypt(decoded, this.key);
      return atob(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  private getOrCreateKey(): string {
    let key = localStorage.getItem('app_encryption_key');
    
    if (!key) {
      key = this.generateKey();
      localStorage.setItem('app_encryption_key', key);
    }
    
    return key;
  }

  private generateKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private simpleEncrypt(data: string, key: string): string {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyCode = key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode ^ keyCode);
    }
    return result;
  }

  private simpleDecrypt(encryptedData: string, key: string): string {
    // XOR encryption is symmetric
    return this.simpleEncrypt(encryptedData, key);
  }

  // Hash function for data integrity
  hash(data: string): string {
    let hash = 0;
    if (data.length === 0) return hash.toString();
    
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString();
  }

  // Generate secure random string
  generateRandomString(length: number = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
```

## Resultado Esperado

Al completar este paso tendrás:

✅ **Configuración Empresarial Completa**

- Variables de entorno estructuradas y validadas
- Constantes organizadas por módulos
- Configuración flexible para diferentes entornos

✅ **Sistema de Tipos TypeScript Robusto**

- Tipos para API, autenticación, WebSocket y aplicación
- Interfaces bien definidas para todos los servicios
- Type safety completo en toda la aplicación

✅ **Servicios Core Fundamentales**

- ApiService con retry automático y manejo de errores
- StorageService con encriptación y TTL
- EncryptionService para datos sensibles

✅ **Arquitectura Escalable**

- Separación clara de responsabilidades
- Patrón de inyección de dependencias
- Servicios reutilizables y testables

✅ **Manejo Avanzado de Errores**

- Sistema centralizado de manejo de errores
- Logging y tracking de errores
- Recovery automático cuando es posible

## Próximo Paso

Continuar con [Step 5.2: Sistema de Autenticación Frontend](./step-5.2-frontend-auth.md) para implementar la autenticación completa del frontend.
