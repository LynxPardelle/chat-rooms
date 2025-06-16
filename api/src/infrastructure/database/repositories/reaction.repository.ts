import { Injectable, Logger } from '@nestjs/common';
import { IReactionRepository } from '../../../domain/interfaces';
import { MessageReactionTypes } from '../../../domain/types';

/**
 * Mock Reaction Repository Implementation
 * This is a basic implementation to resolve dependency injection.
 * In a production environment, this would interact with a proper database.
 */
@Injectable()
export class ReactionRepository implements IReactionRepository {
  private readonly logger = new Logger(ReactionRepository.name);
  private readonly mockReactions = new Map<string, MessageReactionTypes.MessageReaction[]>();
  private currentId = 1;

  constructor() {
    this.logger.log('ReactionRepository initialized (Mock Implementation)');
  }

  async addReaction(data: MessageReactionTypes.AddReactionData): Promise<MessageReactionTypes.MessageReaction> {
    const reactionId = `reaction_${this.currentId++}`;
    
    const reaction: MessageReactionTypes.MessageReaction = {
      id: reactionId,
      emoji: data.emoji,
      emojiCode: data.emojiCode,
      userId: data.userId,
      username: `user_${data.userId}`,
      addedAt: new Date(),
      isCustom: data.isCustom || false,
      customEmojiUrl: data.customEmojiUrl
    };

    // Get existing reactions for the message
    const existingReactions = this.mockReactions.get(data.messageId) || [];
    
    // Check if user already reacted with this emoji
    const existingReaction = existingReactions.find(
      r => r.userId === data.userId && r.emoji === data.emoji
    );

    if (existingReaction) {
      this.logger.debug(`User ${data.userId} already reacted to message ${data.messageId} with ${data.emoji}`);
      return existingReaction;
    }

    existingReactions.push(reaction);
    this.mockReactions.set(data.messageId, existingReactions);

    this.logger.debug(`Added reaction ${data.emoji} to message ${data.messageId} by user ${data.userId}`);
    return reaction;
  }

  async removeReaction(data: MessageReactionTypes.RemoveReactionData): Promise<boolean> {
    const existingReactions = this.mockReactions.get(data.messageId) || [];
    const initialLength = existingReactions.length;

    const filteredReactions = existingReactions.filter(
      r => !(r.userId === data.userId && r.emoji === data.emoji)
    );

    this.mockReactions.set(data.messageId, filteredReactions);
    
    const removed = filteredReactions.length < initialLength;
    if (removed) {
      this.logger.debug(`Removed reaction ${data.emoji} from message ${data.messageId} by user ${data.userId}`);
    }

    return removed;
  }

  async getMessageReactions(messageId: string): Promise<MessageReactionTypes.MessageReactionGroup> {
    const reactions = this.mockReactions.get(messageId) || [];
    
    // Group reactions by emoji
    const reactionMap = new Map<string, MessageReactionTypes.ReactionSummary>();
    
    reactions.forEach(reaction => {
      const key = reaction.emoji;
      const existing = reactionMap.get(key);
      
      if (existing) {
        existing.count++;
        existing.users.push({
          userId: reaction.userId,
          username: reaction.username,
          addedAt: reaction.addedAt
        });
      } else {
        reactionMap.set(key, {
          emoji: reaction.emoji,
          emojiCode: reaction.emojiCode,
          count: 1,
          users: [{
            userId: reaction.userId,
            username: reaction.username,
            addedAt: reaction.addedAt
          }],
          isCustom: reaction.isCustom,
          customEmojiUrl: reaction.customEmojiUrl
        });
      }
    });

    const reactionSummaries = Array.from(reactionMap.values());
    const userReactions = reactions.map(r => r.emoji);

    this.logger.debug(`Found ${reactions.length} reactions for message ${messageId}`);

    return {
      messageId,
      reactions: reactionSummaries,
      totalReactions: reactions.length,
      userReactions
    };
  }

  async getUserReactions(messageId: string, userId: string): Promise<MessageReactionTypes.MessageReaction[]> {
    const reactions = this.mockReactions.get(messageId) || [];
    const userReactions = reactions.filter(r => r.userId === userId);

    this.logger.debug(`Found ${userReactions.length} reactions for user ${userId} on message ${messageId}`);
    return userReactions;
  }

  async getReactionCount(messageId: string, emoji: string): Promise<number> {
    const reactions = this.mockReactions.get(messageId) || [];
    const count = reactions.filter(r => r.emoji === emoji).length;

    this.logger.debug(`Found ${count} reactions with emoji ${emoji} for message ${messageId}`);
    return count;
  }

  async getTopReactions(timeRange: { start: Date; end: Date }): Promise<Array<{
    emoji: string;
    count: number;
    growth: number;
  }>> {
    const emojiStats = new Map<string, { count: number; timestamps: Date[] }>();

    // Collect all reactions within time range
    for (const [messageId, reactions] of this.mockReactions) {
      reactions.forEach(reaction => {
        if (reaction.addedAt >= timeRange.start && reaction.addedAt <= timeRange.end) {
          const existing = emojiStats.get(reaction.emoji);
          if (existing) {
            existing.count++;
            existing.timestamps.push(reaction.addedAt);
          } else {
            emojiStats.set(reaction.emoji, {
              count: 1,
              timestamps: [reaction.addedAt]
            });
          }
        }
      });
    }

    // Calculate growth (simplified - comparing first and second half of time range)
    const result = Array.from(emojiStats.entries()).map(([emoji, stats]) => {
      const midPoint = new Date((timeRange.start.getTime() + timeRange.end.getTime()) / 2);
      const firstHalf = stats.timestamps.filter(t => t < midPoint).length;
      const secondHalf = stats.timestamps.filter(t => t >= midPoint).length;
      const growth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

      return {
        emoji,
        count: stats.count,
        growth: Math.round(growth * 100) / 100
      };
    });

    // Sort by count descending
    result.sort((a, b) => b.count - a.count);

    this.logger.debug(`Found top reactions: ${result.length} emoji types`);
    return result;
  }

  async removeAllReactions(messageId: string): Promise<boolean> {
    const hadReactions = this.mockReactions.has(messageId);
    this.mockReactions.delete(messageId);

    if (hadReactions) {
      this.logger.debug(`Removed all reactions for message ${messageId}`);
    }

    return hadReactions;
  }

  async getReactionStatistics(params: {
    messageIds?: string[];
    userIds?: string[];
    timeRange?: { start: Date; end: Date };
  }): Promise<{
    totalReactions: number;
    uniqueUsers: number;
    topEmojis: Array<{ emoji: string; count: number }>;
  }> {
    let allReactions: MessageReactionTypes.MessageReaction[] = [];
    const uniqueUsers = new Set<string>();
    const emojiCounts = new Map<string, number>();

    // Collect reactions based on filters
    for (const [messageId, reactions] of this.mockReactions) {
      // Filter by message IDs if provided
      if (params.messageIds && !params.messageIds.includes(messageId)) {
        continue;
      }

      reactions.forEach(reaction => {
        // Filter by user IDs if provided
        if (params.userIds && !params.userIds.includes(reaction.userId)) {
          return;
        }

        // Filter by time range if provided
        if (params.timeRange) {
          if (reaction.addedAt < params.timeRange.start || reaction.addedAt > params.timeRange.end) {
            return;
          }
        }

        allReactions.push(reaction);
        uniqueUsers.add(reaction.userId);
        
        const count = emojiCounts.get(reaction.emoji) || 0;
        emojiCounts.set(reaction.emoji, count + 1);
      });
    }

    // Get top emojis
    const topEmojis = Array.from(emojiCounts.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 emojis

    const stats = {
      totalReactions: allReactions.length,
      uniqueUsers: uniqueUsers.size,
      topEmojis
    };

    this.logger.debug(`Reaction statistics: ${stats.totalReactions} total, ${stats.uniqueUsers} unique users`);
    return stats;
  }
}
