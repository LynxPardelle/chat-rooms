import { Module, Global } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdvancedThrottlerGuard } from './advanced-throttler.guard';
import { RateLimitingService } from './rate-limiting.service';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        const isDevelopment = configService.get('NODE_ENV') === 'development';
        
        return {
          throttlers: [
            {
              name: 'default',
              ttl: configService.get<number>('THROTTLE_TTL') || 60000, // 1 minute
              limit: configService.get<number>('THROTTLE_LIMIT') || 100, // 100 requests per minute
            },
            {
              name: 'auth',
              ttl: configService.get<number>('AUTH_THROTTLE_TTL') || 300000, // 5 minutes
              limit: configService.get<number>('AUTH_THROTTLE_LIMIT') || 5, // 5 auth attempts per 5 minutes
            },
            {
              name: 'websocket',
              ttl: configService.get<number>('WS_THROTTLE_TTL') || 10000, // 10 seconds
              limit: configService.get<number>('WS_THROTTLE_LIMIT') || 50, // 50 messages per 10 seconds
            },
            {
              name: 'file-upload',
              ttl: configService.get<number>('UPLOAD_THROTTLE_TTL') || 3600000, // 1 hour
              limit: configService.get<number>('UPLOAD_THROTTLE_LIMIT') || 10, // 10 uploads per hour
            },
          ],
          skipIf: () => !!(isDevelopment && configService.get<boolean>('DISABLE_RATE_LIMITING')),
        };
      },
    }),
  ],
  providers: [
    AdvancedThrottlerGuard,
    RateLimitingService,
  ],
  exports: [
    ThrottlerModule,
    AdvancedThrottlerGuard,
    RateLimitingService,
  ],
})
export class RateLimitingModule {}
