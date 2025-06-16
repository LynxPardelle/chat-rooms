import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CSPDirectives {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  frameSrc: string[];
  childSrc: string[];
  workerSrc: string[];
  frameAncestors: string[];
  baseUri: string[];
  formAction: string[];
  upgradeInsecureRequests: boolean;
  blockAllMixedContent: boolean;
}

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'X-XSS-Protection': string;
  'Strict-Transport-Security': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Cross-Origin-Embedder-Policy': string;
  'Cross-Origin-Opener-Policy': string;
  'Cross-Origin-Resource-Policy': string;
}

/**
 * Content Security Policy Service
 * Manages dynamic CSP policies and comprehensive security headers
 */
@Injectable()
export class CSPService {
  private readonly logger = new Logger(CSPService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate CSP header based on route and user context
   */
  generateCSP(route: string, userRole?: string): string {
    const directives = this.getCSPDirectives(route, userRole);
    return this.buildCSPHeader(directives);
  }

  /**
   * Get all security headers for a request
   */
  getSecurityHeaders(route: string, userRole?: string): SecurityHeaders {
    const csp = this.generateCSP(route, userRole);
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    return {
      'Content-Security-Policy': csp,
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': isProduction 
        ? 'max-age=31536000; includeSubDomains; preload' 
        : 'max-age=0',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': this.getPermissionsPolicy(),
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
  }

  private getCSPDirectives(route: string, userRole?: string): CSPDirectives {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const allowUnsafe = !isProduction && this.configService.get('CSP_ALLOW_UNSAFE', false);

    // Base CSP directives
    const baseDirectives: CSPDirectives = {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'self'"],
      workerSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction,
      blockAllMixedContent: isProduction
    };

    // Development-specific directives
    if (!isProduction && allowUnsafe) {
      baseDirectives.scriptSrc.push("'unsafe-eval'", "'unsafe-inline'");
      baseDirectives.styleSrc.push("'unsafe-inline'");
    }

    // Route-specific adjustments
    if (route.includes('/api/')) {
      // API routes might need different policies
      baseDirectives.connectSrc.push('ws:', 'wss:');
    }

    if (route.includes('/chat')) {
      // Chat routes need WebSocket connections
      baseDirectives.connectSrc.push('ws:', 'wss:');
      baseDirectives.imgSrc.push('blob:'); // For image uploads
    }

    if (route.includes('/admin') && userRole === 'admin') {
      // Admin routes might need additional permissions
      baseDirectives.scriptSrc.push("'unsafe-eval'"); // For dynamic admin tools
    }

    // External CDN allowances for production
    if (isProduction) {
      const allowedCDNs = this.configService.get<string>('ALLOWED_CDNS', '').split(',').filter(Boolean);
      baseDirectives.scriptSrc.push(...allowedCDNs);
      baseDirectives.styleSrc.push(...allowedCDNs);
      baseDirectives.fontSrc.push(...allowedCDNs);
    }

    return baseDirectives;
  }

  private buildCSPHeader(directives: CSPDirectives): string {
    const policies: string[] = [];

    // Build directive strings
    Object.entries(directives).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        if (value) {
          const directiveName = this.camelToKebab(key);
          policies.push(directiveName);
        }
      } else if (Array.isArray(value) && value.length > 0) {
        const directiveName = this.camelToKebab(key);
        policies.push(`${directiveName} ${value.join(' ')}`);
      }
    });

    const cspHeader = policies.join('; ');
    this.logger.debug(`Generated CSP: ${cspHeader}`);
    
    return cspHeader;
  }

  private getPermissionsPolicy(): string {
    const policies = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=(self)',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=(self)',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=(self)',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()'
    ];

    return policies.join(', ');
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * Validate CSP policy effectiveness
   */
  async validateCSPPolicy(csp: string): Promise<{
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check for unsafe directives
    if (csp.includes("'unsafe-inline'")) {
      warnings.push("CSP contains 'unsafe-inline' directive which reduces security");
      recommendations.push("Consider using nonces or hashes instead of 'unsafe-inline'");
    }

    if (csp.includes("'unsafe-eval'")) {
      warnings.push("CSP contains 'unsafe-eval' directive which allows code evaluation");
      recommendations.push("Remove 'unsafe-eval' and refactor code to avoid dynamic evaluation");
    }

    if (csp.includes('*')) {
      warnings.push("CSP contains wildcard (*) which allows any source");
      recommendations.push("Replace wildcards with specific trusted domains");
    }

    // Check for missing important directives
    const requiredDirectives = ['default-src', 'script-src', 'style-src', 'img-src'];
    const missingDirectives = requiredDirectives.filter(directive => !csp.includes(directive));
    
    if (missingDirectives.length > 0) {
      warnings.push(`Missing important CSP directives: ${missingDirectives.join(', ')}`);
      recommendations.push('Add all required CSP directives for comprehensive protection');
    }

    const isValid = warnings.length === 0;

    this.logger.debug(`CSP validation completed. Valid: ${isValid}, Warnings: ${warnings.length}`);

    return {
      isValid,
      warnings,
      recommendations
    };
  }

  /**
   * Generate nonce for inline scripts/styles
   */
  generateNonce(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Generate hash for static inline content
   */
  generateHash(content: string, algorithm: 'sha256' | 'sha384' | 'sha512' = 'sha256'): string {
    const crypto = require('crypto');
    const hash = crypto.createHash(algorithm).update(content).digest('base64');
    return `${algorithm}-${hash}`;
  }
}
