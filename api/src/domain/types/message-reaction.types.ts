// Reaction types for enhanced emoji reactions
export type MessageReaction = {
  id: string;
  emoji: string;
  emojiCode: string; // Unicode code for consistent rendering
  userId: string;
  username: string;
  addedAt: Date;
  isCustom: boolean;
  customEmojiUrl?: string;
};

export type ReactionSummary = {
  emoji: string;
  emojiCode: string;
  count: number;
  users: Array<{
    userId: string;
    username: string;
    addedAt: Date;
  }>;
  isCustom: boolean;
  customEmojiUrl?: string;
};

export type MessageReactionGroup = {
  messageId: string;
  reactions: ReactionSummary[];
  totalReactions: number;
  userReactions: string[]; // Emojis the current user has reacted with
};

export type AddReactionData = {
  messageId: string;
  emoji: string;
  emojiCode: string;
  userId: string;
  isCustom?: boolean;
  customEmojiUrl?: string;
};

export type RemoveReactionData = {
  messageId: string;
  emoji: string;
  userId: string;
};

export type ReactionEvent = {
  type: 'reaction:added' | 'reaction:removed';
  messageId: string;
  reaction: MessageReaction;
  reactionSummary: ReactionSummary;
  timestamp: Date;
};

// Commonly used emoji configurations
export const STANDARD_EMOJIS = [
  { emoji: '👍', code: 'U+1F44D', name: 'thumbs_up' },
  { emoji: '👎', code: 'U+1F44E', name: 'thumbs_down' },
  { emoji: '❤️', code: 'U+2764', name: 'heart' },
  { emoji: '😂', code: 'U+1F602', name: 'joy' },
  { emoji: '😮', code: 'U+1F62E', name: 'open_mouth' },
  { emoji: '😢', code: 'U+1F622', name: 'cry' },
  { emoji: '😡', code: 'U+1F621', name: 'rage' },
  { emoji: '🎉', code: 'U+1F389', name: 'tada' },
  { emoji: '👀', code: 'U+1F440', name: 'eyes' },
  { emoji: '🔥', code: 'U+1F525', name: 'fire' }
] as const;

export type StandardEmoji = typeof STANDARD_EMOJIS[number];

// Reaction repository interface
export interface IReactionRepository {
  addReaction(data: AddReactionData): Promise<MessageReaction>;
  removeReaction(data: RemoveReactionData): Promise<boolean>;
  getMessageReactions(messageId: string): Promise<MessageReactionGroup>;
  getUserReactions(messageId: string, userId: string): Promise<MessageReaction[]>;
  getReactionCount(messageId: string, emoji: string): Promise<number>;
  getTopReactions(timeRange: { start: Date; end: Date }): Promise<Array<{
    emoji: string;
    count: number;
    growth: number;
  }>>;
}
