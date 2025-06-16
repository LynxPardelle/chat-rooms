import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Connection } from 'mongoose';
import { AnalyticsController } from '../../presentation/controllers/analytics.controller';
import { AnalyticsService } from '../../application/services/analytics.service';
import { User, UserSchema } from '../../infrastructure/database/models/user.schema';
import { AuthService } from '../../application/services/auth.service';
import { UserRepository } from '../../infrastructure/database/repositories/user.repository';
import { HashService } from '../../infrastructure/security/services/hash.service';
import { TokenService } from '../../infrastructure/security/services/token.service';
import { JwtStrategy } from '../../infrastructure/security/strategies/jwt.strategy';

describe('AnalyticsController Integration Tests', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let analyticsService: AnalyticsService;
  let authService: AuthService;
  let connection: Connection;
  let adminUser: any;
  let accessToken: string;
  beforeAll(async () => {
    // Set longer timeout for MongoDB memory server setup
    jest.setTimeout(60000);
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: User.name, schema: UserSchema }
        ]),
        PassportModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '1h' }
        })
      ],
      controllers: [AnalyticsController],
      providers: [
        AnalyticsService,
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
                case 'ANALYTICS_RETENTION_DAYS':
                case 'analytics.retentionDays':
                  return '90';
                default:
                  return undefined;
              }
            })
          }
        }
      ]
    }).compile();

    app = module.createNestApplication();
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    authService = module.get<AuthService>(AuthService);
    connection = module.get<Connection>(getConnectionToken());
    await app.init();    // Create admin user
    const registerResponse = await authService.register({
      username: 'admin',
      email: 'admin@example.com',
      password: 'SecurePassword123!'
    });
      // Update user to have admin role
    adminUser = registerResponse.user;
    
    // Get the user repository directly to update the user with admin role
    const userRepo = module.get<UserRepository>(UserRepository);
    await userRepo.update(adminUser._id, { role: 'admin', isAdmin: true });
    
    // Regenerate token with admin role
    const loginResponse = await authService.login({
      email: 'admin@example.com',
      password: 'SecurePassword123!'
    });
    
    accessToken = loginResponse.accessToken;
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
    // Clean database before each test but keep the user
    if (connection.db) {
      const collections = await connection.db.collections();
      for (const collection of collections) {
        if (collection.collectionName !== 'users') {
          await collection.deleteMany({});
        }
      }
    }
  });

  describe('GET /analytics/dashboard', () => {
    it('should get analytics dashboard data successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('totalMessages');
      expect(response.body).toHaveProperty('totalRooms');
      expect(response.body).toHaveProperty('activeUsersToday');
    });

    it('should reject dashboard request without authentication', async () => {
      await request(app.getHttpServer())
        .get('/analytics/dashboard')
        .expect(401);
    });
  });

  describe('GET /analytics/performance', () => {
    it('should get performance metrics successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/performance')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cpuUsage');
      expect(response.body).toHaveProperty('memoryUsage');
      expect(response.body).toHaveProperty('responseTime');
      expect(response.body).toHaveProperty('errorRate');
    });

    it('should handle performance metrics with date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get(`/analytics/performance?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cpuUsage');
      expect(response.body).toHaveProperty('memoryUsage');
    });
  });

  describe('GET /analytics/user-activity', () => {
    it('should get user activity data successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/user-activity')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyActiveUsers');
      expect(response.body).toHaveProperty('monthlyActiveUsers');
      expect(response.body).toHaveProperty('userRegistrations');
    });

    it('should handle user activity with filters', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/user-activity?period=7d')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('dailyActiveUsers');
    });
  });

  describe('GET /analytics/message-analytics', () => {
    it('should get message analytics successfully', async () => {
      const response = await request(app.getHttpServer())
        .get('/analytics/message-analytics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalMessages');
      expect(response.body).toHaveProperty('messagesPerDay');
      expect(response.body).toHaveProperty('popularRooms');
    });

    it('should handle message analytics with room filter', async () => {
      const roomId = '507f1f77bcf86cd799439011';
      
      const response = await request(app.getHttpServer())
        .get(`/analytics/message-analytics?roomId=${roomId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalMessages');
    });
  });

  describe('POST /analytics/export', () => {
    it('should export analytics data successfully', async () => {
      const exportRequest = {
        type: 'dashboard',
        format: 'csv',
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      };

      const response = await request(app.getHttpServer())
        .post('/analytics/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(exportRequest)
        .expect(200);

      expect(response.body).toHaveProperty('exportId');
      expect(response.body).toHaveProperty('downloadUrl');
    });

    it('should reject export request with invalid format', async () => {
      const exportRequest = {
        type: 'dashboard',
        format: 'invalid',
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      };

      await request(app.getHttpServer())
        .post('/analytics/export')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(exportRequest)
        .expect(400);
    });
  });
});
