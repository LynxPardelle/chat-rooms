# Step 3.3: Sistema Avanzado de Validación, Sanitización y Logging

## Descripción
Implementación de un sistema robusto de validación de datos, sanitización de entradas y logging estructurado para aplicaciones empresariales, con monitoreo de seguridad y auditoría completa.

## Objetivos
- [ ] Sistema de validación personalizada con class-validator
- [ ] Sanitización automática de entradas de usuario
- [ ] Sistema de logging estructurado con Winston
- [ ] Monitoreo de seguridad y detección de anomalías
- [ ] Auditoría completa de acciones del usuario
- [ ] Rate limiting granular por endpoint
- [ ] Sistema de alertas automáticas

## Archivos a Crear/Modificar

### 1. Sistema de Validación Personalizada

#### `api/src/common/validators/custom-validators.ts`
```typescript
import { ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, registerDecorator, ValidationOptions } from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../users/entities/user.entity';

@ValidatorConstraint({ name: 'IsUserAlreadyExist', async: true })
@Injectable()
export class IsUserAlreadyExistConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async validate(email: string, args: ValidationArguments) {
    const user = await this.userModel.findOne({ email });
    return !user;
  }

  defaultMessage(args: ValidationArguments) {
    return 'El email $value ya está registrado';
  }
}

@ValidatorConstraint({ name: 'IsStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments) {
    // Al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  defaultMessage(args: ValidationArguments) {
    return 'La contraseña debe tener al menos 8 caracteres, 1 mayúscula, 1 minúscula, 1 número y 1 símbolo especial';
  }
}

@ValidatorConstraint({ name: 'IsValidUsername', async: false })
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  validate(username: string, args: ValidationArguments) {
    // Solo letras, números, guiones y guiones bajos, 3-20 caracteres
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return usernameRegex.test(username);
  }

  defaultMessage(args: ValidationArguments) {
    return 'El nombre de usuario debe tener entre 3-20 caracteres y solo contener letras, números, guiones y guiones bajos';
  }
}

@ValidatorConstraint({ name: 'IsNotProfane', async: false })
export class IsNotProfaneConstraint implements ValidatorConstraintInterface {
  private profaneWords = [
    // Lista de palabras prohibidas - se puede cargar desde BD o archivo
    'palabra1', 'palabra2', 'etc'
  ];

  validate(text: string, args: ValidationArguments) {
    const lowercaseText = text.toLowerCase();
    return !this.profaneWords.some(word => lowercaseText.includes(word));
  }

  defaultMessage(args: ValidationArguments) {
    return 'El texto contiene contenido inapropiado';
  }
}

// Decoradores personalizados
export function IsUserAlreadyExist(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUserAlreadyExistConstraint,
    });
  };
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}

export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUsernameConstraint,
    });
  };
}

export function IsNotProfane(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNotProfaneConstraint,
    });
  };
}
```

#### `api/src/common/sanitizers/html-sanitizer.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import { JSDOM } from 'jsdom';

@Injectable()
export class HtmlSanitizerService {
  private window: any;
  private purify: any;

  constructor() {
    this.window = new JSDOM('').window;
    this.purify = DOMPurify(this.window);
    
    // Configuración personalizada
    this.purify.addHook('beforeSanitizeElements', (node: any) => {
      // Log de elementos potencialmente peligrosos
      if (node.tagName && ['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED'].includes(node.tagName)) {
        console.warn(`Elemento peligroso detectado y removido: ${node.tagName}`);
      }
    });
  }

  sanitizeHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }

    return this.purify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'title'],
      ALLOWED_URI_REGEXP: /^https?:\/\/|^mailto:|^tel:/i,
    });
  }

  sanitizeForMessageContent(input: string): string {
    return this.purify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
      ALLOWED_ATTR: ['href'],
      ALLOWED_URI_REGEXP: /^https?:\/\//i,
    });
  }

  stripAllHtml(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    return this.purify.sanitize(input, { ALLOWED_TAGS: [] });
  }
}
```

#### `api/src/common/interceptors/sanitization.interceptor.ts`
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { HtmlSanitizerService } from '../sanitizers/html-sanitizer.service';

@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  constructor(private readonly htmlSanitizer: HtmlSanitizerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    if (request.body) {
      this.sanitizeObject(request.body);
    }

    if (request.query) {
      this.sanitizeObject(request.query);
    }

    if (request.params) {
      this.sanitizeObject(request.params);
    }

    return next.handle();
  }

  private sanitizeObject(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Sanitizar strings específicos
          if (this.shouldSanitizeField(key)) {
            obj[key] = this.htmlSanitizer.sanitizeHtml(obj[key]);
          } else {
            // Para campos que no necesitan HTML, remover todo
            obj[key] = this.htmlSanitizer.stripAllHtml(obj[key]);
          }
        } else if (typeof obj[key] === 'object') {
          this.sanitizeObject(obj[key]);
        }
      }
    }
  }

  private shouldSanitizeField(fieldName: string): boolean {
    // Campos que pueden contener HTML limitado
    const htmlFields = ['content', 'description', 'message', 'bio', 'about'];
    return htmlFields.includes(fieldName.toLowerCase());
  }
}
```

### 2. Sistema de Logging Estructurado

#### `api/src/common/logging/logger.service.ts`
```typescript
import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogContext {
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  action?: string;
  resource?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor(private configService: ConfigService) {
    this.initializeLogger();
  }

  private initializeLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        return JSON.stringify({
          timestamp,
          level,
          message,
          stack,
          ...meta,
        });
      })
    );

    this.logger = winston.createLogger({
      level: this.configService.get('LOG_LEVEL', 'info'),
      format: logFormat,
      defaultMeta: {
        service: 'chat-rooms-api',
        environment: this.configService.get('NODE_ENV', 'development'),
      },
      transports: [
        // Consola
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
        
        // Archivo para todos los logs
        new winston.transports.DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
        }),
        
        // Archivo solo para errores
        new winston.transports.DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
        }),
        
        // Archivo para auditoría de seguridad
        new winston.transports.DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '90d',
        }),
      ],
    });
  }

  log(message: string, context?: LogContext) {
    this.logger.info(message, context);
  }

  error(message: string, trace?: string, context?: LogContext) {
    this.logger.error(message, { stack: trace, ...context });
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn(message, context);
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug(message, context);
  }

  verbose(message: string, context?: LogContext) {
    this.logger.verbose(message, context);
  }

  // Métodos específicos para eventos de seguridad
  logSecurityEvent(event: string, context: LogContext) {
    this.logger.info(`SECURITY_EVENT: ${event}`, {
      ...context,
      eventType: 'security',
      severity: 'high',
    });
  }

  logAuthentication(success: boolean, context: LogContext) {
    const message = success ? 'Authentication successful' : 'Authentication failed';
    this.logger.info(`AUTH: ${message}`, {
      ...context,
      eventType: 'authentication',
      success,
    });
  }

  logApiCall(method: string, path: string, statusCode: number, duration: number, context: LogContext) {
    this.logger.info('API_CALL', {
      ...context,
      eventType: 'api_call',
      method,
      path,
      statusCode,
      duration,
    });
  }

  logBusinessEvent(event: string, context: LogContext) {
    this.logger.info(`BUSINESS_EVENT: ${event}`, {
      ...context,
      eventType: 'business',
    });
  }
}
```

#### `api/src/common/interceptors/logging.interceptor.ts`
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CustomLoggerService } from '../logging/logger.service';
import { Request, Response } from 'express';
import { throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const logContext = {
      userId: request.user?.['id'],
      sessionId: request.sessionID,
      ip: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
      action: `${request.method} ${request.path}`,
      resource: request.path,
    };

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.logApiCall(
          request.method,
          request.path,
          response.statusCode,
          duration,
          logContext
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `API Error: ${error.message}`,
          error.stack,
          {
            ...logContext,
            statusCode: error.status || 500,
            duration,
          }
        );
        return throwError(() => error);
      })
    );
  }
}
```

### 3. Sistema de Auditoría

#### `api/src/common/audit/audit.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomLoggerService } from '../logging/logger.service';

export interface AuditEvent {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface AuditLog extends AuditEvent {
  _id?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel('AuditLog') private auditModel: Model<AuditLog>,
    private logger: CustomLoggerService
  ) {}

  async logEvent(event: AuditEvent): Promise<void> {
    try {
      // Guardar en base de datos
      await this.auditModel.create({
        ...event,
        timestamp: new Date(),
      });

      // También loggear para acceso rápido
      this.logger.logBusinessEvent(`AUDIT: ${event.action}`, {
        userId: event.userId,
        ip: event.ip,
        userAgent: event.userAgent,
        action: event.action,
        resource: event.resource,
        metadata: {
          resourceId: event.resourceId,
          success: event.success,
          ...event.metadata,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error.stack, {
        action: event.action,
        resource: event.resource,
        userId: event.userId,
      });
    }
  }

  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
    },
    pagination: { page: number; limit: number }
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.action) query.action = new RegExp(filters.action, 'i');
    if (filters.resource) query.resource = new RegExp(filters.resource, 'i');
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    const skip = (pagination.page - 1) * pagination.limit;

    const [logs, total] = await Promise.all([
      this.auditModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(pagination.limit)
        .exec(),
      this.auditModel.countDocuments(query),
    ]);

    return { logs, total };
  }

  async getUserActivity(userId: string, days: number = 30): Promise<AuditLog[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditModel
      .find({
        userId,
        timestamp: { $gte: startDate },
      })
      .sort({ timestamp: -1 })
      .limit(100)
      .exec();
  }
}
```

#### `api/src/common/decorators/audit.decorator.ts`
```typescript
import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditOptions {
  action: string;
  resource: string;
  captureRequest?: boolean;
  captureResponse?: boolean;
}

export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);
```

#### `api/src/common/interceptors/audit.interceptor.ts`
```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AuditService } from '../audit/audit.service';
import { AUDIT_KEY, AuditOptions } from '../decorators/audit.decorator';
import { Request } from 'express';
import { throwError } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditOptions>(AUDIT_KEY, context.getHandler());
    
    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as any;

    const baseAuditEvent = {
      userId: user?.id,
      action: auditOptions.action,
      resource: auditOptions.resource,
      ip: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent') || '',
      oldValue: auditOptions.captureRequest ? request.body : undefined,
    };

    return next.handle().pipe(
      tap((response) => {
        this.auditService.logEvent({
          ...baseAuditEvent,
          newValue: auditOptions.captureResponse ? response : undefined,
          success: true,
          metadata: {
            method: request.method,
            path: request.path,
            params: request.params,
          },
        });
      }),
      catchError((error) => {
        this.auditService.logEvent({
          ...baseAuditEvent,
          success: false,
          errorMessage: error.message,
          metadata: {
            method: request.method,
            path: request.path,
            params: request.params,
            statusCode: error.status || 500,
          },
        });
        return throwError(() => error);
      })
    );
  }
}
```

### 4. Sistema de Rate Limiting Granular

#### `api/src/common/guards/rate-limit.guard.ts`
```typescript
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { InjectRedis } from '@liaoliaots/nestjs-redis';
import Redis from 'ioredis';

export interface RateLimitOptions {
  keyGenerator?: (request: Request) => string;
  points: number; // Número de requests
  duration: number; // En segundos
  blockDuration?: number; // Tiempo de bloqueo en segundos
  skipIf?: (request: Request) => boolean;
}

export const RATE_LIMIT_KEY = 'rateLimit';

export const RateLimit = (options: RateLimitOptions) => 
  (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, options, target, propertyKey);
  };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler()
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Verificar si se debe saltar el rate limiting
    if (rateLimitOptions.skipIf && rateLimitOptions.skipIf(request)) {
      return true;
    }

    const key = rateLimitOptions.keyGenerator 
      ? rateLimitOptions.keyGenerator(request)
      : this.generateDefaultKey(request);

    const current = await this.incrementCounter(key, rateLimitOptions);

    if (current > rateLimitOptions.points) {
      // Aplicar bloqueo adicional si está configurado
      if (rateLimitOptions.blockDuration) {
        await this.redis.setex(
          `blocked:${key}`,
          rateLimitOptions.blockDuration,
          '1'
        );
      }

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests',
          retryAfter: rateLimitOptions.duration,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return true;
  }

  private generateDefaultKey(request: Request): string {
    const user = request.user as any;
    const userId = user?.id || 'anonymous';
    const ip = request.ip || request.connection.remoteAddress;
    const path = request.path;
    
    return `rate_limit:${userId}:${ip}:${path}`;
  }

  private async incrementCounter(key: string, options: RateLimitOptions): Promise<number> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.expire(key, options.duration);
    
    const results = await multi.exec();
    return results[0][1] as number;
  }
}

// Configuraciones predefinidas de rate limiting
export const AuthRateLimit = () => RateLimit({
  points: 5,
  duration: 900, // 15 minutos
  blockDuration: 3600, // 1 hora de bloqueo
  keyGenerator: (req) => `auth:${req.ip}`,
});

export const MessageRateLimit = () => RateLimit({
  points: 30,
  duration: 60, // 1 minuto
  keyGenerator: (req) => `message:${(req.user as any)?.id || req.ip}`,
});

export const UploadRateLimit = () => RateLimit({
  points: 10,
  duration: 3600, // 1 hora
  keyGenerator: (req) => `upload:${(req.user as any)?.id || req.ip}`,
});
```

### 5. Sistema de Alertas

#### `api/src/common/alerts/alert.service.ts`
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomLoggerService } from '../logging/logger.service';
import * as nodemailer from 'nodemailer';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

@Injectable()
export class AlertService {
  private transporter: nodemailer.Transporter;
  private alertThresholds: Map<string, number> = new Map();

  constructor(
    private configService: ConfigService,
    private logger: CustomLoggerService
  ) {
    this.initializeEmailTransporter();
    this.initializeThresholds();
  }

  private initializeEmailTransporter() {
    this.transporter = nodemailer.createTransporter({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  private initializeThresholds() {
    // Umbrales de alerta por minuto
    this.alertThresholds.set('failed_logins', 10);
    this.alertThresholds.set('api_errors', 50);
    this.alertThresholds.set('high_response_time', 20);
    this.alertThresholds.set('websocket_disconnections', 100);
  }

  async sendAlert(alert: Alert): Promise<void> {
    try {
      const alertWithTimestamp = {
        ...alert,
        timestamp: alert.timestamp || new Date(),
      };

      // Log de la alerta
      this.logger.logSecurityEvent(`ALERT_${alert.severity.toUpperCase()}`, {
        action: 'alert_sent',
        metadata: {
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          ...alert.metadata,
        },
      });

      // Enviar por email si es crítica o alta
      if (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH) {
        await this.sendEmailAlert(alertWithTimestamp);
      }

      // Aquí se pueden añadir otros canales como Slack, Discord, etc.
      
    } catch (error) {
      this.logger.error('Failed to send alert', error.stack, {
        action: 'send_alert_failed',
        metadata: alert,
      });
    }
  }

  private async sendEmailAlert(alert: Alert): Promise<void> {
    const adminEmails = this.configService.get('ADMIN_EMAILS', '').split(',');
    
    if (!adminEmails.length) {
      return;
    }

    const mailOptions = {
      from: this.configService.get('SMTP_FROM'),
      to: adminEmails,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      html: this.generateAlertEmailHtml(alert),
    };

    await this.transporter.sendMail(mailOptions);
  }

  private generateAlertEmailHtml(alert: Alert): string {
    const severityColor = {
      [AlertSeverity.LOW]: '#28a745',
      [AlertSeverity.MEDIUM]: '#ffc107',
      [AlertSeverity.HIGH]: '#fd7e14',
      [AlertSeverity.CRITICAL]: '#dc3545',
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${severityColor[alert.severity]}; color: white; padding: 20px; text-align: center;">
          <h1>${alert.title}</h1>
          <p>Severidad: ${alert.severity.toUpperCase()}</p>
        </div>
        <div style="padding: 20px; background-color: #f8f9fa;">
          <h3>Mensaje:</h3>
          <p>${alert.message}</p>
          
          <h3>Timestamp:</h3>
          <p>${alert.timestamp?.toISOString()}</p>
          
          ${alert.metadata ? `
            <h3>Metadata:</h3>
            <pre style="background-color: #e9ecef; padding: 10px; border-radius: 4px;">${JSON.stringify(alert.metadata, null, 2)}</pre>
          ` : ''}
        </div>
        <div style="background-color: #e9ecef; padding: 10px; text-align: center; font-size: 12px;">
          Chat Rooms Application - Security Alert System
        </div>
      </div>
    `;
  }

  async checkThresholds(metric: string, currentValue: number): Promise<void> {
    const threshold = this.alertThresholds.get(metric);
    
    if (!threshold || currentValue < threshold) {
      return;
    }

    const severity = currentValue > threshold * 2 
      ? AlertSeverity.CRITICAL 
      : AlertSeverity.HIGH;

    await this.sendAlert({
      title: `Threshold Exceeded: ${metric}`,
      message: `The metric ${metric} has exceeded its threshold. Current value: ${currentValue}, Threshold: ${threshold}`,
      severity,
      metadata: {
        metric,
        currentValue,
        threshold,
        exceedPercentage: ((currentValue - threshold) / threshold * 100).toFixed(2),
      },
    });
  }
}
```

### 6. Middleware de Seguridad

#### `api/src/common/middleware/security.middleware.ts`
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from '../logging/logger.service';
import { AlertService, AlertSeverity } from '../alerts/alert.service';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private suspiciousIPs: Set<string> = new Set();
  private rateLimitCounters: Map<string, { count: number; firstRequest: Date }> = new Map();

  constructor(
    private logger: CustomLoggerService,
    private alertService: AlertService
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent') || '';
    const path = req.path;

    // Detectar patrones sospechosos
    this.detectSuspiciousActivity(req, ip, userAgent, path);

    // Añadir headers de seguridad
    this.addSecurityHeaders(res);

    next();
  }

  private detectSuspiciousActivity(req: Request, ip: string, userAgent: string, path: string) {
    // Detectar SQL injection attempts
    if (this.detectSQLInjection(req)) {
      this.logSecurityThreat(ip, 'SQL_INJECTION_ATTEMPT', { path, userAgent });
    }

    // Detectar XSS attempts
    if (this.detectXSS(req)) {
      this.logSecurityThreat(ip, 'XSS_ATTEMPT', { path, userAgent });
    }

    // Detectar path traversal attempts
    if (this.detectPathTraversal(path)) {
      this.logSecurityThreat(ip, 'PATH_TRAVERSAL_ATTEMPT', { path, userAgent });
    }

    // Detectar user agents sospechosos
    if (this.detectSuspiciousUserAgent(userAgent)) {
      this.logSecurityThreat(ip, 'SUSPICIOUS_USER_AGENT', { path, userAgent });
    }

    // Detectar rate limiting abuse
    if (this.detectRateLimitingAbuse(ip)) {
      this.logSecurityThreat(ip, 'RATE_LIMITING_ABUSE', { path, userAgent });
    }
  }

  private detectSQLInjection(req: Request): boolean {
    const sqlPatterns = [
      /(\bor\b|\band\b).*?=.*?=/i,
      /union.*select/i,
      /select.*from/i,
      /insert.*into/i,
      /delete.*from/i,
      /update.*set/i,
      /drop.*table/i,
      /exec\s*\(/i,
      /script\s*:/i,
    ];

    const testStrings = [
      JSON.stringify(req.body),
      JSON.stringify(req.query),
      JSON.stringify(req.params),
    ];

    return testStrings.some(str => 
      sqlPatterns.some(pattern => pattern.test(str))
    );
  }

  private detectXSS(req: Request): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    const testStrings = [
      JSON.stringify(req.body),
      JSON.stringify(req.query),
      JSON.stringify(req.params),
    ];

    return testStrings.some(str => 
      xssPatterns.some(pattern => pattern.test(str))
    );
  }

  private detectPathTraversal(path: string): boolean {
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
    ];

    return pathTraversalPatterns.some(pattern => pattern.test(path));
  }

  private detectSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /burp/i,
      /nessus/i,
      /openvas/i,
      /w3af/i,
      /havij/i,
      /^$/,
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private detectRateLimitingAbuse(ip: string): boolean {
    const now = new Date();
    const timeWindow = 60000; // 1 minuto
    const maxRequests = 100;

    const counter = this.rateLimitCounters.get(ip);
    
    if (!counter) {
      this.rateLimitCounters.set(ip, { count: 1, firstRequest: now });
      return false;
    }

    if (now.getTime() - counter.firstRequest.getTime() > timeWindow) {
      // Reset counter
      this.rateLimitCounters.set(ip, { count: 1, firstRequest: now });
      return false;
    }

    counter.count++;
    return counter.count > maxRequests;
  }

  private async logSecurityThreat(ip: string, threat: string, metadata: any) {
    this.suspiciousIPs.add(ip);

    this.logger.logSecurityEvent(`THREAT_DETECTED: ${threat}`, {
      ip,
      action: 'security_threat_detected',
      metadata: {
        threat,
        ...metadata,
      },
    });

    // Enviar alerta si es un threat crítico
    if (['SQL_INJECTION_ATTEMPT', 'XSS_ATTEMPT'].includes(threat)) {
      await this.alertService.sendAlert({
        title: `Security Threat Detected: ${threat}`,
        message: `A ${threat} has been detected from IP ${ip}`,
        severity: AlertSeverity.HIGH,
        metadata: {
          ip,
          threat,
          ...metadata,
        },
      });
    }
  }

  private addSecurityHeaders(res: Response) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
  }
}
```

### 7. Configuración de Módulos

#### `api/src/common/validation/validation.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CustomLoggerService } from '../logging/logger.service';
import { HtmlSanitizerService } from '../sanitizers/html-sanitizer.service';
import { AuditService } from '../audit/audit.service';
import { AlertService } from '../alerts/alert.service';
import { IsUserAlreadyExistConstraint, IsStrongPasswordConstraint, IsValidUsernameConstraint, IsNotProfaneConstraint } from '../validators/custom-validators';

// Schema para AuditLog
const AuditLogSchema = new mongoose.Schema({
  userId: { type: String, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },
  oldValue: { type: mongoose.Schema.Types.Mixed },
  newValue: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, required: true },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now, index: true },
  success: { type: Boolean, required: true, index: true },
  errorMessage: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
});

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: 'AuditLog', schema: AuditLogSchema },
    ]),
  ],
  providers: [
    CustomLoggerService,
    HtmlSanitizerService,
    AuditService,
    AlertService,
    IsUserAlreadyExistConstraint,
    IsStrongPasswordConstraint,
    IsValidUsernameConstraint,
    IsNotProfaneConstraint,
  ],
  exports: [
    CustomLoggerService,
    HtmlSanitizerService,
    AuditService,
    AlertService,
    IsUserAlreadyExistConstraint,
    IsStrongPasswordConstraint,
    IsValidUsernameConstraint,
    IsNotProfaneConstraint,
  ],
})
export class ValidationModule {}
```

#### Actualizar `api/src/app.module.ts`
```typescript
// Añadir imports necesarios
import { ValidationModule } from './common/validation/validation.module';
import { SecurityMiddleware } from './common/middleware/security.middleware';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SanitizationInterceptor } from './common/interceptors/sanitization.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from './common/guards/rate-limit.guard';

@Module({
  imports: [
    // ...otros imports
    ValidationModule,
  ],
  providers: [
    // ...otros providers
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SanitizationInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*');
  }
}
```

## Dependencias a Instalar

```bash
# Logging y validación
npm install winston winston-daily-rotate-file
npm install isomorphic-dompurify jsdom
npm install @types/dompurify @types/jsdom

# Email para alertas
npm install nodemailer
npm install @types/nodemailer

# Redis para rate limiting (si no está instalado)
npm install @liaoliaots/nestjs-redis ioredis
npm install @types/ioredis
```

## Variables de Entorno Necesarias

```env
# Logging
LOG_LEVEL=info

# SMTP para alertas
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Chat Rooms Alerts <alerts@livechat.com>"

# Emails de administradores (separados por coma)
ADMIN_EMAILS=admin1@company.com,admin2@company.com

# Redis para rate limiting
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Validación del Step

### Tests de Validación Personalizada
```typescript
// api/src/common/validators/custom-validators.spec.ts
describe('Custom Validators', () => {
  // Tests para IsStrongPassword
  // Tests para IsValidUsername
  // Tests para IsNotProfane
  // Tests para IsUserAlreadyExist
});
```

### Tests de Sanitización
```typescript
// api/src/common/sanitizers/html-sanitizer.service.spec.ts
describe('HtmlSanitizerService', () => {
  // Tests para sanitización de HTML
  // Tests para removeimiento de scripts
  // Tests para conservación de tags permitidos
});
```

### Tests de Auditoría
```typescript
// api/src/common/audit/audit.service.spec.ts
describe('AuditService', () => {
  // Tests para logging de eventos
  // Tests para consultas de auditoría
  // Tests para generación de reportes
});
```

### Tests de Rate Limiting
```typescript
// api/src/common/guards/rate-limit.guard.spec.ts
describe('RateLimitGuard', () => {
  // Tests para límites de requests
  // Tests para bloqueos temporales
  // Tests para diferentes configuraciones
});
```

### Tests de Seguridad
```typescript
// api/src/common/middleware/security.middleware.spec.ts
describe('SecurityMiddleware', () => {
  // Tests para detección de SQL injection
  // Tests para detección de XSS
  // Tests para detección de path traversal
  // Tests para headers de seguridad
});
```

## Checklist de Implementación

- [ ] ✅ Validadores personalizados implementados
- [ ] ✅ Sistema de sanitización de HTML configurado
- [ ] ✅ Interceptor de sanitización automática
- [ ] ✅ Sistema de logging estructurado con Winston
- [ ] ✅ Interceptor de logging para APIs
- [ ] ✅ Sistema de auditoría completo
- [ ] ✅ Decorador y interceptor de auditoría
- [ ] ✅ Sistema de rate limiting granular
- [ ] ✅ Guards personalizados de rate limiting
- [ ] ✅ Sistema de alertas automáticas
- [ ] ✅ Middleware de seguridad avanzado
- [ ] ✅ Configuración de módulos
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Tests unitarios implementados
- [ ] ✅ Documentación completa

## Uso en Controllers

### Ejemplo de uso en AuthController
```typescript
@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  @Post('login')
  @AuthRateLimit()
  @Audit({ action: 'user_login', resource: 'auth' })
  async login(@Body() loginDto: LoginDto) {
    // Implementación
  }

  @Post('register')
  @Audit({ action: 'user_register', resource: 'auth', captureRequest: true })
  async register(@Body() registerDto: RegisterDto) {
    // Implementación con validadores personalizados
  }
}
```

### Ejemplo de uso en MessagesController
```typescript
@Controller('messages')
export class MessagesController {
  @Post()
  @MessageRateLimit()
  @Audit({ action: 'send_message', resource: 'messages' })
  async sendMessage(@Body() messageDto: CreateMessageDto) {
    // Implementación con sanitización automática
  }
}
```

Este step proporciona una base sólida de seguridad, validación y monitoreo para la aplicación de chat, asegurando que todas las entradas sean validadas y sanitizadas, que las acciones sean auditadas, y que los administradores sean alertados de actividades sospechosas.
