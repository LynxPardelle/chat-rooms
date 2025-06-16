import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    const { method, url, headers, ip } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = (request as any).user?.id;
    
    const startTime = Date.now();

    // Log incoming request
    this.logger.logRequest('Incoming request', {
      method,
      path: url,
      ip,
      userAgent,
      userId,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Log successful response
          this.logger.logResponse('Request completed', {
            method,
            path: url,
            statusCode,
            responseTime,
            ip,
            userId,
          });

          // Log slow requests
          if (responseTime > 1000) {
            this.logger.warn('Slow request detected', {
              method,
              path: url,
              responseTime,
              userId,
            });
          }
        },
        error: (error) => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          // Log error response
          this.logger.error('Request failed', error, 'HTTP');
          
          this.logger.logResponse('Request failed', {
            method,
            path: url,
            statusCode,
            responseTime,
            error: error.message,
            ip,
            userId,
          });
        },
      }),
    );
  }
}
