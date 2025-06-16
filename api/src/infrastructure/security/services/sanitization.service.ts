import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class SanitizationService {
  private readonly domPurify: typeof DOMPurify;
  constructor() {
    // DOMPurify from isomorphic-dompurify works in both browser and Node.js
    this.domPurify = DOMPurify;
    
    // Ensure DOMPurify is properly initialized
    if (!this.domPurify) {
      console.warn('DOMPurify not available, HTML sanitization will be basic');
    }
  }
  /**
   * Sanitize HTML content to prevent XSS attacks
   */
  sanitizeHtml(html: string): string {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // If DOMPurify is not available, fall back to basic HTML stripping
    if (!this.domPurify || typeof this.domPurify.sanitize !== 'function') {
      return html.replace(/<[^>]*>/g, '');
    }

    return this.domPurify.sanitize(html, {
      ALLOWED_TAGS: [], // Allow no HTML tags for chat messages
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true, // Keep text content but remove tags
    });
  }
  /**
   * Sanitize text input by removing dangerous patterns
   */
  sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove JavaScript protocols
      .replace(/javascript:/gi, '')
      // Remove data URIs that could contain scripts
      .replace(/data:[^;]*;base64[^"']*/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove script tags content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      // Remove style tags content
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      // Remove SQL injection patterns
      .replace(/DROP\s+TABLE/gi, '[SANITIZED]')
      .replace(/UNION\s+SELECT/gi, '[SANITIZED]')
      .replace(/--/g, '[SANITIZED]')
      .replace(/\/\*/g, '[SANITIZED]')
      .replace(/\*\//g, '[SANITIZED]')
      .replace(/;\s*DROP/gi, '[SANITIZED]')
      .replace(/;\s*DELETE/gi, '[SANITIZED]')
      .replace(/;\s*UPDATE/gi, '[SANITIZED]')
      .replace(/;\s*INSERT/gi, '[SANITIZED]')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Sanitize URL to prevent dangerous protocols
   */
  sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return '';
    }

    // Allow only safe protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    try {
      const urlObj = new URL(url);
      
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return '';
      }
      
      return urlObj.toString();
    } catch {
      // Invalid URL
      return '';
    }
  }

  /**
   * Sanitize username to allow only safe characters
   */
  sanitizeUsername(username: string): string {
    if (!username || typeof username !== 'string') {
      return '';
    }

    return username
      .trim()
      // Keep only alphanumeric characters and underscores
      .replace(/[^a-zA-Z0-9_]/g, '')
      .substring(0, 30); // Limit length
  }

  /**
   * Sanitize email by basic validation and normalization
   */
  sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return '';
    }

    return email
      .trim()
      .toLowerCase()
      // Remove any HTML encoding
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      // Basic email pattern validation
      .replace(/[^a-zA-Z0-9@._-]/g, '');
  }

  /**
   * Sanitize message content for chat
   */
  sanitizeMessage(message: string): string {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let sanitized = this.sanitizeText(message);
    
    // Additional chat-specific sanitization
    sanitized = sanitized
      // Remove excessive whitespace
      .replace(/\s{3,}/g, '  ')
      // Remove null bytes
      .replace(/\0/g, '')
      // Limit length
      .substring(0, 2000);

    return sanitized;
  }

  /**
   * Sanitize file name for uploads
   */
  sanitizeFileName(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') {
      return '';
    }

    return fileName
      .trim()
      // Remove path separators
      .replace(/[\/\\]/g, '')
      // Remove dangerous characters
      .replace(/[<>:"|?*]/g, '')
      // Remove null bytes
      .replace(/\0/g, '')
      // Keep only safe characters
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      // Limit length
      .substring(0, 255);
  }

  /**
   * Validate and sanitize hex color
   */
  sanitizeHexColor(color: string): string {
    if (!color || typeof color !== 'string') {
      return '';
    }

    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    const sanitized = color.trim().toLowerCase();
    
    return hexColorRegex.test(sanitized) ? sanitized : '';
  }

  /**
   * Sanitize search query
   */
  sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    return query
      .trim()
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove special regex characters that could cause issues
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Limit length
      .substring(0, 100);
  }

  /**
   * Generic object sanitization
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    const sanitized = {} as T;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key as keyof T] = this.sanitizeText(value) as T[keyof T];
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key as keyof T] = this.sanitizeObject(value as Record<string, unknown>) as T[keyof T];
      } else if (Array.isArray(value)) {
        sanitized[key as keyof T] = value.map(item => 
          typeof item === 'string' ? this.sanitizeText(item) : item
        ) as T[keyof T];
      } else {
        sanitized[key as keyof T] = value as T[keyof T];
      }
    }

    return sanitized;
  }

  /**
   * Check if input contains potential XSS
   */
  containsXSS(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<form[^>]*>/gi,
      /expression\s*\(/gi,
      /vbscript:/gi,
      /data:[^;]*;base64/gi,
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if input contains SQL injection patterns
   */
  containsSQLInjection(input: string): boolean {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const sqlInjectionPatterns = [
      /('|(\\['])|;|--|\/\*|\*\/)/gi,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
      /(\s|^)(or|and)\s+\w+\s*=\s*\w+/gi,
    ];

    return sqlInjectionPatterns.some(pattern => pattern.test(input));
  }
}
