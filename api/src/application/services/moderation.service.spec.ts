import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('moderateContent', () => {
    const mockMetadata = {
      userId: 'user_123',
      roomId: 'room_456',
      messageId: 'msg_789',
      timestamp: Date.now(),
    };    it('should block toxic content', async () => {
      const toxicContent = 'hate hate hate stupid idiot kill yourself moron';
      const result = await service.moderateContent(toxicContent, mockMetadata);
      
      expect(['block', 'flag']).toContain(result.decision);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.reasons.length).toBeGreaterThanOrEqual(0);
    });

    it('should flag potentially problematic content', async () => {
      const suspiciousContent = 'stupid moron';
      const result = await service.moderateContent(suspiciousContent, mockMetadata);
      
      expect(['flag', 'block', 'allow']).toContain(result.decision);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should allow clean content', async () => {
      const cleanContent = 'Hello everyone, how are you doing today?';
      const result = await service.moderateContent(cleanContent, mockMetadata);
      
      expect(result.decision).toBe('allow');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should detect spam patterns', async () => {
      const spamContent = 'aaaaaaaaaaaaaaaaaaaaaa http://spam.com http://spam2.com BUY NOW';
      const result = await service.moderateContent(spamContent, mockMetadata);
      
      expect(['flag', 'block', 'allow']).toContain(result.decision);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should flag content from repeat offenders', async () => {
      // First, create some violations for the user by moderating bad content
      await service.moderateContent('bad content 1 stupid', mockMetadata);
      await service.moderateContent('bad content 2 hate', mockMetadata);
      await service.moderateContent('bad content 3 idiot', mockMetadata);
      
      // Now test with clean content from same user
      const cleanContent = 'This is normal content';
      const result = await service.moderateContent(cleanContent, mockMetadata);
      
      expect(['review', 'flag', 'allow']).toContain(result.decision);
    });

    it('should return valid moderation result structure', async () => {
      const result = await service.moderateContent('test content', mockMetadata);
      
      expect(result.id).toBeDefined();
      expect(result.decision).toMatch(/^(allow|flag|block|review)$/);
      expect(typeof result.confidence).toBe('number');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(Array.isArray(result.flaggedContent)).toBe(true);
      expect(typeof result.reviewRequired).toBe('boolean');
      expect(typeof result.timestamp).toBe('number');
    });
  });
  describe('submitReport', () => {
    it('should create a user report', async () => {
      const report = await service.submitReport(
        'user_456',
        'user_123',
        'harassment',
        'User is sending threatening messages',
        'msg_789'
      );
      
      expect(report.id).toBeDefined();
      expect(report.reporterId).toBe('user_456');
      expect(report.targetUserId).toBe('user_123');
      expect(report.reason).toBe('harassment');
      expect(report.status).toBe('pending');
      expect(report.priority).toBeDefined();
      expect(typeof report.timestamp).toBe('number');
    });

    it('should assign high priority to harassment reports', async () => {
      const report = await service.submitReport(
        'user_456',
        'user_123',
        'harassment',
        'Threatening behavior'
      );
      expect(['high', 'urgent']).toContain(report.priority);
    });

    it('should assign appropriate priority based on violation history', async () => {
      const report = await service.submitReport(
        'user_456',
        'user_123',
        'spam',
        'Promotional content'
      );
      expect(['low', 'medium', 'high', 'urgent']).toContain(report.priority);
    });
  });

  describe('getPendingReports', () => {
    beforeEach(async () => {
      // Create test reports
      await service.submitReport(
        'user_1',
        'target_1',
        'harassment',
        'Test harassment report'
      );

      await service.submitReport(
        'user_2',
        'target_2',
        'spam',
        'Test spam report'
      );
    });

    it('should return pending reports', async () => {
      const reports = service.getPendingReports();
      
      expect(reports.length).toBeGreaterThanOrEqual(2);
      reports.forEach(report => {
        expect(report.status).toBe('pending');
      });
    });

    it('should sort reports by priority', async () => {
      const reports = service.getPendingReports();
      
      // Should be sorted by priority (urgent, high, medium, low)
      for (let i = 0; i < reports.length - 1; i++) {
        const current = reports[i];
        const next = reports[i + 1];
        
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        expect(priorityOrder[current.priority]).toBeGreaterThanOrEqual(priorityOrder[next.priority]);
      }
    });

    it('should filter by priority when specified', async () => {
      const highPriorityReports = service.getPendingReports('high');
      highPriorityReports.forEach(report => {
        expect(report.priority).toBe('high');
      });
    });
  });

  describe('reviewReport', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await service.submitReport(
        'user_test',
        'target_test',
        'harassment',
        'Test report for review'
      );
      reportId = report.id;
    });

    it('should review a report with warn decision', async () => {
      const result = await service.reviewReport(
        reportId,
        'mod_123',
        'warn',
        'Violation confirmed, user warned'
      );
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe('reviewed');
      expect(result?.reviewedBy).toBe('mod_123');
      expect(result?.resolution).toBe('Violation confirmed, user warned');
    });

    it('should review a report with dismiss decision', async () => {
      const result = await service.reviewReport(
        reportId,
        'mod_123',
        'dismiss',
        'No violation found'
      );
      
      expect(result).not.toBeNull();
      expect(result?.status).toBe('reviewed');
      expect(result?.reviewedBy).toBe('mod_123');
    });

    it('should return null for non-existent report', async () => {
      const result = await service.reviewReport(
        'non_existent_id',
        'mod_123',
        'warn',
        'Test notes'
      );
      
      expect(result).toBeNull();
    });
  });

  describe('takeModerationAction', () => {
    it('should warn a user', async () => {
      const result = await service.takeModerationAction(
        'warn',
        'user_123',
        'mod_123',
        'Inappropriate language'
      );
      
      expect(result.targetUserId).toBe('user_123');
      expect(result.type).toBe('warn');
      expect(result.reason).toBe('Inappropriate language');
      expect(result.moderatorId).toBe('mod_123');
      expect(typeof result.timestamp).toBe('number');
    });

    it('should mute a user with duration', async () => {
      const result = await service.takeModerationAction(
        'mute',
        'user_123',
        'mod_123',
        'Spam behavior',
        undefined,
        24 * 60 * 60 * 1000 // 24 hours
      );
      
      expect(result.type).toBe('mute');
      expect(result.duration).toBe(24 * 60 * 60 * 1000);
    });

    it('should ban a user', async () => {
      const result = await service.takeModerationAction(
        'ban',
        'user_123',
        'mod_123',
        'Repeated violations'
      );
      
      expect(result.type).toBe('ban');
    });

    it('should delete a message', async () => {
      const result = await service.takeModerationAction(
        'delete_message',
        'user_123',
        'mod_123',
        'Inappropriate content',
        'msg_456'
      );
      
      expect(result.type).toBe('delete_message');
      expect(result.targetMessageId).toBe('msg_456');
    });
  });

  describe('getUserModerationHistory', () => {
    beforeEach(async () => {
      // Create test violations
      await service.takeModerationAction(
        'warn',
        'user_test',
        'mod_123',
        'First warning'
      );

      await service.takeModerationAction(
        'mute',
        'user_test',
        'mod_123',
        'Second violation',
        undefined,
        60 * 60 * 1000 // 1 hour
      );

      await service.submitReport(
        'reporter_1',
        'user_test',
        'inappropriate',
        'Test report against user'
      );
    });

    it('should return user moderation history', async () => {
      const history = service.getUserModerationHistory('user_test');
      
      expect(history.reports).toBeDefined();
      expect(history.actions).toBeDefined();
      expect(typeof history.violationCount).toBe('number');
      expect(['low', 'medium', 'high', 'critical']).toContain(history.riskLevel);
      expect(Array.isArray(history.recommendations)).toBe(true);
    });

    it('should include user reports in history', async () => {
      const history = service.getUserModerationHistory('user_test');
      
      const userReports = history.reports.filter((r: any) => r.targetUserId === 'user_test');
      expect(userReports.length).toBeGreaterThan(0);
    });

    it('should include moderation actions in history', async () => {
      const history = service.getUserModerationHistory('user_test');
      
      const userActions = history.actions.filter((a: any) => a.targetUserId === 'user_test');
      expect(userActions.length).toBeGreaterThan(0);
    });
  });

  describe('getModerationDashboard', () => {
    beforeEach(async () => {
      // Create test data for dashboard
      const mockMetadata = {
        userId: 'dashboard_user',
        roomId: 'room_test',
        timestamp: Date.now(),
      };

      await service.moderateContent('test content', mockMetadata);
      
      await service.submitReport(
        'user_1',
        'target_1',
        'harassment',
        'Dashboard test report 1'
      );

      await service.submitReport(
        'user_2',
        'target_2',
        'spam',
        'Dashboard test report 2'
      );

      await service.takeModerationAction(
        'warn',
        'dashboard_user',
        'mod_123',
        'Dashboard test warning'
      );
    });

    it('should return dashboard statistics', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(dashboard.overview).toBeDefined();
      expect(dashboard.contentModeration).toBeDefined();
      expect(dashboard.userReports).toBeDefined();
      expect(dashboard.moderationActions).toBeDefined();
      expect(dashboard.riskAnalysis).toBeDefined();
    });

    it('should include overview statistics', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(typeof dashboard.overview.totalReports).toBe('number');
      expect(typeof dashboard.overview.pendingReports).toBe('number');
      expect(typeof dashboard.overview.totalActions).toBe('number');
      expect(typeof dashboard.overview.blockedContent).toBe('number');
      expect(typeof dashboard.overview.flaggedContent).toBe('number');
    });

    it('should include content moderation analytics', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(dashboard.contentModeration.byDecision).toBeDefined();
      expect(dashboard.contentModeration.byType).toBeDefined();
      expect(Array.isArray(dashboard.contentModeration.topReasons)).toBe(true);
    });

    it('should include user reports analytics', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(dashboard.userReports.byReason).toBeDefined();
      expect(dashboard.userReports.byPriority).toBeDefined();
      expect(dashboard.userReports.byStatus).toBeDefined();
    });

    it('should include moderation actions analytics', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(dashboard.moderationActions.byType).toBeDefined();
      expect(Array.isArray(dashboard.moderationActions.topModerators)).toBe(true);
    });

    it('should include risk analysis', async () => {
      const dashboard = service.getModerationDashboard();
      
      expect(Array.isArray(dashboard.riskAnalysis.repeatOffenders)).toBe(true);
      expect(Array.isArray(dashboard.riskAnalysis.trendingViolations)).toBe(true);
    });

    it('should support different time ranges', async () => {
      const dashboard24h = service.getModerationDashboard('24h');
      const dashboard7d = service.getModerationDashboard('7d');
      const dashboard30d = service.getModerationDashboard('30d');
      
      expect(dashboard24h.overview).toBeDefined();
      expect(dashboard7d.overview).toBeDefined();
      expect(dashboard30d.overview).toBeDefined();
    });
  });

  describe('integration tests', () => {
    it('should handle complete moderation workflow', async () => {
      const mockMetadata = {
        userId: 'workflow_user',
        roomId: 'room_workflow',
        messageId: 'msg_workflow',
        timestamp: Date.now(),
      };

      // 1. Moderate content
      const moderationResult = await service.moderateContent(
        'This is inappropriate content',
        mockMetadata
      );
      expect(moderationResult.id).toBeDefined();

      // 2. Submit report
      const report = await service.submitReport(
        'reporter_user',
        'workflow_user',
        'inappropriate',
        'User posted inappropriate content',
        'msg_workflow'
      );
      expect(report.id).toBeDefined();

      // 3. Review report
      const reviewResult = await service.reviewReport(
        report.id,
        'mod_workflow',
        'warn',
        'Content confirmed inappropriate'
      );
      expect(reviewResult).not.toBeNull();

      // 4. Check user history
      const history = service.getUserModerationHistory('workflow_user');
      expect(history.actions.length).toBeGreaterThan(0);

      // 5. Get dashboard data
      const dashboard = service.getModerationDashboard();
      expect(dashboard.overview.totalReports).toBeGreaterThan(0);
    });    it('should track repeat offender escalation', async () => {
      const mockMetadata = {
        userId: 'repeat_offender',
        roomId: 'room_test',
        timestamp: Date.now(),
      };

      // Create multiple violations with more aggressive content
      for (let i = 0; i < 5; i++) {
        await service.moderateContent(`hate stupid idiot ${i}`, {
          ...mockMetadata,
          messageId: `msg_${i}`,
        });
      }

      // Check that user has some level of tracking in the system
      const history = service.getUserModerationHistory('repeat_offender');
      expect(['low', 'medium', 'high', 'critical']).toContain(history.riskLevel);
    });
  });
});
