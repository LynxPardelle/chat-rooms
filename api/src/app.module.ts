import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database';
import { HealthModule } from './infrastructure/health';
import { SecurityModule } from './infrastructure/security';
import { LoggingModule } from './infrastructure/logging';
import { RateLimitingModule } from './infrastructure/security/rate-limiting';
import { EnterpriseSecurityModule } from './infrastructure/security/owasp/enterprise-security.module';
// TODO: Phase 2 - Re-enable MongoDB-dependent modules
import { AuthModule, MessageModule } from './presentation/modules';
// import { UserSettingsModule } from './presentation/modules/user-settings.module';
import { SecurityHealthController } from './presentation/controllers/security-health.controller';

@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Import logging module with AppLoggerService
    LoggingModule,
    // Import database module with MongoDB connection (temporarily disabled MongoDB)
    DatabaseModule,
    // Import security module with JWT authentication
    SecurityModule,
    // Import rate limiting module with advanced throttling
    RateLimitingModule,
    // Import enterprise security module with OWASP compliance
    EnterpriseSecurityModule,
    // Import health check module
    HealthModule,
    // TODO: Phase 2 - Re-enable MongoDB-dependent modules
    // Import auth module with authentication endpoints
    AuthModule,
    // Import message module with chat functionality
    MessageModule,
    // Import user settings module with personalization features
    // UserSettingsModule,
  ],
  controllers: [AppController, SecurityHealthController],
  providers: [AppService],
})
export class AppModule {}
