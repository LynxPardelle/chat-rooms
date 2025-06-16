import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebSocketRateLimitConfig {
  windowMs: number;
  maxMessagesPerWindow: number;
  maxJoinsPerWindow: number;
  maxTypingEventsPerWindow: number;
  cleanupIntervalMs: number;
  inactiveThresholdMs: number;
}

export interface WebSocketConfig {
  corsOrigin: string;
  namespace: string;
  rateLimit: WebSocketRateLimitConfig;
}

@Injectable()
export class WebSocketConfigService {
  constructor(private readonly configService: ConfigService) {}

  get config(): WebSocketConfig {
    const env = this.configService.get('NODE_ENV', 'development');
    
    // Different rate limits based on environment
    const rateLimitConfigs = {
      production: {
        windowMs: 60000, // 1 minute
        maxMessagesPerWindow: 30,
        maxJoinsPerWindow: 10,
        maxTypingEventsPerWindow: 60,
        cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
        inactiveThresholdMs: 30 * 60 * 1000, // 30 minutes
      },
      development: {
        windowMs: 60000, // 1 minute
        maxMessagesPerWindow: 60, // More lenient for dev
        maxJoinsPerWindow: 20,
        maxTypingEventsPerWindow: 120,
        cleanupIntervalMs: 2 * 60 * 1000, // 2 minutes
        inactiveThresholdMs: 10 * 60 * 1000, // 10 minutes
      },
      test: {
        windowMs: 60000,
        maxMessagesPerWindow: 1000, // Very lenient for tests
        maxJoinsPerWindow: 1000,
        maxTypingEventsPerWindow: 1000,
        cleanupIntervalMs: 30 * 1000, // 30 seconds
        inactiveThresholdMs: 60 * 1000, // 1 minute
      }
    };

    return {
      corsOrigin: this.configService.get('FRONTEND_URL', 'http://localhost:5173'),
      namespace: this.configService.get('WS_NAMESPACE', '/chat'),
      rateLimit: rateLimitConfigs[env] || rateLimitConfigs.development,
    };
  }

  // Environment-specific feature flags
  get enableDetailedLogging(): boolean {
    return this.configService.get('NODE_ENV') === 'development';
  }

  get enableMetrics(): boolean {
    return this.configService.get('WS_ENABLE_METRICS', 'true') === 'true';
  }

  get enableHeartbeat(): boolean {
    return this.configService.get('WS_ENABLE_HEARTBEAT', 'true') === 'true';
  }

  get heartbeatIntervalMs(): number {
    return parseInt(this.configService.get('WS_HEARTBEAT_INTERVAL', '30000'), 10);
  }

  /**
   * Returns the rate limiting configuration based on environment
   */
  getRateLimits(): WebSocketRateLimitConfig {
    return this.config.rateLimit;
  }
  
  /**
   * Returns the default room ID for new connections
   */
  getDefaultRoom(): string {
    return this.configService.get('DEFAULT_ROOM_ID', 'global');
  }
  
  /**
   * Returns the CORS origin configuration
   */
  getCorsOrigin(): string {
    return this.config.corsOrigin;
  }
  
  /**
   * Returns the namespace configuration
   */
  getNamespace(): string {
    return this.config.namespace;
  }
  
  /**
   * Returns the heartbeat interval in milliseconds
   */
  getHeartbeatInterval(): number {
    return this.configService.get('WEBSOCKET_HEARTBEAT_INTERVAL', 30000);
  }
  
  /**
   * Returns the inactive timeout in milliseconds
   */
  getInactiveTimeout(): number {
    return this.config.rateLimit.inactiveThresholdMs;
  }
}
