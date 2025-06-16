import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { ConfigService } from '@nestjs/config';

export interface LogContext {
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  [key: string]: unknown;
}

export interface SecurityLogContext extends LogContext {
  eventType: 'authentication' | 'authorization' | 'validation' | 'rate_limit' | 'suspicious_activity' | 'injection_attempt';
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked?: boolean;
  reason?: string;
}

export interface PerformanceLogContext extends LogContext {
  duration: number;
  memoryUsage?: number;
  cpuUsage?: number;
  operation: string;
}

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly securityLogger: winston.Logger;
  private readonly performanceLogger: winston.Logger;
  private readonly context: string;

  constructor(
    context?: string,
    configService?: ConfigService,
  ) {
    this.context = context || 'Application';
    
    const logLevel = configService?.get<string>('LOG_LEVEL') || 'info';
    const nodeEnv = configService?.get<string>('NODE_ENV') || 'development';
    const enableFileLogging = configService?.get<boolean>('ENABLE_FILE_LOGGING') ?? true;

    // Base format for all loggers
    const baseFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const contextStr = context || this.context;
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta, null, 0)}` : '';
        return `${timestamp} [${level}] [${contextStr}] ${message}${metaStr}`;
      }),
    );

    // Main application logger
    this.logger = winston.createLogger({
      level: logLevel,
      format: baseFormat,
      defaultMeta: { 
        service: 'chat-rooms-api',
        version: process.env.npm_package_version || '1.0.0',
        environment: nodeEnv,
        pid: process.pid
      },
      transports: [
        new winston.transports.Console({
          format: nodeEnv === 'development' ? consoleFormat : baseFormat,
        }),
      ],
    });

    // Security events logger
    this.securityLogger = winston.createLogger({
      level: 'warn',
      format: baseFormat,
      defaultMeta: { 
        service: 'chat-rooms-security',
        environment: nodeEnv,
        pid: process.pid
      },
      transports: [
        new winston.transports.Console({
          format: nodeEnv === 'development' ? consoleFormat : baseFormat,
        }),
      ],
    });

    // Performance logger
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: baseFormat,
      defaultMeta: { 
        service: 'chat-rooms-performance',
        environment: nodeEnv,
        pid: process.pid
      },
      transports: [
        new winston.transports.Console({
          format: nodeEnv === 'development' ? consoleFormat : baseFormat,
        }),
      ],
    });

    // Add file transports for production and when enabled
    if (enableFileLogging) {
      this.addFileTransports(nodeEnv);
    }
  }

  private addFileTransports(nodeEnv: string): void {
    // Main application logs
    this.logger.add(new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      auditFile: 'logs/application-audit.json'
    }));

    // Error logs
    this.logger.add(new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      auditFile: 'logs/error-audit.json'
    }));

    // Security logs
    this.securityLogger.add(new DailyRotateFile({
      filename: 'logs/security-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      auditFile: 'logs/security-audit.json'
    }));

    // Performance logs
    this.performanceLogger.add(new DailyRotateFile({
      filename: 'logs/performance-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      auditFile: 'logs/performance-audit.json'
    }));

    // Debug logs only in development
    if (nodeEnv === 'development') {
      this.logger.add(new DailyRotateFile({
        filename: 'logs/debug-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '3d',
        level: 'debug',
        auditFile: 'logs/debug-audit.json'
      }));
    }
  }
  log(message: string, context?: string | LogContext): void {
    if (typeof context === 'string') {
      this.logger.info(message, { context });
    } else {
      this.logger.info(message, { context: this.context, ...context });
    }
  }

  error(message: string, error?: Error | string | LogContext, context?: string): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        context: context || this.context,
        error: error.message,
        stack: error.stack,
        name: error.name,
      });
    } else if (typeof error === 'string') {
      this.logger.error(message, {
        context: context || this.context,
        error,
      });
    } else {
      this.logger.error(message, {
        context: context || this.context,
        ...error,
      });
    }
  }

  warn(message: string, context?: string | LogContext): void {
    if (typeof context === 'string') {
      this.logger.warn(message, { context });
    } else {
      this.logger.warn(message, { context: this.context, ...context });
    }
  }

  debug(message: string, context?: string | LogContext): void {
    if (typeof context === 'string') {
      this.logger.debug(message, { context });
    } else {
      this.logger.debug(message, { context: this.context, ...context });
    }
  }

  verbose(message: string, context?: string | LogContext): void {
    if (typeof context === 'string') {
      this.logger.silly(message, { context });
    } else {
      this.logger.silly(message, { context: this.context, ...context });
    }
  }

  // HTTP Request/Response logging
  logRequest(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'HTTP_REQUEST',
      type: 'request',
      ...context,
    });
  }

  logResponse(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'HTTP_RESPONSE',
      type: 'response',
      ...context,
    });
  }

  // Authentication and Authorization logging
  logAuth(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'AUTH',
      ...context,
    });
  }

  logAuthFailure(message: string, context: LogContext): void {
    this.securityLogger.warn(message, {
      context: 'AUTH_FAILURE',
      eventType: 'authentication',
      severity: 'medium',
      ...context,
    });
  }

  // Database operations logging
  logDatabase(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'DATABASE',
      ...context,
    });
  }

  logDatabaseError(message: string, context: LogContext): void {
    this.logger.error(message, {
      context: 'DATABASE_ERROR',
      ...context,
    });
  }

  // WebSocket logging
  logWebSocket(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'WEBSOCKET',
      ...context,
    });
  }

  logWebSocketError(message: string, context: LogContext): void {
    this.logger.error(message, {
      context: 'WEBSOCKET_ERROR',
      ...context,
    });
  }

  // Security event logging
  logSecurity(message: string, context: SecurityLogContext): void {
    this.securityLogger.warn(message, {
      context: 'SECURITY',
      timestamp: new Date().toISOString(),
      ...context,
    });
  }
  logSecurityCritical(message: string, context: SecurityLogContext): void {
    this.securityLogger.error(message, {
      context: 'SECURITY_CRITICAL',
      timestamp: new Date().toISOString(),
      ...context,
      severity: 'critical',
    });
  }

  // Performance logging
  logPerformance(message: string, context: PerformanceLogContext): void {
    this.performanceLogger.info(message, {
      context: 'PERFORMANCE',
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  logSlowQuery(message: string, context: PerformanceLogContext): void {
    this.performanceLogger.warn(message, {
      context: 'SLOW_QUERY',
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  // Business logic logging
  logBusiness(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'BUSINESS',
      ...context,
    });
  }

  // Rate limiting logging
  logRateLimit(message: string, context: LogContext): void {
    this.securityLogger.warn(message, {
      context: 'RATE_LIMIT',
      eventType: 'rate_limit',
      severity: 'medium',
      ...context,
    });
  }

  // Validation error logging
  logValidationError(message: string, context: LogContext & { validationErrors?: string[] }): void {
    this.logger.warn(message, {
      context: 'VALIDATION_ERROR',
      ...context,
    });
  }

  // System health logging
  logHealth(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'HEALTH',
      ...context,
    });
  }

  // Startup/Shutdown logging
  logStartup(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'STARTUP',
      ...context,
    });
  }

  logShutdown(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'SHUTDOWN',
      ...context,
    });
  }

  // Configuration logging
  logConfig(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'CONFIG',
      ...context,
    });
  }

  // External service logging
  logExternalService(message: string, context: LogContext): void {
    this.logger.info(message, {
      context: 'EXTERNAL_SERVICE',
      ...context,
    });
  }

  logExternalServiceError(message: string, context: LogContext): void {
    this.logger.error(message, {
      context: 'EXTERNAL_SERVICE_ERROR',
      ...context,
    });
  }

  // Metrics and monitoring
  logMetrics(message: string, context: LogContext & { metrics: Record<string, number> }): void {
    this.performanceLogger.info(message, {
      context: 'METRICS',
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  // Cleanup old logs programmatically
  async cleanup(): Promise<void> {
    // Implementation would depend on specific requirements
    // This is a placeholder for log cleanup functionality
    this.logger.info('Log cleanup initiated', { context: 'CLEANUP' });
  }

  // Get logger instance for advanced usage
  getLogger(): winston.Logger {
    return this.logger;
  }

  getSecurityLogger(): winston.Logger {
    return this.securityLogger;
  }
  getPerformanceLogger(): winston.Logger {
    return this.performanceLogger;
  }
}

export const createLogger = (context?: string, configService?: ConfigService): AppLoggerService => {
  return new AppLoggerService(context, configService);
};
