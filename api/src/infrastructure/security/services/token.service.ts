import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../../domain/entities';
import { JwtPayload } from '../strategies/jwt.strategy';
import { JwtRefreshPayload } from '../strategies/jwt-refresh.strategy';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  generateAccessToken(user: User): string {    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || false,
      role: user.role || 'user',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });
  }

  generateRefreshToken(user: User): string {
    const payload: JwtRefreshPayload = {
      sub: user.id,
      username: user.username,
      tokenType: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });
  }

  generateTokenPair(user: User): TokenPair {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user),
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '15m',
    };
  }

  async verifyToken(token: string, isRefresh = false): Promise<JwtPayload | JwtRefreshPayload> {
    const secret = isRefresh 
      ? this.configService.get<string>('jwt.refreshSecret')
      : this.configService.get<string>('jwt.secret');

    return this.jwtService.verifyAsync(token, { secret });
  }

  decodeToken(token: string): JwtPayload | JwtRefreshPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload | JwtRefreshPayload;
    } catch {
      return null;
    }
  }
}
