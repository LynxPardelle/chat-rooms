import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Configuration
import jwtConfig from './config/jwt.config';

// Database
import { DatabaseModule } from '../database';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { WsJwtStrategy } from './strategies/ws-jwt.strategy';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { OptionalJwtGuard } from './guards/optional-jwt.guard';

// Services
import { TokenService } from './services/token.service';
import { HashService } from './services/hash.service';
import { SecurityService } from './services/security.service';
import { SanitizationService } from './services/sanitization.service';

@Module({  imports: [
    ConfigModule.forFeature(jwtConfig),
    DatabaseModule,
    PassportModule,
    JwtModule.register({}), // Configuration will be done dynamically in services
  ],  providers: [
    // Strategies
    JwtStrategy,
    JwtRefreshStrategy,
    WsJwtStrategy,
    
    // Guards
    JwtAuthGuard,
    JwtRefreshGuard,
    WsJwtGuard,
    OptionalJwtGuard,
      // Services
    TokenService,
    HashService,
    SecurityService,
    SanitizationService,
  ],  exports: [
    // Strategies
    JwtStrategy,
    JwtRefreshStrategy,
    WsJwtStrategy,
    
    // Guards
    JwtAuthGuard,
    JwtRefreshGuard,
    WsJwtGuard,
    OptionalJwtGuard,
      // Services
    TokenService,
    HashService,
    SecurityService,
    SanitizationService,
    
    // Passport module for strategies
    PassportModule,
  ],
})
export class SecurityModule {}
