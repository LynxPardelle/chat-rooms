import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ValidationError } from 'class-validator';
import { ThrottlerException } from '@nestjs/throttler';
import { WsException } from '@nestjs/websockets';

export interface GlobalExceptionResponse {
  success: false;
  message: string;
  error: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: string | string[] | Record<string, unknown>;
}

export interface SecurityEvent {
  type: 'validation_error' | 'rate_limit' | 'authentication_error' | 'authorization_error' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent?: string;
  ip?: string;
  userId?: string;
  path: string;
  method: string;
  details?: Record<string, unknown>;
}

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly securityLogger = new Logger('SecurityEvents');

  catch(exception: unknown, host: ArgumentsHost): void {
    const contextType = host.getType();
    
    if (contextType === 'http') {
      this.handleHttpException(exception, host);
    } else if (contextType === 'ws') {
      this.handleWsException(exception, host);
    }
  }

  private handleHttpException(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const exceptionDetails = this.analyzeException(exception, request);
    const errorResponse = this.buildErrorResponse(exceptionDetails, request);

    // Log security events
    if (this.isSecurityEvent(exceptionDetails.status, exception)) {
      this.logSecurityEvent(exception, request, exceptionDetails.status);
    }

    // Log based on severity with structured data
    this.logException(exceptionDetails, request, exception);

    response.status(exceptionDetails.status).json(errorResponse);
  }

  private handleWsException(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient();
    
    let message = 'WebSocket error occurred';
    let error = 'WebSocketError';

    if (exception instanceof WsException) {
      const exceptionData = exception.getError();
      if (typeof exceptionData === 'string') {
        message = exceptionData;
      } else if (typeof exceptionData === 'object' && exceptionData !== null) {
        message = (exceptionData as any).message || message;
        error = (exceptionData as any).error || error;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.constructor.name;
    }

    this.logger.error(`WebSocket Error - ${error}: ${message}`, {
      exception: exception instanceof Error ? exception.stack : exception,
    });

    // Send error to WebSocket client
    client.emit('error', {
      success: false,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  private analyzeException(exception: unknown, request: Request) {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let details: string | string[] | Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        error = (responseObj.error as string) || exception.constructor.name;
        
        if (responseObj.details && 
            (typeof responseObj.details === 'string' || 
             Array.isArray(responseObj.details) || 
             (typeof responseObj.details === 'object' && responseObj.details !== null))) {
          details = responseObj.details as string | string[] | Record<string, unknown>;
        }
        
        if (Array.isArray(responseObj.message)) {
          details = responseObj.message as string[];
          message = 'Validation failed';
        }
      }
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      message = 'Too many requests, please try again later';
      error = 'RateLimitExceeded';
    } else if (exception instanceof ValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
      error = 'ValidationError';
      details = this.formatValidationErrors([exception]);
    } else if (exception instanceof Error) {
      // Check for specific error patterns
      if (exception.message.includes('ECONNREFUSED') || exception.message.includes('ENOTFOUND')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Service temporarily unavailable';
        error = 'ServiceUnavailable';
      } else if (exception.message.includes('timeout')) {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Request timeout';
        error = 'RequestTimeout';
      } else {
        message = this.sanitizeErrorMessage(exception.message) || 'Unexpected error occurred';
        error = exception.constructor.name;
      }
    }

    return { status, message, error, details };
  }

  private buildErrorResponse(
    exceptionDetails: { status: number; message: string; error: string; details?: any },
    request: Request
  ): GlobalExceptionResponse {
    const requestId = request.headers['x-request-id'] as string;
    
    return {
      success: false,
      message: exceptionDetails.message,
      error: exceptionDetails.error,
      statusCode: exceptionDetails.status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(requestId && { requestId }),
      ...(exceptionDetails.details && { details: exceptionDetails.details }),
    };
  }

  private isSecurityEvent(status: number, exception: unknown): boolean {
    // Rate limiting
    if (exception instanceof ThrottlerException) return true;
    
    // Authentication/Authorization errors
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) return true;
    
    // Validation errors (potential injection attempts)
    if (status === HttpStatus.BAD_REQUEST && exception instanceof ValidationError) return true;
    
    // Suspicious patterns in error messages
    if (exception instanceof Error) {
      const suspiciousPatterns = [
        /script/i, /alert/i, /eval/i, /union.*select/i,
        /drop.*table/i, /insert.*into/i, /delete.*from/i
      ];
      return suspiciousPatterns.some(pattern => pattern.test(exception.message));
    }
    
    return false;
  }

  private logSecurityEvent(exception: unknown, request: Request, status: number): void {
    let eventType: SecurityEvent['type'] = 'suspicious_activity';
    let severity: SecurityEvent['severity'] = 'medium';

    if (exception instanceof ThrottlerException) {
      eventType = 'rate_limit';
      severity = 'medium';
    } else if (status === HttpStatus.UNAUTHORIZED) {
      eventType = 'authentication_error';
      severity = 'medium';
    } else if (status === HttpStatus.FORBIDDEN) {
      eventType = 'authorization_error';
      severity = 'high';
    } else if (exception instanceof ValidationError) {
      eventType = 'validation_error';
      severity = 'low';
    }

    const securityEvent: SecurityEvent = {
      type: eventType,
      severity,
      userAgent: request.get('User-Agent'),
      ip: request.ip || request.connection.remoteAddress,
      userId: (request as any).user?.id,
      path: request.url,
      method: request.method,
      details: {
        exception: exception instanceof Error ? exception.message : String(exception),
        timestamp: new Date().toISOString(),
        headers: this.sanitizeHeaders(request.headers),
      },
    };

    this.securityLogger.warn(`Security Event: ${eventType}`, securityEvent);
  }

  private logException(
    exceptionDetails: { status: number; message: string; error: string },
    request: Request,
    exception: unknown
  ): void {
    const logContext = {
      path: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      ip: request.ip || request.connection.remoteAddress,
      userId: (request as any).user?.id,
      requestId: request.headers['x-request-id'],
      statusCode: exceptionDetails.status,
    };

    if (exceptionDetails.status >= 500) {
      this.logger.error(
        `HTTP ${exceptionDetails.status} Error - ${exceptionDetails.error}: ${exceptionDetails.message}`,
        {
          ...logContext,
          exception: exception instanceof Error ? exception.stack : exception,
        },
      );
    } else if (exceptionDetails.status >= 400) {
      this.logger.warn(
        `HTTP ${exceptionDetails.status} Warning - ${exceptionDetails.error}: ${exceptionDetails.message}`,
        logContext,
      );
    }
  }

  private sanitizeErrorMessage(message: string): string {
    if (!message) return '';
    
    // Remove potentially sensitive information
    return message
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/token[=:]\s*\S+/gi, 'token=***')
      .replace(/key[=:]\s*\S+/gi, 'key=***')
      .replace(/secret[=:]\s*\S+/gi, 'secret=***');
  }

  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '***';
      }
    });
    
    return sanitized;
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => {
      const constraints = error.constraints;
      if (constraints) {
        return Object.values(constraints);
      }
      
      // Handle nested validation errors
      if (error.children && error.children.length > 0) {
        return this.formatValidationErrors(error.children);
      }
      
      return [`Validation failed for property '${error.property}'`];
    });
  }
}
