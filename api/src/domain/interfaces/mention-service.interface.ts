import { MessageMention } from '../entities/message.entity';

export interface IMentionService {  /**
   * Processes mentions in a message, validates users, and prepares for notifications
   * @deprecated Use parseMentions instead
   */
  processMentions?(
    mentions: MessageMention[],
    authorId: string,
    roomId: string
  ): Promise<MessageMention[]>;

  /**
   * Send notifications for mentions in a message
   * @deprecated Implement your own notification logic
   */
  sendNotifications?(
    mentions: MessageMention[],
    messageId: string,
    messageContent: string,
    roomId: string
  ): Promise<void>;
  /**
   * Parse text content to extract mentions
   * Returns an array of message mentions extracted from the content
   */
  parseMentions(content: string): MessageMention[];

  /**
   * Check if a user can mention another user
   */
  canMention(mentioningUserId: string, mentionedUserId: string, roomId: string): Promise<boolean>;

  /**
   * Get unread mentions for a user
   */
  getUnreadMentions(userId: string): Promise<any[]>;

  /**
   * Mark mentions as read
   */
  markMentionsAsRead(userId: string, messageIds: string[]): Promise<number>;
}
