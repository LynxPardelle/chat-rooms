import { MessageReactionTypes } from '../types';

export interface IReactionRepository {
  /**
   * Add a reaction to a message
   */
  addReaction(data: MessageReactionTypes.AddReactionData): Promise<MessageReactionTypes.MessageReaction>;
  
  /**
   * Remove a reaction from a message
   */
  removeReaction(data: MessageReactionTypes.RemoveReactionData): Promise<boolean>;
  
  /**
   * Get all reactions for a message
   */
  getMessageReactions(messageId: string): Promise<MessageReactionTypes.MessageReactionGroup>;
  
  /**
   * Get reactions for a specific user on a message
   */
  getUserReactions(messageId: string, userId: string): Promise<MessageReactionTypes.MessageReaction[]>;
  
  /**
   * Get the count of a specific reaction on a message
   */
  getReactionCount(messageId: string, emoji: string): Promise<number>;
  
  /**
   * Get top reactions within a time range
   */
  getTopReactions(timeRange: { start: Date; end: Date }): Promise<Array<{
    emoji: string;
    count: number;
    growth: number;
  }>>;
  
  /**
   * Remove all reactions for a message
   */
  removeAllReactions(messageId: string): Promise<boolean>;
  
  /**
   * Get reaction statistics for analytics
   */
  getReactionStatistics(params: {
    messageIds?: string[];
    userIds?: string[];
    timeRange?: { start: Date; end: Date };
  }): Promise<{
    totalReactions: number;
    uniqueUsers: number;
    topEmojis: Array<{ emoji: string; count: number }>;
  }>;
}
