import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationChannelsService } from '../../application/services/notification-channels.service';
import { NotificationService, UserNotificationSettings } from '../../infrastructure/websockets/services/notification.service';
import { JwtAuthGuard } from '../../infrastructure/security/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationChannelsService: NotificationChannelsService,
    private readonly notificationService: NotificationService
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send multi-channel notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendNotification(
    @Body() notificationData: {
      type: 'message' | 'mention' | 'reaction' | 'system' | 'typing' | 'presence';
      title: string;
      body: string;
      roomId?: string;
      messageId?: string;
      senderId?: string;
      priority: 'low' | 'normal' | 'high' | 'urgent';
      data?: Record<string, any>;
      targetUserId: string;
      userEmail?: string;
      userPhone?: string;
    }
  ) {
    const notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: notificationData.type,
      title: notificationData.title,
      body: notificationData.body,
      roomId: notificationData.roomId,
      messageId: notificationData.messageId,
      senderId: notificationData.senderId,
      priority: notificationData.priority,
      data: notificationData.data,
      timestamp: Date.now(),
      userId: notificationData.targetUserId
    };

    const userSettings = this.notificationService.getUserSettings(notificationData.targetUserId);
    
    const result = await this.notificationChannelsService.sendMultiChannelNotification(
      notification,
      userSettings,
      notificationData.userEmail,
      notificationData.userPhone
    );
    
    return result;
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get user notification settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getUserSettings(@Request() req: any) {
    const settings = this.notificationService.getUserSettings(req.user.userId);
    return settings;
  }

  @Post('settings')
  @ApiOperation({ summary: 'Update user notification settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateUserSettings(
    @Body() settings: Partial<UserNotificationSettings>,
    @Request() req: any
  ) {
    const updatedSettings = await this.notificationService.updateUserSettings(
      req.user.userId,
      settings
    );
    return updatedSettings;
  }
  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  @ApiResponse({ status: 201, description: 'Push subscription added successfully' })
  async subscribeToPush(
    @Body() subscriptionData: {
      deviceId: string;
      subscription: {
        endpoint: string;
        keys: {
          p256dh: string;
          auth: string;
        };
      };
      userAgent?: string;
    },
    @Request() req: any
  ) {
    this.notificationService.subscribeToWebPush(
      req.user.userId,
      subscriptionData.deviceId,
      subscriptionData.subscription,
      subscriptionData.userAgent
    );
    return { success: true };
  }

  @Post('push/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  @ApiResponse({ status: 200, description: 'Push subscription removed successfully' })
  async unsubscribeFromPush(
    @Body() unsubscribeData: {
      deviceId?: string;
    },
    @Request() req: any
  ) {
    this.notificationService.unsubscribeFromWebPush(
      req.user.userId,
      unsubscribeData.deviceId
    );
    return { success: true };
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get pending notifications' })
  @ApiResponse({ status: 200, description: 'Pending notifications retrieved successfully' })
  async getPendingNotifications(@Request() req: any) {
    const notifications = this.notificationService.getPendingNotifications(req.user.userId);
    return notifications;
  }

  @Post('mark-sent')
  @ApiOperation({ summary: 'Mark notifications as sent' })
  @ApiResponse({ status: 200, description: 'Notifications marked as sent' })
  async markAsSent(
    @Body() markData: {
      notificationIds: string[];
    },
    @Request() req: any
  ) {
    this.notificationService.markNotificationsAsSent(
      req.user.userId,
      markData.notificationIds
    );
    return { success: true };
  }

  @Post('test')
  @ApiOperation({ summary: 'Send test notification (development only)' })
  @ApiResponse({ status: 201, description: 'Test notification sent' })
  async sendTestNotification(
    @Body() testData: {
      channel: 'in-app' | 'email' | 'push' | 'sms';
      message: string;
    },
    @Request() req: any
  ) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Test notifications are not available in production' };
    }

    const testNotification = {
      id: `test-${Date.now()}`,
      type: 'system' as const,
      title: 'Test Notification',
      body: testData.message,
      priority: 'normal' as const,
      timestamp: Date.now(),
      userId: req.user.userId
    };

    const userSettings = this.notificationService.getUserSettings(req.user.userId);
    
    const result = await this.notificationChannelsService.sendMultiChannelNotification(
      testNotification,
      userSettings
    );
    
    return result;
  }
}
