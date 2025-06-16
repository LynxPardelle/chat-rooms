import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { HashService } from '../../infrastructure/security/services/hash.service';
import { TokenService } from '../../infrastructure/security/services/token.service';
import { JwtAuthGuard } from '../../infrastructure/security/guards/jwt-auth.guard';
import { JwtStrategy } from '../../infrastructure/security/strategies/jwt.strategy';
import { SanitizationService } from '../../infrastructure/security/services/sanitization.service';
import { AdminGuard } from '../../infrastructure/security/guards/admin.guard';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { User, UserSchema } from '../../infrastructure/database/models/user.schema';
import { UserStatus } from '../../domain/types';

describe('Security Tests', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let hashService: HashService;
  let tokenService: TokenService;
  let sanitizationService: SanitizationService;
  beforeAll(async () => {
    // Set longer timeout for MongoDB memory server setup
    jest.setTimeout(60000);
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        PassportModule,
        JwtModule.register({
          secret: 'test-secret-key-for-security-testing',
          signOptions: { expiresIn: '1h' }
        })
      ],      providers: [
        HashService,
        TokenService,
        SanitizationService,
        JwtAuthGuard,
        JwtStrategy,
        UserRepository,
        AdminGuard,
        {
          provide: 'JWT_SECRET',
          useValue: 'test-secret-key-for-security-testing'
        },        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                case 'jwt.secret':
                  return 'test-secret-key-for-security-testing';
                case 'JWT_EXPIRES_IN':
                case 'jwt.expiresIn':
                  return '1h';
                case 'JWT_REFRESH_SECRET':
                case 'jwt.refreshSecret':
                  return 'test-refresh-secret';
                case 'JWT_REFRESH_EXPIRES_IN':
                case 'jwt.refreshExpiresIn':
                  return '7d';
                default:
                  return undefined;
              }
            })
          }
        }
      ]
    }).compile();

    app = module.createNestApplication();    hashService = module.get<HashService>(HashService);
    tokenService = module.get<TokenService>(TokenService);
    sanitizationService = module.get<SanitizationService>(SanitizationService);
    await app.init();
  }, 60000); // 60 second timeout

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('HashService Security Tests', () => {
    it('should hash passwords securely', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashService.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]?\$\d{1,2}\$/); // bcrypt format
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashService.hashPassword(password);

      const isValid = await hashService.comparePassword(password, hashedPassword);
      expect(isValid).toBe(true);

      const isInvalid = await hashService.comparePassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashService.hashPassword(password);
      const hash2 = await hashService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(await hashService.comparePassword(password, hash1)).toBe(true);
      expect(await hashService.comparePassword(password, hash2)).toBe(true);
    });

    it('should handle empty and null passwords securely', async () => {
      await expect(hashService.hashPassword('')).rejects.toThrow();
      await expect(hashService.hashPassword(null as any)).rejects.toThrow();
      await expect(hashService.hashPassword(undefined as any)).rejects.toThrow();
    });
  });  describe('TokenService Security Tests', () => {
    const testUser = {
      id: '507f1f77bcf86cd799439011',
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      textColor: '#000000' as const,
      backgroundColor: '#ffffff' as const,
      status: UserStatus.ONLINE,
      isOnline: true,
      lastSeen: new Date(),
      metadata: {
        lastLoginIp: '127.0.0.1',
        lastUserAgent: 'test-agent',
        loginCount: 1
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should generate valid JWT tokens', async () => {
      const token = await tokenService.generateAccessToken(testUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should generate different tokens each time', async () => {
      const token1 = await tokenService.generateAccessToken(testUser);
      const token2 = await tokenService.generateAccessToken(testUser);

      expect(token1).not.toBe(token2);
    });

    it('should verify valid tokens correctly', async () => {
      const token = await tokenService.generateAccessToken(testUser);
      const decoded = await tokenService.verifyToken(token) as any;

      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
      expect(decoded.email).toBe(testUser.email);
    });

    it('should reject invalid tokens', async () => {
      const invalidToken = 'invalid.token.signature';
      await expect(tokenService.verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should reject tampered tokens', async () => {
      const token = await tokenService.generateAccessToken(testUser);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      await expect(tokenService.verifyToken(tamperedToken)).rejects.toThrow();
    });

    it('should handle refresh tokens securely', async () => {
      const refreshToken = await tokenService.generateRefreshToken(testUser);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken).not.toBe(await tokenService.generateAccessToken(testUser));
    });
  });

  describe('SanitizationService Security Tests', () => {
    it('should sanitize HTML input correctly', () => {
      const maliciousHtml = '<script>alert("XSS")</script><p>Safe content</p>';
      const sanitized = sanitizationService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("XSS")');
      expect(sanitized).toContain('Safe content');
    });

    it('should remove dangerous attributes', () => {
      const maliciousHtml = '<img src="x" onerror="alert(1)" /><div onclick="malicious()">Content</div>';
      const sanitized = sanitizationService.sanitizeHtml(maliciousHtml);

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('malicious');
    });

    it('should preserve safe HTML elements', () => {
      const safeHtml = '<p>Safe <strong>content</strong> with <em>emphasis</em></p>';
      const sanitized = sanitizationService.sanitizeHtml(safeHtml);

      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<em>');
      expect(sanitized).toContain('Safe content');
    });

    it('should handle various XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import"javascript:alert(1)";</style>'
      ];

      xssAttempts.forEach(xss => {
        const sanitized = sanitizationService.sanitizeHtml(xss);
        expect(sanitized).not.toContain('alert');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('<script');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
      });
    });

    it('should sanitize SQL injection attempts', () => {
      const sqlInjections = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "admin' /*",
        "' UNION SELECT * FROM users --"
      ];

      sqlInjections.forEach(sql => {
        const sanitized = sanitizationService.sanitizeText(sql);
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('UNION SELECT');
        expect(sanitized).not.toContain('--');
        expect(sanitized).not.toContain('/*');
      });
    });
  });

  describe('Input Validation Security Tests', () => {
    it('should reject malformed email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..double.dot@example.com',
        'user@example',
        'user name@example.com',
        'user@exam ple.com'
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    it('should validate strong passwords', () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123',
        'Password',
        '12345678'
      ];

      // Strong password regex: at least 8 chars, uppercase, lowercase, number, special char
      const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
      
      weakPasswords.forEach(password => {
        expect(strongPasswordRegex.test(password)).toBe(false);
      });

      const strongPasswords = [
        'SecurePassword123!',
        'MyP@ssw0rd2024',
        'Str0ng!P@ss',
        'Complex$Pass1'
      ];

      strongPasswords.forEach(password => {
        expect(strongPasswordRegex.test(password)).toBe(true);
      });
    });

    it('should validate username format', () => {
      const invalidUsernames = [
        'user@name',
        'user name',
        'user..name',
        'user--name',
        '.username',
        'username.',
        'u',
        'a'.repeat(51) // too long
      ];

      const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,48}[a-zA-Z0-9]$/;
      
      invalidUsernames.forEach(username => {
        expect(usernameRegex.test(username)).toBe(false);
      });

      const validUsernames = [
        'validuser',
        'user123',
        'user.name',
        'user_name',
        'user-name',
        'User123'
      ];

      validUsernames.forEach(username => {
        expect(usernameRegex.test(username)).toBe(true);
      });
    });
  });

  describe('Authorization Security Tests', () => {
    it('should require authentication for protected routes', async () => {
      // Test protected route without token
      await request(app.getHttpServer())
        .get('/protected-endpoint')
        .expect(401);
    });

    it('should reject requests with invalid Bearer tokens', async () => {
      const invalidTokens = [
        'Bearer invalid-token',
        'Bearer ',
        'Invalid-Header-Format',
        'Bearer ' + 'a'.repeat(1000), // very long token
        'Bearer null',
        'Bearer undefined'
      ];

      for (const invalidToken of invalidTokens) {
        await request(app.getHttpServer())
          .get('/protected-endpoint')
          .set('Authorization', invalidToken)
          .expect(401);
      }
    });

    it('should handle missing authorization header gracefully', async () => {
      await request(app.getHttpServer())
        .get('/protected-endpoint')
        .expect(401);
    });
  });

  describe('Rate Limiting Security Tests', () => {
    it('should implement rate limiting for authentication endpoints', async () => {
      const loginAttempts = Array(10).fill(null).map(() => 
        request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'wrong-password' })
      );

      const responses = await Promise.all(loginAttempts);
      
      // Should have some 429 (Too Many Requests) responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Security Tests', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' })
        .expect(401);

      // Should not reveal whether user exists or not
      expect(response.body.message).not.toContain('user not found');
      expect(response.body.message).not.toContain('email does not exist');
      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('query');
    });

    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid":"json"')
        .expect(400);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.message).not.toContain('SyntaxError');
    });
  });
});
