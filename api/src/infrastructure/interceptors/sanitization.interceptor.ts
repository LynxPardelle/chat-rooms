import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as DOMPurify from 'isomorphic-dompurify';
import { AppLoggerService } from '../logging/app-logger.service';

export interface SanitizationConfig {
  enableHtmlSanitization: boolean;
  enableSqlInjectionProtection: boolean;
  maxStringLength: number;
  allowedTags: string[];
  forbiddenPatterns: RegExp[];
}

@Injectable()
export class SanitizationInterceptor implements NestInterceptor {
  private readonly config: SanitizationConfig = {
    enableHtmlSanitization: true,
    enableSqlInjectionProtection: true,
    maxStringLength: 10000,
    allowedTags: ['b', 'i', 'u', 'strong', 'em', 'p', 'br'],
    forbiddenPatterns: [
      // SQL injection patterns
      /(\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bUNION\b)/i,
      /('|(\\x27)|(\\x2D\\x2D)|(%27)|(%2D%2D))/i,
      // Script injection patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      // Other suspicious patterns
      /\bexec\s*\(/i,
      /\beval\s*\(/i,
    ],
  };

  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Sanitize request data
    if (request.body) {
      request.body = this.sanitizeObject(request.body, 'request.body');
    }
    
    // Safely handle query parameters (read-only in IncomingMessage)
    if (request.query) {
      try {
        // Create a copy of the query object instead of modifying directly
        const sanitizedQuery = this.sanitizeObject({...request.query}, 'request.query');
        
        // In Express, query is a getter/setter property
        if (typeof request.query === 'object' && request.query !== null) {
          // Clear existing query properties
          Object.keys(request.query).forEach(key => {
            if (request.query[key] !== undefined) {
              delete request.query[key];
            }
          });
          
          // Add sanitized properties
          Object.assign(request.query, sanitizedQuery);
        }
      } catch (error) {
        this.logger.warn('Failed to sanitize query parameters', {
          error: error.message,
          stack: error.stack,
        });
      }
    }
    
    // Safely handle route parameters
    if (request.params) {
      try {
        request.params = this.sanitizeObject(request.params, 'request.params');
      } catch (error) {
        this.logger.warn('Failed to sanitize route parameters', {
          error: error.message,
          stack: error.stack,
        });
      }
    }

    return next.handle().pipe(
      map((data) => {
        // Sanitize response data if needed
        if (this.shouldSanitizeResponse(context)) {
          return this.sanitizeObject(data, 'response');
        }
        return data;
      }),
    );
  }

  private sanitizeObject(obj: any, context: string): any {
    if (!obj) return obj;

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this.sanitizeObject(item, `${context}[${index}]`)
      );
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key, `${context}.key`);
        sanitized[sanitizedKey] = this.sanitizeObject(value, `${context}.${key}`);
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(str: string, context: string): string {
    if (typeof str !== 'string') return str;

    let sanitized = str;
    
    // 1. Length check
    if (sanitized.length > this.config.maxStringLength) {
      this.logger.warn('String exceeds maximum length', {
        context,
        originalLength: sanitized.length,
        maxLength: this.config.maxStringLength,
      });
      sanitized = sanitized.substring(0, this.config.maxStringLength);
    }

    // 2. SQL injection protection
    if (this.config.enableSqlInjectionProtection) {
      const originalLength = sanitized.length;
      sanitized = this.removeSqlInjectionPatterns(sanitized);
        if (sanitized.length !== originalLength) {
        this.logger.warn('Potential SQL injection attempt detected', {
          context,
          originalString: str.substring(0, 100) + '...',
          sanitizedString: sanitized.substring(0, 100) + '...',
        });
      }
    }

    // 3. HTML sanitization
    if (this.config.enableHtmlSanitization) {
      const htmlSanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: this.config.allowedTags,
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
      });

      if (htmlSanitized !== sanitized) {
        this.logger.warn('HTML content sanitized', {
          context,
          originalString: sanitized.substring(0, 100) + '...',
          sanitizedString: htmlSanitized.substring(0, 100) + '...',
        });
        sanitized = htmlSanitized;
      }
    }

    // 4. General suspicious pattern detection
    for (const pattern of this.config.forbiddenPatterns) {
      if (pattern.test(sanitized)) {
        this.logger.warn('Suspicious pattern detected and blocked', {
          context,
          pattern: pattern.source,
          input: sanitized.substring(0, 100) + '...',
        });
        // Remove the matching content
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // 5. Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, ' ');

    return sanitized;
  }

  private removeSqlInjectionPatterns(str: string): string {
    // Remove common SQL injection patterns
    let cleaned = str;
    
    // Remove SQL comments
    cleaned = cleaned.replace(/(-{2}.*?$|\/\*.*?\*\/)/gm, '');
    
    // Remove dangerous SQL keywords in suspicious contexts
    const sqlPatterns = [
      /(\bSELECT\b.*?\bFROM\b)/gi,
      /(\bINSERT\b.*?\bINTO\b)/gi,
      /(\bUPDATE\b.*?\bSET\b)/gi,
      /(\bDELETE\b.*?\bFROM\b)/gi,
      /(\bDROP\b.*?\bTABLE\b)/gi,
      /(\bUNION\b.*?\bSELECT\b)/gi,
    ];

    for (const pattern of sqlPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned;
  }

  private shouldSanitizeResponse(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    // Sanitize responses that might contain user-generated content
    const pathsToSanitize = [
      '/api/messages',
      '/api/chat',
      '/api/profile',
    ];

    return pathsToSanitize.some(path => request.url?.startsWith(path));
  }
}
