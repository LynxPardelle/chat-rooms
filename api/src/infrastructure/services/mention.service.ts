import { Injectable, Logger } from '@nestjs/common';
import { IMentionService } from '../../domain/interfaces';
import { MessageMention } from '../../domain/entities/message.entity';

/**
 * Mock Mention Service Implementation
 * This is a basic implementation to resolve dependency injection.
 * In a production environment, this would interact with user management and notification systems.
 */
@Injectable()
export class MentionService implements IMentionService {
  private readonly logger = new Logger(MentionService.name);
  private readonly mockMentions = new Map<string, any[]>(); // userId -> mentions[]

  constructor() {
    this.logger.log('MentionService initialized (Mock Implementation)');
  }

  parseMentions(content: string): MessageMention[] {
    const mentions: MessageMention[] = [];
    
    // Simple regex to find @username patterns
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      const startIndex = match.index;
      const endIndex = match.index + match[0].length;      mentions.push({
        userId: `user_${username}`, // Mock user ID based on username
        username,
        startIndex,
        endIndex,
        notified: false
      });
    }

    this.logger.debug(`Parsed ${mentions.length} mentions from content`);
    return mentions;
  }

  async canMention(mentioningUserId: string, mentionedUserId: string, roomId: string): Promise<boolean> {
    // Mock implementation - in production, this would check:
    // - User permissions in the room
    // - Block lists
    // - Privacy settings
    // - Rate limiting for mentions
    
    this.logger.debug(`Checking if user ${mentioningUserId} can mention ${mentionedUserId} in room ${roomId}`);
    
    // For mock purposes, allow all mentions except self-mentions
    const canMention = mentioningUserId !== mentionedUserId;
    
    return canMention;
  }

  async getUnreadMentions(userId: string): Promise<any[]> {
    const mentions = this.mockMentions.get(userId) || [];
    const unreadMentions = mentions.filter(mention => !mention.isRead);
    
    this.logger.debug(`Found ${unreadMentions.length} unread mentions for user ${userId}`);
    return unreadMentions;
  }

  async markMentionsAsRead(userId: string, messageIds: string[]): Promise<number> {
    const mentions = this.mockMentions.get(userId) || [];
    let markedCount = 0;

    mentions.forEach(mention => {
      if (messageIds.includes(mention.messageId) && !mention.isRead) {
        mention.isRead = true;
        mention.readAt = new Date();
        markedCount++;
      }
    });

    this.mockMentions.set(userId, mentions);
    
    this.logger.debug(`Marked ${markedCount} mentions as read for user ${userId}`);
    return markedCount;
  }

  // Optional deprecated methods (implement for backward compatibility)
  async processMentions(
    mentions: MessageMention[],
    authorId: string,
    roomId: string
  ): Promise<MessageMention[]> {
    this.logger.debug(`Processing ${mentions.length} mentions from author ${authorId} in room ${roomId}`);
    
    // Mock processing - validate mentions and filter out invalid ones
    const validMentions: MessageMention[] = [];
    
    for (const mention of mentions) {
      const canMention = await this.canMention(authorId, mention.userId, roomId);
      if (canMention) {
        validMentions.push(mention);
      } else {
        this.logger.debug(`Filtered out invalid mention: ${mention.username}`);
      }
    }

    return validMentions;
  }

  async sendNotifications(
    mentions: MessageMention[],
    messageId: string,
    messageContent: string,
    roomId: string
  ): Promise<void> {
    this.logger.debug(`Sending notifications for ${mentions.length} mentions in message ${messageId}`);
    
    // Mock notification sending
    for (const mention of mentions) {
      const userMentions = this.mockMentions.get(mention.userId) || [];
      
      userMentions.push({
        id: `mention_${Date.now()}_${Math.random()}`,
        messageId,
        roomId,
        mentionedUserId: mention.userId,
        mentionedUsername: mention.username,
        messageContent: messageContent.substring(0, 100) + '...', // Preview
        isRead: false,
        createdAt: new Date(),
        readAt: null
      });
      
      this.mockMentions.set(mention.userId, userMentions);
      
      this.logger.debug(`Created mention notification for user ${mention.userId}`);
    }
  }
}
