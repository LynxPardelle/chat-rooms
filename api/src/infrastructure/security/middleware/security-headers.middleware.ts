import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: boolean | any;
  hsts?: boolean | any;
  xssFilter?: boolean;
  noSniff?: boolean;
  frameguard?: boolean | any;
  hidePoweredBy?: boolean;
  crossOriginEmbedderPolicy?: boolean | any;
  crossOriginOpenerPolicy?: boolean | any;
  crossOriginResourcePolicy?: boolean | any;
  permittedCrossDomainPolicies?: boolean | any;
  referrerPolicy?: boolean | any;
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly helmetMiddleware: any;

  constructor(private readonly configService: ConfigService) {
    const config = this.getSecurityConfig();
    this.helmetMiddleware = helmet(config);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Apply helmet middleware
    this.helmetMiddleware(req, res, () => {
      // Add custom security headers
      this.addCustomHeaders(res);
      next();
    });
  }

  private getSecurityConfig(): any {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const domain = this.configService.get<string>('DOMAIN') || 'localhost';
    const wsPort = this.configService.get<string>('WS_PORT') || '3001';

    return {
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'", // Allow inline scripts for development
            "'unsafe-eval'", // Allow eval for development
            ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'", // Allow inline styles
            'https://fonts.googleapis.com',
            'https://cdn.jsdelivr.net',
          ],
          fontSrc: [
            "'self'",
            'https://fonts.gstatic.com',
            'https://cdn.jsdelivr.net',
          ],
          imgSrc: [
            "'self'",
            'data:', // Allow data URLs for images
            'blob:', // Allow blob URLs
            'https:',
          ],
          connectSrc: [
            "'self'",
            `ws://${domain}:${wsPort}`, // WebSocket connection
            `wss://${domain}:${wsPort}`, // Secure WebSocket
            ...(isDevelopment ? [`ws://localhost:${wsPort}`, `wss://localhost:${wsPort}`] : []),
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'", 'blob:'],
          childSrc: ["'none'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          upgradeInsecureRequests: !isDevelopment ? [] : undefined,
        },
        reportOnly: isDevelopment, // Only report in development
      },

      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },

      // X-Frame-Options
      frameguard: {
        action: 'deny',
      },

      // X-Content-Type-Options
      noSniff: true,

      // X-XSS-Protection (deprecated but still useful for older browsers)
      xssFilter: true,

      // Hide X-Powered-By header
      hidePoweredBy: true,

      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: {
        policy: 'require-corp',
      },

      // Cross-Origin Opener Policy
      crossOriginOpenerPolicy: {
        policy: 'same-origin',
      },

      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: {
        policy: 'cross-origin', // Allow cross-origin for API
      },

      // Referrer Policy
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin',
      },

      // Permitted Cross Domain Policies
      permittedCrossDomainPolicies: {
        permittedPolicies: 'none',
      },
    };
  }

  private addCustomHeaders(res: Response): void {
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';

    // Custom security headers
    res.setHeader('X-API-Version', '1.0.0');
    res.setHeader('X-Request-ID', this.generateRequestId());
    
    // Disable client-side caching for sensitive endpoints
    if (this.isSensitiveEndpoint(res.req.url)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // Feature Policy / Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'interest-cohort=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'accelerometer=()',
        'gyroscope=()',
        'picture-in-picture=()',
        'fullscreen=(self)',
      ].join(', ')
    );

    // Additional CORS headers for WebSocket support
    if (res.req.headers.origin) {
      const allowedOrigins = this.getAllowedOrigins();
      const origin = res.req.headers.origin;
      
      if (allowedOrigins.includes(origin) || isDevelopment) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Request-ID'
        );
        res.setHeader('Access-Control-Max-Age', '3600');
      }
    }

    // Security timing header to prevent timing attacks
    res.setHeader('X-Response-Time', Date.now().toString());

    // Custom rate limiting info (if needed)
    if (res.locals.rateLimitInfo) {
      res.setHeader('X-RateLimit-Limit', res.locals.rateLimitInfo.limit);
      res.setHeader('X-RateLimit-Remaining', res.locals.rateLimitInfo.remaining);
      res.setHeader('X-RateLimit-Reset', res.locals.rateLimitInfo.reset);
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isSensitiveEndpoint(url: string): boolean {
    const sensitivePatterns = [
      '/auth/',
      '/login',
      '/register',
      '/password',
      '/admin/',
      '/api/auth/',
      '/api/admin/',
    ];

    return sensitivePatterns.some(pattern => url.includes(pattern));
  }

  private getAllowedOrigins(): string[] {
    const configOrigins = this.configService.get<string>('CORS_ORIGINS');
    if (configOrigins) {
      return configOrigins.split(',').map(origin => origin.trim());
    }

    // Default allowed origins
    const domain = this.configService.get<string>('DOMAIN') || 'localhost';
    const frontPort = this.configService.get<string>('FRONT_PORT') || '5173';
    
    return [
      `http://${domain}:${frontPort}`,
      `https://${domain}`,
      'http://localhost:5173',
      'http://localhost:3001',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];
  }
}

// Factory function to create configured middleware
export const createSecurityHeadersMiddleware = (configService: ConfigService) => {
  return new SecurityHeadersMiddleware(configService);
};
