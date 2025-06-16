import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Message, User } from '../../domain/entities';

// Define RoomStatsDto interface locally since it might not exist in dtos
export interface RoomStatsDto {
  roomId: string;
  participantCount: number;
  messageCount: number;
  lastActivity: Date;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  useCompression?: boolean;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private redis: Redis | null = null;
  private readonly defaultTtl: number = 1800; // 30 minutes
  private readonly fallbackCache = new Map<string, { value: any; expiresAt: number }>();
  private isRedisAvailable = false;

  constructor(private readonly configService: ConfigService) {
    this.initializeRedis();
    
    // Cleanup fallback cache every 5 minutes
    setInterval(() => this.cleanupFallbackCache(), 5 * 60 * 1000);
  }

  private async initializeRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
      
      this.redis = new Redis(redisUrl, {
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 5000,
        commandTimeout: 3000,
        enableOfflineQueue: false,
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected successfully');
        this.isRedisAvailable = true;
      });

      this.redis.on('error', (error) => {
        this.logger.warn('Redis connection error, falling back to in-memory cache:', error.message);
        this.isRedisAvailable = false;
      });

      this.redis.on('ready', () => {
        this.logger.log('Redis ready for operations');
        this.isRedisAvailable = true;
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed, using fallback cache');
        this.isRedisAvailable = false;
      });

      // Test connection
      await this.redis.ping();
    } catch (error) {
      this.logger.warn('Failed to initialize Redis, using in-memory fallback cache:', error.message);
      this.isRedisAvailable = false;
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      try {
        await this.redis.quit();
        this.logger.log('Redis connection closed');
      } catch (error) {
        this.logger.warn('Error closing Redis connection:', error.message);
      }
    }
    this.fallbackCache.clear();
  }

  /**
   * Get value from cache (Redis or fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        this.logger.warn(`Redis GET error for key ${key}, using fallback:`, error.message);
        this.isRedisAvailable = false;
      }
    }

    // Fallback to in-memory cache
    return this.getFallback<T>(key);
  }

  /**
   * Set value in cache (Redis or fallback)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const ttl = options?.ttl || this.defaultTtl;
        const serializedValue = JSON.stringify(value);
        
        if (ttl > 0) {
          await this.redis.setex(key, ttl, serializedValue);
        } else {
          await this.redis.set(key, serializedValue);
        }
        
        return true;
      } catch (error) {
        this.logger.warn(`Redis SET error for key ${key}, using fallback:`, error.message);
        this.isRedisAvailable = false;
      }
    }

    // Fallback to in-memory cache
    return this.setFallback(key, value, options?.ttl);
  }

  /**
   * Delete key from cache (Redis or fallback)
   */
  async delete(key: string): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.del(key);
        return result > 0;
      } catch (error) {
        this.logger.warn(`Redis DELETE error for key ${key}, using fallback:`, error.message);
        this.isRedisAvailable = false;
      }
    }

    // Fallback to in-memory cache
    return this.deleteFallback(key);
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis?.keys(pattern);
      if (!keys || keys.length === 0) return 0;

      const result = await this.redis?.del(...keys);
      if (!result) return 0;
      this.logger.debug(`Deleted ${result} keys matching pattern: ${pattern}`);
      return result;
    } catch (error) {
      this.logger.error(`Cache DELETE PATTERN error for pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis?.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Set TTL for existing key
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis?.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Cache EXPIRE error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Cache recent messages for a room
   */
  async cacheRecentMessages(roomId: string, messages: Message[]): Promise<boolean> {
    const key = `room:${roomId}:recent_messages`;
    return this.set(key, messages, { ttl: 1800 }); // 30 minutes
  }

  /**
   * Get cached recent messages for a room
   */
  async getRecentMessages(roomId: string): Promise<Message[] | null> {
    const key = `room:${roomId}:recent_messages`;
    return this.get<Message[]>(key);
  }

  /**
   * Cache online users for a room
   */
  async cacheOnlineUsers(roomId: string, users: User[]): Promise<boolean> {
    const key = `room:${roomId}:online_users`;
    return this.set(key, users, { ttl: 300 }); // 5 minutes
  }

  /**
   * Get cached online users for a room
   */
  async getOnlineUsers(roomId: string): Promise<User[] | null> {
    const key = `room:${roomId}:online_users`;
    return this.get<User[]>(key);
  }

  /**
   * Cache room statistics
   */
  async cacheRoomStats(roomId: string, stats: RoomStatsDto): Promise<boolean> {
    const key = `room:${roomId}:stats`;
    return this.set(key, stats, { ttl: 600 }); // 10 minutes
  }

  /**
   * Get cached room statistics
   */
  async getRoomStats(roomId: string): Promise<RoomStatsDto | null> {
    const key = `room:${roomId}:stats`;
    return this.get<RoomStatsDto>(key);
  }

  /**
   * Invalidate all cache entries for a room
   */
  async invalidateRoomCache(roomId: string): Promise<number> {
    const pattern = `room:${roomId}:*`;
    return this.deletePattern(pattern);
  }

  /**
   * Cache user session data
   */
  async cacheUserSession(userId: string, sessionData: any): Promise<boolean> {
    const key = `user:${userId}:session`;
    return this.set(key, sessionData, { ttl: 3600 }); // 1 hour
  }

  /**
   * Get cached user session
   */
  async getUserSession(userId: string): Promise<any | null> {
    const key = `user:${userId}:session`;
    return this.get(key);
  }

  /**
   * Increment counter with TTL
   */
  async incrementCounter(key: string, ttl: number = 3600): Promise<number> {
    try {
      const multi = this.redis?.multi();
      if (!multi) {
        this.logger.error('Redis multi command not available, using fallback cache');
        return this.getFallback<number>(key) || 0;
      }
      multi.incr(key);
      multi.expire(key, ttl);
      const results = await multi.exec();
      
      if (results && results[0] && results[0][1]) {
        return results[0][1] as number;
      }
      return 0;
    } catch (error) {
      this.logger.error(`Cache INCREMENT error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      const info = await this.redis?.info('memory');
      const keyspace = await this.redis?.info('keyspace');
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.redis?.status === 'ready',
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Health check for cache
   */
  async healthCheck(): Promise<boolean> {
    if (this.isRedisAvailable && this.redis) {
      try {
        const result = await this.redis.ping();
        return result === 'PONG';
      } catch (error) {
        this.logger.warn('Redis health check failed:', error.message);
        this.isRedisAvailable = false;
      }
    }
    
    // Fallback cache is always "healthy"
    return true;
  }

  // Fallback cache methods
  private getFallback<T>(key: string): T | null {
    const entry = this.fallbackCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.fallbackCache.delete(key);
      return null;
    }

    return entry.value;
  }

  private setFallback<T>(key: string, value: T, ttl?: number): boolean {
    const expiresAt = Date.now() + (ttl || this.defaultTtl) * 1000;
    this.fallbackCache.set(key, { value, expiresAt });
    return true;
  }

  private deleteFallback(key: string): boolean {
    return this.fallbackCache.delete(key);
  }

  private cleanupFallbackCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.fallbackCache.entries()) {
      if (now > entry.expiresAt) {
        this.fallbackCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired fallback cache entries`);
    }
  }

  // Add method to check cache type
  getCacheType(): string {
    return this.isRedisAvailable ? 'Redis' : 'In-Memory Fallback';
  }
}
