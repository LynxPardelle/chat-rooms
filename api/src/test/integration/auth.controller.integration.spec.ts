import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Connection } from 'mongoose';
import { AuthController } from '../../presentation/controllers/auth.controller';
import { AuthService } from '../../application/services/auth.service';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { HashService } from '../../infrastructure/security/services/hash.service';
import { TokenService } from '../../infrastructure/security/services/token.service';
import { JwtStrategy } from '../../infrastructure/security/strategies/jwt.strategy';
import { User, UserSchema } from '../../infrastructure/database/models/user.schema';

describe('AuthController Integration Tests', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let authService: AuthService;  let connection: Connection;

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
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' }
        })
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        UserRepository,
        HashService,
        TokenService,
        JwtStrategy,
        {
          provide: 'JWT_SECRET',
          useValue: 'test-secret'
        },        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'JWT_SECRET':
                case 'jwt.secret':
                  return 'test-secret';
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
    }).compile();app = module.createNestApplication();
    authService = module.get<AuthService>(AuthService);
    connection = module.get<Connection>(getConnectionToken());
    await app.init();
  }, 60000); // 60 second timeout for MongoDB download and setup

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
  beforeEach(async () => {
    // Clean database before each test
    if (connection.db) {
      const collections = await connection.db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.username).toBe(userData.username);
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'SecurePassword123!'
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      });
    });

    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'SecurePassword123!'
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject login with invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword'
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should reject login with non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'SecurePassword123!'
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Create user and get refresh token
      const registerResponse = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      });
      refreshToken = registerResponse.refreshToken;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const registerResponse = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'SecurePassword123!'
      });
      accessToken = registerResponse.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject logout without token', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });
  });
});
