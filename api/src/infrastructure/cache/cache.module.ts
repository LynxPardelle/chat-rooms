import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';
import { CacheService } from '../services/cache.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'CACHE_SERVICE',
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModule');
        const redisEnabled = configService.get('REDIS_ENABLED', 'false') === 'true';

        if (redisEnabled) {
          try {
            const redisCacheService = new RedisCacheService(configService);
            const isHealthy = await redisCacheService.healthCheck();

            if (isHealthy) {
              logger.log('Using Redis cache service');
              return redisCacheService;
            } else {
              logger.warn('Redis health check failed, falling back to in-memory cache');
            }
          } catch (error) {
            logger.warn('Failed to initialize Redis, using in-memory cache:', error.message);
          }
        }

        logger.log('Using in-memory cache service');
        return new CacheService();
      },
      inject: [ConfigService],
    },
    RedisCacheService,
  ],
  exports: ['CACHE_SERVICE', RedisCacheService],
})
export class CacheModule {}
