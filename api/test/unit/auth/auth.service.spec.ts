import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';

import { AuthService } from '../../../src/application/services/auth.service';
import { UserRepository } from '../../../src/infrastructure/database';
import { HashService } from '../../../src/infrastructure/security/services/hash.service';
import { TokenService } from '../../../src/infrastructure/security/services/token.service';
import { TestDatabaseModule } from '../../infrastructure/test-database.module';
import { UserFactory } from '../../infrastructure/test-utilities.module';
import { User, UserStatus } from '../../../src/domain/entities';

describe('AuthService - Comprehensive Testing', () => {
  let service: AuthService;
  let userRepository: UserRepository;
  let hashService: HashService;
  let tokenService: TokenService;
  let module: TestingModule;

  beforeAll(async () => {
    // Setup test database
    const uri = await TestDatabaseModule.setupDatabase();
    
    module = await Test.createTestingModule({
      imports: [TestDatabaseModule],
      providers: [
        AuthService,
        UserRepository,
        HashService,
        TokenService,
        JwtService,
        ConfigService,
        {
          provide: getModelToken('User'),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            countDocuments: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<UserRepository>(UserRepository);
    hashService = module.get<HashService>(HashService);
    tokenService = module.get<TokenService>(TokenService);
  });

  beforeEach(async () => {
    await TestDatabaseModule.cleanDatabase();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await TestDatabaseModule.teardownDatabase();
    await module.close();
  });

  describe('User Registration', () => {
    describe('Valid Registration', () => {
      it('should successfully register a new user with valid data', async () => {
        const registerData = {
          username: 'testuser',
          email: 'test@example.com',
          password: 'SecurePass123!',
          displayName: 'Test User',
        };

        const hashedPassword = 'hashed_password_123';
        const createdUser = UserFactory.create({
          ...registerData,
          password: hashedPassword,
        });

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
        jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
        jest.spyOn(hashService, 'hashPassword').mockResolvedValue(hashedPassword);
        jest.spyOn(userRepository, 'create').mockResolvedValue(createdUser);
        jest.spyOn(tokenService, 'generateTokenPair').mockReturnValue({
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: '15m',
        });

        const result = await service.register(registerData);

        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(userRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
        expect(userRepository.findByUsername).toHaveBeenCalledWith(registerData.username);
        expect(hashService.hashPassword).toHaveBeenCalledWith(registerData.password);
      });

      it('should apply default user settings on registration', async () => {
        const registerData = UserFactory.create();
        
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
        jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
        jest.spyOn(hashService, 'hashPassword').mockResolvedValue('hashed_password');
        jest.spyOn(tokenService, 'generateTokenPair').mockReturnValue({
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: '15m',
        });        const createSpy = jest.spyOn(userRepository, 'create').mockResolvedValue(registerData);

        await service.register(registerData);

        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            textColor: expect.any(String),
            backgroundColor: expect.any(String),
            status: UserStatus.OFFLINE,
          })
        );
      });
    });

    describe('Invalid Registration', () => {
      it('should throw BadRequestException for duplicate email', async () => {
        const registerData = UserFactory.create();
        const existingUser = UserFactory.create({ email: registerData.email });

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(existingUser);

        await expect(service.register(registerData)).rejects.toThrow(BadRequestException);
        expect(userRepository.findByEmail).toHaveBeenCalledWith(registerData.email);
      });

      it('should throw BadRequestException for duplicate username', async () => {
        const registerData = UserFactory.create();
        const existingUser = UserFactory.create({ username: registerData.username });

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
        jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(existingUser);

        await expect(service.register(registerData)).rejects.toThrow(BadRequestException);
        expect(userRepository.findByUsername).toHaveBeenCalledWith(registerData.username);
      });
    });
  });

  describe('User Login', () => {
    describe('Valid Login', () => {      it('should successfully login with correct credentials', async () => {
        const password = 'SecurePass123!';
        const user = UserFactory.create({ 
          status: UserStatus.ONLINE,
          metadata: { loginCount: 0 }
        });

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(hashService, 'comparePassword').mockResolvedValue(true);
        jest.spyOn(userRepository, 'update').mockResolvedValue(user);
        jest.spyOn(tokenService, 'generateTokenPair').mockReturnValue({
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: '15m',
        });

        const result = await service.login({
          email: user.email,
          password,
        });

        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(userRepository.update).toHaveBeenCalled();
      });

      it('should update user login metadata on login', async () => {
        const password = 'SecurePass123!';
        const user = UserFactory.create({ 
          status: UserStatus.ONLINE,
          metadata: { loginCount: 5 }
        });

        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(hashService, 'comparePassword').mockResolvedValue(true);
        jest.spyOn(tokenService, 'generateTokenPair').mockReturnValue({
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          expiresIn: '15m',
        });
        const updateSpy = jest.spyOn(userRepository, 'update').mockResolvedValue(user);

        await service.login({ email: user.email, password });

        expect(updateSpy).toHaveBeenCalledWith(user.id, {
          metadata: {
            ...user.metadata,
            loginCount: user.metadata.loginCount + 1,
          },
        });
      });
    });

    describe('Invalid Login', () => {
      it('should throw UnauthorizedException for non-existent user', async () => {
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);

        await expect(service.login({
          email: 'nonexistent@example.com',
          password: 'password',
        })).rejects.toThrow(UnauthorizedException);
      });      it('should throw UnauthorizedException for incorrect password', async () => {
        const user = UserFactory.create({ status: UserStatus.OFFLINE });
        
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(hashService, 'comparePassword').mockResolvedValue(false);

        await expect(service.login({
          email: user.email,
          password: 'wrongpassword',
        })).rejects.toThrow(UnauthorizedException);
      });      it('should accept valid user credentials', async () => {
        const user = UserFactory.create({ status: UserStatus.OFFLINE });
        
        jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
        jest.spyOn(hashService, 'comparePassword').mockResolvedValue(true);

        const result = await service.login({
          email: user.email,
          password: 'password',
        });

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
      });
    });
  });

  describe('Token Operations', () => {
    describe('Token Refresh', () => {      it('should refresh tokens with valid refresh token', async () => {
        const user = UserFactory.create();
        const refreshPayload = { 
          sub: user.id, 
          username: user.username, 
          tokenType: 'refresh' as const 
        };

        jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(refreshPayload);
        jest.spyOn(userRepository, 'findById').mockResolvedValue(user);
        jest.spyOn(tokenService, 'generateAccessToken').mockReturnValue('new_access_token');

        const result = await service.refreshToken({ refreshToken: 'valid_refresh_token' });

        expect(result).toHaveProperty('accessToken', 'new_access_token');
        expect(tokenService.verifyToken).toHaveBeenCalledWith('valid_refresh_token', true);
      });

      it('should throw UnauthorizedException for invalid refresh token', async () => {
        jest.spyOn(tokenService, 'verifyToken').mockRejectedValue(new Error('Invalid token'));

        await expect(service.refreshToken({ 
          refreshToken: 'invalid_refresh_token' 
        })).rejects.toThrow(UnauthorizedException);
      });      it('should throw UnauthorizedException for deleted user', async () => {
        const user = UserFactory.create({ deletedAt: new Date() });
        const refreshPayload = { 
          sub: user.id, 
          username: user.username, 
          tokenType: 'refresh' as const 
        };

        jest.spyOn(tokenService, 'verifyToken').mockResolvedValue(refreshPayload);
        jest.spyOn(userRepository, 'findById').mockResolvedValue(user);

        await expect(service.refreshToken({ 
          refreshToken: 'valid_refresh_token' 
        })).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('User Profile Operations', () => {
    describe('Get Profile', () => {
      it('should return user profile without password', async () => {
        const user = UserFactory.create();
        
        jest.spyOn(userRepository, 'findById').mockResolvedValue(user);

        const result = await service.getProfile(user.id);

        expect(result).not.toHaveProperty('password');
        expect(result).toHaveProperty('username', user.username);
        expect(result).toHaveProperty('email', user.email);
      });

      it('should throw UnauthorizedException for non-existent user', async () => {
        jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

        await expect(service.getProfile('nonexistent_id')).rejects.toThrow(UnauthorizedException);
      });

      it('should throw UnauthorizedException for deleted user', async () => {
        const user = UserFactory.create({ deletedAt: new Date() });
        
        jest.spyOn(userRepository, 'findById').mockResolvedValue(user);

        await expect(service.getProfile(user.id)).rejects.toThrow(UnauthorizedException);
      });
    });
  });

  describe('User Logout', () => {
    it('should successfully logout user and update status', async () => {
      const user = UserFactory.create();
      
      jest.spyOn(userRepository, 'updateStatus').mockResolvedValue(true);

      const result = await service.logout(user.id);

      expect(result).toHaveProperty('message', 'Logged out successfully');
      expect(userRepository.updateStatus).toHaveBeenCalledWith(user.id, UserStatus.OFFLINE, false);
    });
  });

  describe('User Validation', () => {
    it('should validate and return user without password', async () => {
      const user = UserFactory.create();
      
      jest.spyOn(userRepository, 'findById').mockResolvedValue(user);

      const result = await service.validateUser(user.id);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('username', user.username);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValue(null);

      await expect(service.validateUser('nonexistent_id')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for deleted user', async () => {
      const user = UserFactory.create({ deletedAt: new Date() });
      
      jest.spyOn(userRepository, 'findById').mockResolvedValue(user);

      await expect(service.validateUser(user.id)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors during authentication', async () => {
      const registerData = UserFactory.create();

      jest.spyOn(userRepository, 'findByEmail').mockRejectedValue(new Error('Database connection error'));

      await expect(service.register(registerData)).rejects.toThrow('Database connection error');
    });

    it('should handle hash service errors gracefully', async () => {
      const registerData = UserFactory.create();

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(userRepository, 'findByUsername').mockResolvedValue(null);
      jest.spyOn(hashService, 'hashPassword').mockRejectedValue(new Error('Hash service error'));

      await expect(service.register(registerData)).rejects.toThrow('Hash service error');
    });    it('should handle token service errors gracefully', async () => {
      const user = UserFactory.create({ status: UserStatus.OFFLINE });

      jest.spyOn(userRepository, 'findByEmail').mockResolvedValue(user);
      jest.spyOn(hashService, 'comparePassword').mockResolvedValue(true);
      jest.spyOn(userRepository, 'update').mockResolvedValue(user);
      jest.spyOn(tokenService, 'generateTokenPair').mockImplementation(() => {
        throw new Error('Token generation error');
      });

      await expect(service.login({
        email: user.email,
        password: 'password',
      })).rejects.toThrow('Token generation error');
    });
  });
});
