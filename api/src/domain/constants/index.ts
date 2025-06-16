export const MESSAGE_REPOSITORY_TOKEN = 'IMessageRepository';
export const USER_REPOSITORY_TOKEN = 'IUserRepository';
export const ROOM_REPOSITORY_TOKEN = 'IRoomRepository';
export const THREAD_REPOSITORY_TOKEN = 'IThreadRepository';
export const REACTION_REPOSITORY_TOKEN = 'IReactionRepository';
export const MENTION_SERVICE_TOKEN = 'IMentionService';

// Message constants
export const DEFAULT_ROOM_ID = '507f1f77bcf86cd799439011'; // A valid ObjectId for default room
export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_EDIT_TIME_MINUTES = 60; // 1 hour
export const MAX_BULK_OPERATIONS = 100;
export const MAX_MENTIONS_PER_MESSAGE = 10;
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_REACTIONS_PER_MESSAGE = 30;
export const MAX_ATTACHMENT_SIZE_MB = 10;

// Rate limiting constants
export const MESSAGE_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
export const MESSAGE_RATE_LIMIT_MAX_REQUESTS = 30;

// Analytics constants
export const ANALYTICS_CACHE_TTL_SECONDS = 300; // 5 minutes
export const TOP_USERS_LIMIT = 10;
export const TRENDING_MESSAGES_LIMIT = 20;
