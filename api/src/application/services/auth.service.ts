import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TokenService, HashService } from '../../infrastructure/security';
import { UserRepository } from '../../infrastructure/database';
import { User, UserWithoutPassword, UserStatus } from '../../domain/entities';

// Import DTOs
import { LoginDto, RegisterDto, RefreshTokenDto } from '../dtos';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  user: UserWithoutPassword;
};

/**
 * AuthService - Application Service Layer
 * 
 * This service follows the hexagonal architecture pattern by implementing
 * the business logic for authentication use cases. It orchestrates between
 * domain repositories and infrastructure services.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly hashService: HashService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<TokenPair> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const existingUsername = await this.userRepository.findByUsername(registerDto.username);
    if (existingUsername) {
      throw new BadRequestException('Username is already taken');
    }    // Hash password
    const hashedPassword = await this.hashService.hashPassword(registerDto.password);

    // Create user
    const userData = {
      username: registerDto.username,
      email: registerDto.email,
      password: hashedPassword,
      textColor: (registerDto.textColor || '#000000') as `#${string}`,
      backgroundColor: (registerDto.backgroundColor || '#ffffff') as `#${string}`,
      status: UserStatus.OFFLINE,
      isOnline: false,
      lastSeen: new Date(),
      metadata: {
        lastLoginIp: undefined,
        lastUserAgent: undefined,
        loginCount: 0,
      },
      isAdmin: false,
      role: 'user',
    };

    const user = await this.userRepository.create(userData);

    // Generate tokens
    const tokenPair = this.tokenService.generateTokenPair(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Login user with email and password
   */
  async login(loginDto: LoginDto): Promise<TokenPair> {
    // Find user by email
    const user = await this.userRepository.findByEmail(loginDto.email);
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.hashService.comparePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update login metadata
    await this.userRepository.update(user.id, {
      metadata: {
        ...user.metadata,
        loginCount: user.metadata.loginCount + 1,
      },
    });

    // Generate tokens
    const tokenPair = this.tokenService.generateTokenPair(user);

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: userWithoutPassword,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string }> {
    try {
      const payload = await this.tokenService.verifyToken(refreshTokenDto.refreshToken, true);
      
      // Verify user still exists
      const user = await this.userRepository.findById(payload.sub);
      if (!user || user.deletedAt) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new access token
      const accessToken = this.tokenService.generateAccessToken(user);

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(userId);
    
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Logout user - update status to offline
   */
  async logout(userId: string): Promise<{ message: string }> {
    // Update user status to offline
    await this.userRepository.updateStatus(userId, UserStatus.OFFLINE, false);
    
    return { message: 'Logged out successfully' };
  }

  /**
   * Validate user exists and is active
   */
  async validateUser(userId: string): Promise<UserWithoutPassword> {
    const user = await this.userRepository.findById(userId);
    
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
