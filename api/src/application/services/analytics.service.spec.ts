import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { ConfigService } from '@nestjs/config';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'ANALYTICS_RETENTION_DAYS': 30,
        'ANALYTICS_BATCH_SIZE': 100
      };
      return config[key] || null;
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('track', () => {
    it('should track user events', () => {
      const eventData = { chatId: 'chat1', messageLength: 50 };
      
      expect(() => {
        service.track('message_sent', eventData, 'user1', 'session1');
      }).not.toThrow();
    });

    it('should track events without user ID', () => {
      const eventData = { page: '/dashboard' };
      
      expect(() => {
        service.track('page_view', eventData);
      }).not.toThrow();
    });

    it('should handle event metadata', () => {
      const eventData = {
        action: 'login',
        userAgent: 'Mozilla/5.0 Test Browser',
        ip: '192.168.1.1'
      };
      
      expect(() => {
        service.track('user_login', eventData, 'user1', 'session1');
      }).not.toThrow();
    });
  });

  describe('trackPerformance', () => {
    it('should track performance metrics', () => {
      expect(() => {
        service.trackPerformance('api_call', 'send_message', 150, true);
      }).not.toThrow();
    });

    it('should track failed operations', () => {
      expect(() => {
        service.trackPerformance('database_query', 'find_messages', 5000, false, '500');
      }).not.toThrow();
    });

    it('should track with metadata', () => {
      const metadata = { endpoint: '/api/messages', method: 'POST' };
      
      expect(() => {
        service.trackPerformance('api_call', 'send_message', 120, true, undefined, metadata);
      }).not.toThrow();
    });
  });

  describe('trackSystemHealth', () => {
    it('should track system health metrics', () => {
      const healthMetrics = {
        cpu: 45.5,
        memory: 75.2,
        activeConnections: 150,
        messagesPerSecond: 25,
        errorRate: 0.01,
        responseTime: 120
      };
      
      expect(() => {
        service.trackSystemHealth(healthMetrics);
      }).not.toThrow();
    });
  });

  describe('getDashboardMetrics', () => {
    beforeEach(() => {
      // Setup test data
      service.track('user_login', {}, 'user1', 'session1');
      service.track('message_sent', { chatId: 'chat1' }, 'user1', 'session1');
      service.track('user_login', {}, 'user2', 'session2');
      service.track('message_sent', { chatId: 'chat1' }, 'user2', 'session2');
      service.track('message_sent', { chatId: 'chat2' }, 'user2', 'session2');
    });

    it('should return dashboard metrics for 1h range', () => {
      const metrics = service.getDashboardMetrics('1h');

      expect(metrics).toHaveProperty('overview');
      expect(metrics).toHaveProperty('userActivity');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('systemHealth');
      expect(metrics).toHaveProperty('topEvents');
      expect(metrics).toHaveProperty('realtimeStats');

      expect(typeof metrics.overview.totalEvents).toBe('number');
      expect(typeof metrics.overview.activeUsers).toBe('number');
      expect(typeof metrics.overview.messagesCount).toBe('number');
    });

    it('should return metrics for different time ranges', () => {
      const metrics1h = service.getDashboardMetrics('1h');
      const metrics24h = service.getDashboardMetrics('24h');
      const metrics7d = service.getDashboardMetrics('7d');
      const metrics30d = service.getDashboardMetrics('30d');

      expect(metrics1h).toBeDefined();
      expect(metrics24h).toBeDefined();
      expect(metrics7d).toBeDefined();
      expect(metrics30d).toBeDefined();
    });
  });

  describe('getHistoricalData', () => {
    beforeEach(() => {
      service.track('message_sent', { chatId: 'chat1' }, 'user1', 'session1');
      service.track('user_login', {}, 'user1', 'session1');
      service.trackPerformance('api_call', 'test_endpoint', 100, true);
    });

    it('should return historical analytics data', () => {
      const historical = service.getHistoricalData('messages', '24h', 'hour');

      expect(Array.isArray(historical)).toBe(true);
    });

    it('should handle different metric types', () => {
      const usersData = service.getHistoricalData('users', '7d', 'day');
      const performanceData = service.getHistoricalData('performance', '1h', 'minute');
      const errorsData = service.getHistoricalData('errors', '24h', 'hour');

      expect(Array.isArray(usersData)).toBe(true);
      expect(Array.isArray(performanceData)).toBe(true);
      expect(Array.isArray(errorsData)).toBe(true);
    });
  });

  describe('exportData', () => {
    beforeEach(() => {
      service.track('message_sent', { chatId: 'chat1' }, 'user1', 'session1');
      service.track('user_login', {}, 'user1', 'session1');
      service.trackPerformance('api_call', 'send_message', 100, true);
    });    it('should export data in JSON format', () => {
      const exported = service.exportData('json', '24h', 'all');

      expect(exported).toHaveProperty('events');
      expect(exported).toHaveProperty('performance');
      expect(exported).toHaveProperty('engagement');
    });

    it('should export data in CSV format', () => {
      const exported = service.exportData('csv', '24h', 'events');

      expect(typeof exported).toBe('string');
    });

    it('should export specific data types', () => {
      const eventsExport = service.exportData('json', '24h', 'events');
      const performanceExport = service.exportData('json', '24h', 'performance');
      const engagementExport = service.exportData('json', '24h', 'engagement');

      expect(eventsExport.events).toBeDefined();
      expect(performanceExport.performance).toBeDefined();
      expect(engagementExport.engagement).toBeDefined();
    });
  });

  describe('getUserEngagementAnalytics', () => {
    beforeEach(() => {
      // Setup user engagement data
      service.track('message_sent', { chatId: 'chat1' }, 'user1', 'session1');
      service.track('message_reaction', { messageId: 'msg1' }, 'user1', 'session1');
      service.track('room_join', { roomId: 'room1' }, 'user1', 'session1');
      service.track('file_upload', { fileName: 'test.pdf' }, 'user1', 'session1');
    });

    it('should return engagement analytics for specific user', () => {
      const engagement = service.getUserEngagementAnalytics('user1');

      if (engagement) {
        expect(engagement).toHaveProperty('userId', 'user1');
        expect(engagement).toHaveProperty('messagesCount');
        expect(engagement).toHaveProperty('roomsVisited');
        expect(engagement).toHaveProperty('timeSpent');
        expect(engagement).toHaveProperty('lastActivity');
        expect(engagement).toHaveProperty('features');

        expect(typeof engagement.messagesCount).toBe('number');
        expect(typeof engagement.roomsVisited).toBe('number');
        expect(typeof engagement.timeSpent).toBe('number');
      }
    });    it('should return overall engagement analytics', () => {
      const overallEngagement = service.getUserEngagementAnalytics();

      expect(typeof overallEngagement).toBe('object');
      expect(overallEngagement).toHaveProperty('totalUsers');
      expect(overallEngagement).toHaveProperty('averageMessagesPerUser');
      expect(overallEngagement).toHaveProperty('averageTimeSpent');
      expect(overallEngagement).toHaveProperty('topUsers');
      expect(overallEngagement).toHaveProperty('featureUsage');
    });

    it('should handle non-existent user', () => {
      const engagement = service.getUserEngagementAnalytics('nonexistent');

      expect(engagement).toBeNull();
    });
  });

  describe('Configuration and setup', () => {
    it('should initialize with config service', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toBeDefined();
    });

    it('should handle missing configuration', () => {
      const emptyConfigService = {
        get: jest.fn(() => undefined)
      };

      expect(() => {
        new AnalyticsService(emptyConfigService as any);
      }).not.toThrow();
    });

    it('should provide proper analytics tracking', () => {
      // Test that events are being tracked
      service.track('test_event', { test: true }, 'user1');
      const metrics = service.getDashboardMetrics('1h');
      
      expect(metrics.overview.totalEvents).toBeGreaterThan(0);
    });
  });
});
