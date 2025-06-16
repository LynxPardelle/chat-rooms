import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { OWASPSecurityService } from './owasp-security.service';
import { CSPService } from './csp.service';
import { SecurityMonitoringService } from './security-monitoring.service';

/**
 * Security middleware that applies comprehensive OWASP security measures
 * to all incoming requests and outgoing responses
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMiddleware.name);

  constructor(
    private readonly owaspSecurity: OWASPSecurityService,
    private readonly cspService: CSPService,
    private readonly securityMonitoring: SecurityMonitoringService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = this.generateRequestId();

    try {
      // Add request ID for tracking
      req['requestId'] = requestId;

      // Apply security headers
      await this.applySecurityHeaders(req, res);

      // Validate request for security threats
      await this.validateRequest(req);

      // Log security event
      await this.logSecurityEvent(req);

      // Continue to next middleware
      next();

    } catch (error) {
      this.logger.error(`Security middleware error: ${error.message}`, {
        requestId,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        error: error.stack,
      });

      // Return secure error response
      res.status(403).json({
        error: 'Security validation failed',
        requestId,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Apply comprehensive security headers to response
   */
  private async applySecurityHeaders(req: Request, res: Response): Promise<void> {
    // Get CSP policy
    const cspPolicy = await this.cspService.generateCSP(req.path);
    res.setHeader('Content-Security-Policy', cspPolicy);
    
    // Generate nonce for inline scripts
    const nonce = await this.cspService.generateNonce();
    res.locals.nonce = nonce;

    // Apply security headers
    const securityHeaders = {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Server': 'SecureServer',
    };

    Object.entries(securityHeaders).forEach(([header, value]) => {
      res.setHeader(header, value);
    });
  }

  /**
   * Validate incoming request for security threats
   */
  private async validateRequest(req: Request): Promise<void> {
    // Validate against injection attacks
    if (req.body && typeof req.body === 'string') {
      await this.owaspSecurity.validateInjectionPrevention(req.body);
    }
    
    if (req.query && typeof req.query === 'object') {
      for (const value of Object.values(req.query)) {
        if (typeof value === 'string') {
          await this.owaspSecurity.validateInjectionPrevention(value);
        }
      }
    }

    // Validate request size
    const maxSize = 10 * 1024 * 1024; // 10MB
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error('Request payload too large');
    }

    // Validate Content-Type for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('content-type');
      if (!contentType || !this.isValidContentType(contentType)) {
        throw new Error('Invalid or missing Content-Type header');
      }
    }

    // Validate User-Agent
    const userAgent = req.get('user-agent');
    if (userAgent && this.isSuspiciousUserAgent(userAgent)) {
      throw new Error('Suspicious User-Agent detected');
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(req: Request): Promise<void> {
    try {
      const user = req['user'] as any;
      await this.securityMonitoring.reportSecurityEvent(
        'SUSPICIOUS_ACTIVITY',
        'SecurityMiddleware',
        {
          method: req.method,
          path: req.path,
          requestId: req['requestId'],
          timestamp: new Date(),
        },
        user?.username || user?.email,
        req.ip || '0.0.0.0',
        req.get('User-Agent') || ''
      );
    } catch (error) {
      this.logger.warn(`Failed to log security event: ${error.message}`);
    }
  }

  /**
   * Helper methods
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isValidContentType(contentType: string): boolean {
    const validTypes = [
      'application/json',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'text/plain',
    ];
    return validTypes.some(type => contentType.toLowerCase().includes(type));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /hack/i,
      /exploit/i,
      /^$/,
    ];
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }
}
