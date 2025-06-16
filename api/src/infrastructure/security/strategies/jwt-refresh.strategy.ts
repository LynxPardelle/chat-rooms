import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from '../../database/repositories/user.repository';

export type JwtRefreshPayload = {
  sub: string; // user id
  username: string;
  tokenType: 'refresh';
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {  constructor(
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
  ) {
    const refreshSecret = configService.get<string>('jwt.refreshSecret');
    
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: refreshSecret,
    });
  }

  async validate(payload: JwtRefreshPayload) {
    // Verify this is actually a refresh token
    if (payload.tokenType !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepository.findById(payload.sub);
    
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // Return user without password for security
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
