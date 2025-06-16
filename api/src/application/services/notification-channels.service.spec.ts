import { Test, TestingModule } from '@nestjs/testing';
import { NotificationChannelsService } from './notification-channels.service';
import { ConfigService } from '@nestjs/config';
import { NotificationData, UserNotificationSettings } from '../../infrastructure/websockets/services/notification.service';

describe('NotificationChannelsService', () => {
  let service: NotificationChannelsService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        'SMTP_HOST': 'smtp.test.com',
        'SMTP_PORT': 587,
        'SMTP_USER': 'test@example.com',
        'SMTP_PASS': 'password',
        'PUSH_VAPID_PUBLIC_KEY': 'test-public-key',
        'PUSH_VAPID_PRIVATE_KEY': 'test-private-key',
        'SMS_PROVIDER_API_KEY': 'test-sms-key',
        'SMS_PROVIDER_URL': 'https://api.sms.test.com'
      };
      return config[key];
    })
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationChannelsService,
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ],
    }).compile();

    service = module.get<NotificationChannelsService>(NotificationChannelsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMultiChannelNotification', () => {
    const createNotificationData = (): NotificationData => ({
      id: 'notification-1',
      type: 'message',
      title: 'Test Notification',
      body: 'This is a test message',
      timestamp: Date.now(),
      userId: 'user1',
      messageId: 'msg1',
      priority: 'normal',
      data: { chatId: 'chat1' }
    });

    const createUserSettings = (): UserNotificationSettings => ({
      userId: 'user1',
      webPushEnabled: true,
      desktopEnabled: true,
      soundEnabled: true,
      vibrationEnabled: false,
      mentions: true,
      directMessages: true,
      roomMessages: true,
      reactions: false,
      systemUpdates: true,
      mutedRooms: new Set(),
      mutedUsers: new Set()
    });

    it('should send notification through multiple channels', async () => {
      const notification = createNotificationData();
      const userSettings = createUserSettings();

      const result = await service.sendMultiChannelNotification(
        notification,
        userSettings,
        'test@example.com'
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.channels)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle urgent priority notifications', async () => {
      const notification = { ...createNotificationData(), priority: 'urgent' as const };
      const userSettings = createUserSettings();

      const result = await service.sendMultiChannelNotification(
        notification,
        userSettings,
        'test@example.com',
        '+1234567890'
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('errors');
    });

    it('should handle missing contact info gracefully', async () => {
      const notification = createNotificationData();
      const userSettings = createUserSettings();

      const result = await service.sendMultiChannelNotification(
        notification,
        userSettings
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('errors');
    });

    it('should handle disabled notification settings', async () => {
      const notification = createNotificationData();
      const userSettings = {
        ...createUserSettings(),
        webPushEnabled: false,
        desktopEnabled: false,
        directMessages: false
      };

      const result = await service.sendMultiChannelNotification(
        notification,
        userSettings,
        'test@example.com'
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Configuration', () => {
    it('should initialize with config service', () => {
      expect(service).toBeDefined();
      expect(mockConfigService.get).toBeDefined();
    });

    it('should handle missing configuration gracefully', () => {
      const emptyConfigService = {
        get: jest.fn(() => undefined)
      };

      expect(() => {
        new NotificationChannelsService(emptyConfigService as any);
      }).not.toThrow();
    });
  });
});
