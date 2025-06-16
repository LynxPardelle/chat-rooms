import { Injectable, CanActivate, ExecutionContext, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface ApiSecurityConfig {
  requireApiKey: boolean;
  requireSignature: boolean;
  apiKeyHeader: string;
  signatureHeader: string;
  allowedApiKeys: string[];
  signatureSecret: string;
}

/**
 * API Security Guard
 * Implements advanced API security measures including API keys, request signing, and payload integrity
 */
@Injectable()
export class APISecurityGuard implements CanActivate {
  private readonly logger = new Logger(APISecurityGuard.name);

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    try {
      // Get API security configuration
      const config = this.getApiSecurityConfig();

      // Validate API key if required
      if (config.requireApiKey) {
        const isValidApiKey = await this.validateApiKey(request, config);
        if (!isValidApiKey) {
          this.logger.warn(`Invalid API key from IP: ${request.ip}`);
          throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
        }
      }

      // Validate request signature if required
      if (config.requireSignature) {
        const isValidSignature = await this.validateRequestSignature(request, config);
        if (!isValidSignature) {
          this.logger.warn(`Invalid request signature from IP: ${request.ip}`);
          throw new HttpException('Invalid request signature', HttpStatus.UNAUTHORIZED);
        }
      }

      // Validate payload integrity
      const isValidPayload = await this.validatePayloadIntegrity(request);
      if (!isValidPayload) {
        this.logger.warn(`Invalid payload integrity from IP: ${request.ip}`);
        throw new HttpException('Invalid payload', HttpStatus.BAD_REQUEST);
      }

      // Log successful API access
      this.logger.debug(`API access granted for IP: ${request.ip}, path: ${request.path}`);
      
      return true;
    } catch (error) {
      this.logger.error(`API security validation failed: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException('Security validation failed', HttpStatus.FORBIDDEN);
    }
  }

  private getApiSecurityConfig(): ApiSecurityConfig {
    return {
      requireApiKey: this.configService.get<boolean>('API_KEY_REQUIRED', false),
      requireSignature: this.configService.get<boolean>('API_SIGNATURE_REQUIRED', false),
      apiKeyHeader: this.configService.get<string>('API_KEY_HEADER', 'x-api-key'),
      signatureHeader: this.configService.get<string>('API_SIGNATURE_HEADER', 'x-signature'),
      allowedApiKeys: this.configService.get<string>('ALLOWED_API_KEYS', '').split(',').filter(Boolean),
      signatureSecret: this.configService.get<string>('API_SIGNATURE_SECRET', '')
    };
  }

  private async validateApiKey(request: Request, config: ApiSecurityConfig): Promise<boolean> {
    const apiKey = request.headers[config.apiKeyHeader] as string;
    
    if (!apiKey) {
      return false;
    }

    // Check if API key is in allowed list
    return config.allowedApiKeys.includes(apiKey);
  }

  private async validateRequestSignature(request: Request, config: ApiSecurityConfig): Promise<boolean> {
    const signature = request.headers[config.signatureHeader] as string;
    
    if (!signature || !config.signatureSecret) {
      return false;
    }

    try {
      const crypto = await import('crypto');
      
      // Create expected signature
      const timestamp = request.headers['x-timestamp'] as string;
      const method = request.method;
      const path = request.path;
      const body = request.body ? JSON.stringify(request.body) : '';
      
      const payload = `${timestamp}${method}${path}${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', config.signatureSecret)
        .update(payload)
        .digest('hex');

      // Compare signatures using timing-safe comparison
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      this.logger.error(`Signature validation error: ${error.message}`);
      return false;
    }
  }

  private async validatePayloadIntegrity(request: Request): Promise<boolean> {
    try {
      // Validate content type
      const contentType = request.headers['content-type'];
      if (contentType && !this.isAllowedContentType(contentType)) {
        return false;
      }

      // Validate payload size
      const contentLength = parseInt(request.headers['content-length'] || '0', 10);
      const maxPayloadSize = this.configService.get<number>('MAX_PAYLOAD_SIZE', 10 * 1024 * 1024); // 10MB default
      
      if (contentLength > maxPayloadSize) {
        this.logger.warn(`Payload size too large: ${contentLength} bytes`);
        return false;
      }

      // Validate JSON structure if applicable
      if (request.body && typeof request.body === 'object') {
        // Check for prototype pollution attempts
        if (this.hasPrototypePollution(request.body)) {
          this.logger.warn('Prototype pollution attempt detected');
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(`Payload integrity validation error: ${error.message}`);
      return false;
    }
  }

  private isAllowedContentType(contentType: string): boolean {
    const allowedTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain'
    ];

    return allowedTypes.some(type => contentType.startsWith(type));
  }

  private hasPrototypePollution(obj: any): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    const checkObject = (current: any): boolean => {
      if (typeof current !== 'object' || current === null) {
        return false;
      }

      for (const key of Object.keys(current)) {
        if (dangerousKeys.includes(key)) {
          return true;
        }
        
        if (typeof current[key] === 'object' && checkObject(current[key])) {
          return true;
        }
      }
      
      return false;
    };

    return checkObject(obj);
  }
}
