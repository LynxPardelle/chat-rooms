// Environment configuration for enterprise-grade frontend
export interface AppConfig {
  // API Configuration
  api: {
    baseUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // WebSocket Configuration
  websocket: {
    url: string;
    reconnectAttempts: number;
    reconnectDelay: number;
    heartbeatInterval: number;
  };
  
  // Authentication Configuration
  auth: {
    tokenStorageKey: string;
    refreshTokenStorageKey: string;
    userStorageKey: string;
    tokenRefreshThreshold: number; // minutes before expiry to refresh
  };
  
  // Security Configuration
  security: {
    enableEncryption: boolean;
    encryptionKey: string;
    maxStorageSize: number; // MB
  };
  
  // Feature Flags
  features: {
    enableLogging: boolean;
    enableErrorReporting: boolean;
    enablePerformanceMonitoring: boolean;
  };
  
  // Environment
  environment: 'development' | 'production' | 'test';
}

// Development Configuration
const developmentConfig: AppConfig = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001',
    timeout: 15000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  websocket: {
    url: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001',
    reconnectAttempts: 5,
    reconnectDelay: 2000,
    heartbeatInterval: 30000,
  },
  auth: {
    tokenStorageKey: 'live_chat_token',
    refreshTokenStorageKey: 'live_chat_refresh_token',
    userStorageKey: 'live_chat_user',
    tokenRefreshThreshold: 5, // 5 minutes before expiry
  },
  security: {
    enableEncryption: false, // Disabled in dev for easier debugging
    encryptionKey: 'dev-key-not-secure',
    maxStorageSize: 10, // 10MB
  },
  features: {
    enableLogging: true,
    enableErrorReporting: true,
    enablePerformanceMonitoring: true,
  },
  environment: 'development',
};

// Production Configuration
const productionConfig: AppConfig = {
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'https://api.livechat.com',
    timeout: 10000,
    retryAttempts: 2,
    retryDelay: 2000,
  },
  websocket: {
    url: import.meta.env.VITE_SOCKET_URL || 'wss://api.livechat.com',
    reconnectAttempts: 3,
    reconnectDelay: 5000,
    heartbeatInterval: 30000,
  },
  auth: {
    tokenStorageKey: 'lc_token',
    refreshTokenStorageKey: 'lc_refresh',
    userStorageKey: 'lc_user',
    tokenRefreshThreshold: 10, // 10 minutes before expiry
  },
  security: {
    enableEncryption: true,
    encryptionKey: import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key',
    maxStorageSize: 5, // 5MB in production
  },
  features: {
    enableLogging: false, // Disabled in production
    enableErrorReporting: true,
    enablePerformanceMonitoring: false,
  },
  environment: 'production',
};

// Test Configuration
const testConfig: AppConfig = {
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 5000,
    retryAttempts: 1,
    retryDelay: 500,
  },
  websocket: {
    url: 'http://localhost:3001',
    reconnectAttempts: 1,
    reconnectDelay: 1000,
    heartbeatInterval: 10000,
  },
  auth: {
    tokenStorageKey: 'test_token',
    refreshTokenStorageKey: 'test_refresh',
    userStorageKey: 'test_user',
    tokenRefreshThreshold: 1,
  },
  security: {
    enableEncryption: false,
    encryptionKey: 'test-key',
    maxStorageSize: 1,
  },
  features: {
    enableLogging: true,
    enableErrorReporting: false,
    enablePerformanceMonitoring: false,
  },
  environment: 'test',
};

// Get current environment
const getEnvironment = (): AppConfig['environment'] => {
  const env = import.meta.env.MODE;
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  return 'development';
};

// Export configuration based on environment
const currentEnvironment = getEnvironment();
export const appConfig: AppConfig = (() => {
  switch (currentEnvironment) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    default:
      return developmentConfig;
  }
})();

// Validation function
export const validateConfig = (): void => {
  const required = [
    appConfig.api.baseUrl,
    appConfig.websocket.url,
  ];
  
  for (const value of required) {
    if (!value || value.trim() === '') {
      throw new Error(`Missing required configuration value: ${value}`);
    }
  }
  
  if (appConfig.environment === 'production' && appConfig.security.enableEncryption) {
    if (!import.meta.env.VITE_ENCRYPTION_KEY) {
      throw new Error('Production environment requires VITE_ENCRYPTION_KEY');
    }
  }
};

// Initialize and validate configuration
validateConfig();

export default appConfig;
