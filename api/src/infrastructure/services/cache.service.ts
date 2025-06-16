import { Injectable, Logger } from '@nestjs/common';

export interface CacheOptions {
  ttl?: number;
  useCompression?: boolean;
}

/**
 * In-Memory Cache Service Implementation
 * Used as fallback when Redis is unavailable
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly cache = new Map<string, { value: any; expiresAt?: number }>();

  constructor() {
    this.logger.log('In-Memory Cache Service initialized');
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.logger.debug(`Cache entry expired and removed: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return entry.value;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    
    this.cache.set(key, {
      value,
      expiresAt
    });

    this.logger.debug(`Cache set: ${key}${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ''}`);
  }

  async del(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    this.cache.delete(key);
    
    if (existed) {
      this.logger.debug(`Cache deleted: ${key}`);
    }
    
    return existed;
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cache cleared: ${size} entries removed`);
  }

  async keys(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) {
      return keys;
    }

    // Simple pattern matching (supports wildcards)
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    
    if (!entry || !entry.expiresAt) {
      return -1; // No expiration
    }

    const remaining = Math.max(0, entry.expiresAt - Date.now());
    return Math.ceil(remaining / 1000); // Return seconds
  }

  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    
    for (const key of keys) {
      results.push(await this.get<T>(key));
    }
    
    return results;
  }

  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    for (const entry of entries) {
      await this.set(entry.key, entry.value, entry.ttl);
    }
  }

  // Get cache statistics
  getStats(): {
    size: number;
    hitRate: number;
    memoryUsage: string;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Mock implementation - would track hits/misses in production
      memoryUsage: `${Math.round(JSON.stringify(Array.from(this.cache.entries())).length / 1024)}KB`
    };
  }

  async setex(key: string, ttl: number, value: any): Promise<void> {
    await this.set(key, value, ttl);
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    entry.expiresAt = Date.now() + (ttl * 1000);
    return true;
  }

  // Add Redis pattern methods with simple implementation
  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.keys(pattern);
    let deleted = 0;
    
    for (const key of keys) {
      if (await this.del(key)) {
        deleted++;
      }
    }
    
    return deleted;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }

  getCacheType(): string {
    return 'In-Memory';
  }

  private cleanupExpired(): void {
    let cleaned = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }
}
