import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationData, UserNotificationSettings } from '../../infrastructure/websockets/services/notification.service';

export interface EmailNotificationData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SMSNotificationData {
  to: string;
  message: string;
}

export interface PushNotificationData {
  subscription: any;
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, any>;
  };
  options?: {
    ttl?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
  };
}

@Injectable()
export class NotificationChannelsService {
  private readonly logger = new Logger(NotificationChannelsService.name);
  
  constructor(private readonly configService: ConfigService) {}

  /**
   * Send notification through multiple channels based on user preferences and priority
   */
  async sendMultiChannelNotification(
    notification: NotificationData,
    userSettings: UserNotificationSettings,
    userEmail?: string,
    userPhone?: string
  ): Promise<{ success: boolean; channels: string[]; errors: any[] }> {
    const results = {
      success: true,
      channels: [] as string[],
      errors: [] as any[]
    };

    // Determine channels based on user preferences and notification priority
    const channels = this.determineChannels(notification, userSettings);
    
    // Send through each channel with fallback mechanism
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'in-app':
            await this.sendInAppNotification(notification);
            results.channels.push('in-app');
            break;
            
          case 'email':
            if (userEmail) {
              await this.sendEmailNotification(notification, userEmail);
              results.channels.push('email');
            }
            break;
            
          case 'push':
            await this.sendPushNotification(notification, userSettings.userId);
            results.channels.push('push');
            break;
            
          case 'sms':
            if (userPhone) {
              await this.sendSMSNotification(notification, userPhone);
              results.channels.push('sms');
            }
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification:`, error);
        results.errors.push({ channel, error: error.message });
        
        // If high priority notification fails, try fallback
        if (notification.priority === 'urgent' || notification.priority === 'high') {
          await this.tryFallbackChannel(notification, channel, userEmail, userPhone);
        }
      }
    }

    results.success = results.channels.length > 0;
    return results;
  }

  /**
   * Determine which channels to use based on notification type and user preferences
   */
  private determineChannels(
    notification: NotificationData,
    userSettings: UserNotificationSettings
  ): string[] {
    const channels: string[] = [];

    // Always include in-app notifications
    channels.push('in-app');

    // Add other channels based on user preferences and notification priority
    if (notification.priority === 'urgent') {
      // For urgent notifications, use all available channels
      if (userSettings.webPushEnabled) channels.push('push');
      channels.push('email');
      if (notification.type === 'system') channels.push('sms');
    } else if (notification.priority === 'high') {
      if (userSettings.webPushEnabled) channels.push('push');
      if (notification.type === 'mention' || notification.type === 'message') {
        channels.push('email');
      }
    } else {
      // Normal/low priority - only use preferred channels
      if (userSettings.webPushEnabled && userSettings.desktopEnabled) {
        channels.push('push');
      }
    }

    return channels;
  }

  /**
   * Send in-app notification (real-time through WebSocket)
   */
  private async sendInAppNotification(notification: NotificationData): Promise<void> {
    // This would integrate with the WebSocket service
    this.logger.debug(`Sending in-app notification: ${notification.id}`);
    // Implementation would emit through WebSocket to user
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    notification: NotificationData,
    email: string
  ): Promise<void> {
    const emailData: EmailNotificationData = {
      to: email,
      subject: notification.title,
      html: this.generateEmailHTML(notification),
      text: notification.body
    };

    // Mock email sending - in production, integrate with SendGrid, AWS SES, etc.
    this.logger.debug(`Sending email notification to: ${email}`);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log(`Email sent to ${email}: ${notification.title}`);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(
    notification: NotificationData,
    userId: string
  ): Promise<void> {
    // Mock push notification - in production, integrate with Firebase FCM, etc.
    this.logger.debug(`Sending push notification to user: ${userId}`);
    
    const pushData: PushNotificationData = {
      subscription: {}, // Would contain actual push subscription
      payload: {
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.badge || '/badge-72x72.png',
        data: notification.data
      },
      options: {
        ttl: 24 * 60 * 60, // 24 hours
        urgency: this.mapPriorityToUrgency(notification.priority)
      }
    };

    // Simulate push API call
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log(`Push notification sent to ${userId}: ${notification.title}`);
    }
  }

  /**
   * Send SMS notification
   */
  private async sendSMSNotification(
    notification: NotificationData,
    phone: string
  ): Promise<void> {
    // Mock SMS sending - in production, integrate with Twilio, AWS SNS, etc.
    this.logger.debug(`Sending SMS notification to: ${phone}`);
    
    const smsData: SMSNotificationData = {
      to: phone,
      message: `${notification.title}: ${notification.body}`
    };

    // Simulate SMS API call
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (this.configService.get('NODE_ENV') === 'development') {
      this.logger.log(`SMS sent to ${phone}: ${notification.title}`);
    }
  }

  /**
   * Try fallback channel when primary channel fails
   */
  private async tryFallbackChannel(
    notification: NotificationData,
    failedChannel: string,
    userEmail?: string,
    userPhone?: string
  ): Promise<void> {
    try {
      switch (failedChannel) {
        case 'push':
          if (userEmail) await this.sendEmailNotification(notification, userEmail);
          break;
        case 'email':
          if (userPhone) await this.sendSMSNotification(notification, userPhone);
          break;
        case 'sms':
          // Last resort - log to admin system
          this.logger.error(`Critical notification delivery failed: ${notification.id}`);
          break;
      }
    } catch (error) {
      this.logger.error(`Fallback channel also failed:`, error);
    }
  }

  /**
   * Generate HTML template for email notifications
   */
  private generateEmailHTML(notification: NotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { background: #f3f4f6; padding: 10px; text-align: center; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Chat Rooms Notification</h1>
        </div>
        <div class="content">
          <h2>${notification.title}</h2>
          <p>${notification.body}</p>
          ${notification.data ? `<p><strong>Details:</strong> ${JSON.stringify(notification.data)}</p>` : ''}
        </div>
        <div class="footer">
          <p>You received this notification because you're subscribed to Chat Rooms updates.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Map notification priority to push urgency
   */
  private mapPriorityToUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    switch (priority) {
      case 'urgent': return 'high';
      case 'high': return 'normal';
      case 'normal': return 'low';
      case 'low': return 'very-low';
      default: return 'low';
    }
  }
}
