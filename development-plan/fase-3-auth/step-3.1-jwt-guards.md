# 3.1 Configuración JWT y Guards

## Explicación

Implementaremos un sistema de autenticación robusto con JWT, refresh tokens, estrategias Passport, guards personalizados y manejo seguro de sesiones. El sistema incluirá protección contra ataques comunes y una arquitectura escalable.

## Objetivos

- Configurar autenticación JWT con refresh tokens
- Implementar estrategias Passport para múltiples métodos de autenticación
- Crear guards personalizados para diferentes niveles de acceso
- Establecer middleware de seguridad y rate limiting
- Configurar sistema de roles y permisos escalable

## Prompt para Implementación

```typescript
Implementa un sistema de autenticación completo con:

Funcionalidades principales:
- Login/Register con validación robusta
- JWT con access tokens (15 min) y refresh tokens (7 días)
- Estrategias Passport (local, JWT, y preparado para OAuth)
- Guards para rutas autenticadas y autorización por roles
- Rate limiting por IP y por usuario
- Blacklist de tokens para logout seguro
- Validación de fuerza de contraseñas
- Sistema de roles escalable (user, admin, moderator)

Seguridad:
- Hash de contraseñas con bcrypt (rounds: 12)
- Validación contra inyección SQL/NoSQL
- Sanitización de inputs
- Headers de seguridad (helmet)
- CORS configurado apropiadamente
- Protección contra ataques de timing
- Logs de seguridad detallados

Configuración empresarial:
- Variables de entorno para todos los secretos
- Configuración diferenciada por ambiente
- Monitoreo de intentos de login fallidos
- Bloqueo temporal de cuentas después de 5 intentos
- Recuperación de contraseñas por email (preparado)
```

## Estructura de Archivos

```
api/src/
├── auth/
│   ├── auth.module.ts                  # Módulo principal de autenticación
│   ├── auth.controller.ts              # Controlador de auth endpoints
│   ├── auth.service.ts                 # Lógica de negocio de autenticación
│   ├── guards/
│   │   ├── jwt-auth.guard.ts          # Guard para rutas autenticadas
│   │   ├── local-auth.guard.ts        # Guard para login local
│   │   ├── roles.guard.ts             # Guard para autorización por roles
│   │   └── websocket-auth.guard.ts    # Guard para WebSocket
│   ├── strategies/
│   │   ├── local.strategy.ts          # Estrategia Passport local
│   │   ├── jwt.strategy.ts            # Estrategia Passport JWT
│   │   └── jwt-refresh.strategy.ts    # Estrategia para refresh tokens
│   ├── decorators/
│   │   ├── get-user.decorator.ts      # Decorator para obtener usuario actual
│   │   ├── roles.decorator.ts         # Decorator para definir roles requeridos
│   │   └── public.decorator.ts        # Decorator para rutas públicas
│   └── dto/
│       ├── login.dto.ts               # DTO para login
│       ├── register.dto.ts            # DTO para registro
│       ├── refresh-token.dto.ts       # DTO para refresh token
│       └── change-password.dto.ts     # DTO para cambio de contraseña
├── common/
│   ├── middleware/
│   │   ├── rate-limit.middleware.ts   # Rate limiting personalizado
│   │   └── security.middleware.ts     # Headers y validaciones de seguridad
│   ├── interceptors/
│   │   ├── logging.interceptor.ts     # Interceptor para logs detallados
│   │   └── transform.interceptor.ts   # Interceptor para transformar respuestas
│   └── filters/
│       └── auth-exception.filter.ts   # Filter para excepciones de auth
└── config/
    ├── jwt.config.ts                   # Configuración JWT
    ├── security.config.ts              # Configuración de seguridad
    └── rate-limit.config.ts            # Configuración de rate limiting
```

## Configuración y Enums

### domain/enums/user-role.enum.ts

```typescript
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export const RoleHierarchy = {
  [UserRole.USER]: 0,
  [UserRole.MODERATOR]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.SUPER_ADMIN]: 3
};

export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return RoleHierarchy[userRole] >= RoleHierarchy[requiredRole];
}
```

### config/jwt.config.ts

```typescript
import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const jwtConfig = (configService: ConfigService): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET'),
  signOptions: {
    expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
    issuer: configService.get<string>('JWT_ISSUER', 'chat-rooms-api'),
    audience: configService.get<string>('JWT_AUDIENCE', 'chat-rooms-client')
  }
});

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface RefreshJwtPayload {
  sub: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}
```

### config/security.config.ts

```typescript
import { ConfigService } from '@nestjs/config';

export class SecurityConfig {
  constructor(private configService: ConfigService) {}

  get bcryptRounds(): number {
    return this.configService.get<number>('BCRYPT_ROUNDS', 12);
  }

  get maxLoginAttempts(): number {
    return this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5);
  }

  get lockoutDuration(): number {
    return this.configService.get<number>('LOCKOUT_DURATION_MINUTES', 15);
  }

  get refreshTokenExpiry(): string {
    return this.configService.get<string>('REFRESH_TOKEN_EXPIRY', '7d');
  }

  get passwordMinLength(): number {
    return this.configService.get<number>('PASSWORD_MIN_LENGTH', 8);
  }

  get requireSpecialChar(): boolean {
    return this.configService.get<boolean>('PASSWORD_REQUIRE_SPECIAL', true);
  }

  get requireNumbers(): boolean {
    return this.configService.get<boolean>('PASSWORD_REQUIRE_NUMBERS', true);
  }

  get requireUppercase(): boolean {
    return this.configService.get<boolean>('PASSWORD_REQUIRE_UPPERCASE', true);
  }
}
```

## DTOs de Autenticación

### auth/dto/register.dto.ts

```typescript
import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches, 
  IsOptional,
  IsEnum 
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../domain/enums/user-role.enum';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Username debe tener al menos 3 caracteres' })
  @MaxLength(20, { message: 'Username no puede exceder 20 caracteres' })
  @Matches(/^[a-zA-Z0-9_]+$/, { 
    message: 'Username solo puede contener letras, números y guiones bajos' 
  })
  @Transform(({ value }) => value.toLowerCase().trim())
  username: string;

  @IsEmail({}, { message: 'Email debe tener un formato válido' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'Password no puede exceder 128 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'
    }
  )
  password: string;

  @IsString()
  @MinLength(2, { message: 'Nombre debe tener al menos 2 caracteres' })
  @MaxLength(50, { message: 'Nombre no puede exceder 50 caracteres' })
  @Transform(({ value }) => value.trim())
  displayName: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER;
}
```

### auth/dto/login.dto.ts

```typescript
import { IsString, IsEmail, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail({}, { message: 'Email debe tener un formato válido' })
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(1, { message: 'Password es requerido' })
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean = false;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
```

### auth/dto/refresh-token.dto.ts

```typescript
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

### auth/dto/change-password.dto.ts

```typescript
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Password actual es requerido' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Nuevo password debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'Nuevo password no puede exceder 128 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Nuevo password debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'
    }
  )
  newPassword: string;
}
```

## Estrategias Passport

### auth/strategies/local.strategy.ts

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true
    });
  }

  async validate(req: any, email: string, password: string): Promise<User> {
    const deviceInfo = req.body.deviceInfo || req.get('User-Agent') || 'Unknown';
    const rememberMe = req.body.rememberMe || false;
    
    const user = await this.authService.validateUser(email, password, {
      ip: req.ip,
      deviceInfo,
      rememberMe
    });
    
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    
    return user;
  }
}
```

### auth/strategies/jwt.strategy.ts

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { JwtPayload } from '../../config/jwt.config';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userRepository: UserRepository
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      issuer: configService.get<string>('JWT_ISSUER', 'chat-rooms-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'chat-rooms-client'),
      passReqToCallback: true
    });
  }

  async validate(req: any, payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findById(payload.sub);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Verificar si el token está en blacklist
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      throw new UnauthorizedException('Token inválido');
    }

    return user;
  }
}
```

### auth/strategies/jwt-refresh.strategy.ts

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { RefreshJwtPayload } from '../../config/jwt.config';
import { User } from '../../domain/entities/user.entity';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private userRepository: UserRepository
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true
    });
  }

  async validate(req: any, payload: RefreshJwtPayload): Promise<User> {
    const user = await this.userRepository.findById(payload.sub);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    // Verificar versión del token (para invalidar tokens antiguos)
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token de refresh inválido');
    }

    return user;
  }
}
```

## Guards de Autenticación

### auth/guards/jwt-auth.guard.ts

```typescript
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Verificar si la ruta está marcada como pública
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      
      // Log del intento de acceso no autorizado
      console.warn(`Unauthorized access attempt from IP: ${request.ip}, User-Agent: ${request.get('User-Agent')}`);
      
      throw err || new UnauthorizedException('Token de acceso inválido o expirado');
    }
    
    return user;
  }
}
```

### auth/guards/roles.guard.ts

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, hasMinimumRole } from '../../domain/enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    const hasRole = requiredRoles.some(role => 
      hasMinimumRole(user.role, role)
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
```

### auth/guards/websocket-auth.guard.ts

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../../infrastructure/repositories/user.repository';
import { JwtPayload } from '../../config/jwt.config';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private userRepository: UserRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client = context.switchToWs().getClient();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        return false;
      }

      const payload: JwtPayload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET')
      });

      const user = await this.userRepository.findById(payload.sub);
      
      if (!user || !user.isActive) {
        return false;
      }

      // Attach user to client for later use
      client.user = user;
      return true;
    } catch (error) {
      return false;
    }
  }

  private extractTokenFromHandshake(client: any): string | null {
    const token = client.handshake?.auth?.token || 
                 client.handshake?.headers?.authorization?.replace('Bearer ', '');
    return token || null;
  }
}
```

## Decoradores Personalizados

### auth/decorators/public.decorator.ts

```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### auth/decorators/roles.decorator.ts

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../domain/enums/user-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### auth/decorators/get-user.decorator.ts

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';

export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user[data] : user;
  },
);
```

## Servicio de Autenticación

### auth/auth.service.ts

```typescript
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../infrastructure/repositories/user.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '../domain/entities/user.entity';
import { UserRole } from '../domain/enums/user-role.enum';
import { SecurityConfig } from '../config/security.config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface LoginContext {
  ip: string;
  deviceInfo: string;
  rememberMe: boolean;
}

@Injectable()
export class AuthService {
  private tokenBlacklist = new Set<string>();
  private loginAttempts = new Map<string, { count: number; lockedUntil?: Date }>();

  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private securityConfig: SecurityConfig
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email ya está registrado');
    }

    const existingUsername = await this.userRepository.findByUsername(registerDto.username);
    if (existingUsername) {
      throw new ConflictException('Username ya está en uso');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(registerDto.password, this.securityConfig.bcryptRounds);

    // Crear usuario
    const user = await this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
      role: registerDto.role || UserRole.USER,
      tokenVersion: 0
    });

    // Generar tokens
    return this.generateAuthResult(user, false);
  }

  async login(loginDto: LoginDto, context: LoginContext): Promise<AuthResult> {
    const { email, password, rememberMe } = loginDto;
    
    // Verificar rate limiting
    this.checkRateLimit(context.ip);

    const user = await this.validateUser(email, password, context);
    
    if (!user) {
      this.recordFailedAttempt(context.ip);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Reset failed attempts on successful login
    this.loginAttempts.delete(context.ip);

    return this.generateAuthResult(user, rememberMe);
  }

  async validateUser(email: string, password: string, context: LoginContext): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    
    if (!user || !user.isActive) {
      return null;
    }

    // Verificar si la cuenta está bloqueada
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Cuenta bloqueada hasta ${user.lockedUntil.toISOString()}`
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      await this.recordFailedUserAttempt(user);
      return null;
    }

    // Reset failed attempts on successful validation
    if (user.failedLoginAttempts > 0) {
      await this.userRepository.update(user.id, { 
        failedLoginAttempts: 0, 
        lockedUntil: null 
      });
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET')
      });

      const user = await this.userRepository.findById(payload.sub);
      
      if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      return this.generateAuthResult(user, true);
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async logout(accessToken: string, userId: string): Promise<void> {
    // Agregar token a blacklist
    this.tokenBlacklist.add(accessToken);

    // Incrementar versión del token para invalidar refresh tokens
    await this.userRepository.update(userId, {
      tokenVersion: { $inc: 1 }
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;
    
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la actual');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, this.securityConfig.bcryptRounds);
    
    await this.userRepository.update(userId, {
      password: hashedNewPassword,
      tokenVersion: { $inc: 1 } // Invalidar todos los tokens existentes
    });
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return this.tokenBlacklist.has(token);
  }

  private async generateAuthResult(user: User, rememberMe: boolean): Promise<AuthResult> {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    };

    const refreshPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion || 0
    };

    const accessTokenExpiry = rememberMe ? '24h' : '15m';
    const refreshTokenExpiry = rememberMe ? '30d' : '7d';

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessTokenExpiry
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry
    });

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: rememberMe ? 86400 : 900 // seconds
    };
  }

  private checkRateLimit(ip: string): void {
    const attempts = this.loginAttempts.get(ip);
    
    if (attempts && attempts.lockedUntil && attempts.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((attempts.lockedUntil.getTime() - Date.now()) / 1000 / 60);
      throw new UnauthorizedException(
        `Demasiados intentos de login. Intenta de nuevo en ${remainingTime} minutos`
      );
    }
  }

  private recordFailedAttempt(ip: string): void {
    const attempts = this.loginAttempts.get(ip) || { count: 0 };
    attempts.count++;

    if (attempts.count >= this.securityConfig.maxLoginAttempts) {
      attempts.lockedUntil = new Date(Date.now() + this.securityConfig.lockoutDuration * 60 * 1000);
    }

    this.loginAttempts.set(ip, attempts);
  }

  private async recordFailedUserAttempt(user: User): Promise<void> {
    const failedAttempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: any = { failedLoginAttempts: failedAttempts };

    if (failedAttempts >= this.securityConfig.maxLoginAttempts) {
      updateData.lockedUntil = new Date(Date.now() + this.securityConfig.lockoutDuration * 60 * 1000);
    }

    await this.userRepository.update(user.id, updateData);
  }
}
```

## Controlador de Autenticación

### auth/auth.controller.ts

```typescript
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Get,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { GetUser } from './decorators/get-user.decorator';
import { User } from '../domain/entities/user.entity';
import { UserResponseDto } from '../application/dto/user/user-response.dto';
import { plainToClass } from 'class-transformer';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto, @Request() req) {
    const result = await this.authService.register(registerDto);
    
    return {
      message: 'Usuario registrado exitosamente',
      user: plainToClass(UserResponseDto, result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    const context = {
      ip: req.ip,
      deviceInfo: req.get('User-Agent') || 'Unknown',
      rememberMe: loginDto.rememberMe || false
    };

    const result = await this.authService.login(loginDto, context);
    
    return {
      message: 'Login exitoso',
      user: plainToClass(UserResponseDto, result.user),
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(refreshTokenDto.refreshToken);
    
    return {
      message: 'Token renovado exitosamente',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @GetUser() user: User) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await this.authService.logout(token, user.id);
    
    return {
      message: 'Logout exitoso'
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @GetUser('id') userId: string
  ) {
    await this.authService.changePassword(userId, changePasswordDto);
    
    return {
      message: 'Contraseña cambiada exitosamente'
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@GetUser() user: User) {
    return {
      user: plainToClass(UserResponseDto, user)
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@GetUser() user: User) {
    return {
      valid: true,
      user: plainToClass(UserResponseDto, user)
    };
  }
}
```

## Módulo de Autenticación

### auth/auth.module.ts

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { DatabaseModule } from '../database/database.module';
import { SecurityConfig } from '../config/security.config';
import { jwtConfig } from '../config/jwt.config';

@Module({
  imports: [
    DatabaseModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: jwtConfig,
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    RolesGuard,
    WebSocketAuthGuard,
    SecurityConfig,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    WebSocketAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
```

## Actualización del User Entity

Necesitamos agregar campos al User entity para soportar la funcionalidad de auth:

```typescript
// Agregar estos campos al User entity
@Prop({ default: 0 })
failedLoginAttempts: number;

@Prop()
lockedUntil?: Date;

@Prop({ default: 0 })
tokenVersion: number;

@Prop({ 
  type: String, 
  enum: Object.values(UserRole), 
  default: UserRole.USER 
})
role: UserRole;
```

## Checklist de Validación

### ✅ Configuración JWT
- [ ] JWT configurado con access y refresh tokens
- [ ] Configuración de expiración apropiada
- [ ] Secretos diferentes para access y refresh tokens
- [ ] Configuración por ambiente

### ✅ Estrategias Passport
- [ ] LocalStrategy para login con email/password
- [ ] JwtStrategy para validación de access tokens
- [ ] JwtRefreshStrategy para renovación de tokens
- [ ] Validación de usuarios activos

### ✅ Guards de Seguridad
- [ ] JwtAuthGuard para rutas protegidas
- [ ] RolesGuard para autorización por roles
- [ ] WebSocketAuthGuard para conexiones WebSocket
- [ ] Soporte para rutas públicas

### ✅ Validación y Seguridad
- [ ] Validación robusta de DTOs
- [ ] Hash seguro de contraseñas (bcrypt)
- [ ] Rate limiting por IP
- [ ] Bloqueo temporal de cuentas
- [ ] Blacklist de tokens para logout

### ✅ Funcionalidades de Auth
- [ ] Registro con validaciones
- [ ] Login con contexto (IP, device)
- [ ] Refresh token funcional
- [ ] Cambio de contraseña seguro
- [ ] Logout con invalidación de tokens

### ✅ Decoradores y Utilidades
- [ ] @Public() para rutas sin autenticación
- [ ] @Roles() para requerir roles específicos
- [ ] @GetUser() para obtener usuario actual
- [ ] Jerarquía de roles implementada

## Comandos de Validación

### Instalar dependencias
```bash
npm install @nestjs/jwt @nestjs/passport passport passport-local passport-jwt bcrypt
npm install -D @types/passport-local @types/passport-jwt @types/bcrypt
```

### Probar endpoints de autenticación
```bash
# Registrar usuario
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Test123!@#","displayName":"Test User"}'

# Login
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'

# Acceder a ruta protegida
curl -X GET http://localhost:3001/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Variables de entorno requeridas
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_ISSUER=chat-rooms-api
JWT_AUDIENCE=chat-rooms-client
REFRESH_TOKEN_EXPIRY=7d
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_SPECIAL=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_UPPERCASE=true
```

## Troubleshooting

### Error: JWT Secret no configurado
```bash
# Verificar que JWT_SECRET está en .env
# El secreto debe ser lo suficientemente largo y aleatorio
```

### Error: Estrategia no encontrada
```bash
# Verificar que las estrategias están registradas en auth.module.ts
# Verificar imports de PassportModule
```

### Error: Guards no funcionan
```bash
# Verificar que los guards están aplicados en app.module.ts como providers globales
# Verificar que JwtAuthGuard tiene acceso al Reflector
```
