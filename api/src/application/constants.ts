// Application constants and default values
export const DEFAULT_VALUES = {
  USER: {
    TEXT_COLOR: '#000000',
    BACKGROUND_COLOR: '#ffffff',
    STATUS: 'offline' as const,
    IS_ONLINE: false,
    LOGIN_COUNT: 0,
  },
  MESSAGE: {
    TYPE: 'text' as const,
    REACTIONS: [],
    IS_EDITED: false,
  },
  ROOM: {
    IS_PRIVATE: false,
    MAX_USERS: 100,
    ACTIVE_USERS: [],
  },
  PAGINATION: {
    PAGE: 1,
    LIMIT: 20,
    SORT_ORDER: 'desc' as const,
  },
  FILE: {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_FILE_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain',
      'application/json',
    ],
  },
} as const;

export const VALIDATION_RULES = {
  USERNAME: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 30,
    PATTERN: /^[a-zA-Z0-9_]+$/,
  },
  PASSWORD: {
    MIN_LENGTH: 6,
    MAX_LENGTH: 50,
  },
  MESSAGE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 2000,
  },
  ROOM_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  ROOM_DESCRIPTION: {
    MAX_LENGTH: 500,
  },
  SEARCH_QUERY: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
  },
  COLOR: {
    PATTERN: /^#[0-9A-Fa-f]{6}$/,
  },
} as const;

export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    USER_NOT_FOUND: 'User not found',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    USERNAME_ALREADY_EXISTS: 'Username already exists',
    TOKEN_INVALID: 'Invalid token',
    TOKEN_EXPIRED: 'Token expired',
    UNAUTHORIZED: 'Unauthorized access',
  },
  USER: {
    NOT_FOUND: 'User not found',
    INVALID_ID: 'Invalid user ID',
    CANNOT_UPDATE: 'Cannot update user',
    CANNOT_DELETE: 'Cannot delete user',
  },
  MESSAGE: {
    NOT_FOUND: 'Message not found',
    INVALID_ID: 'Invalid message ID',
    CANNOT_UPDATE: 'Cannot update message',
    CANNOT_DELETE: 'Cannot delete message',
    EMPTY_CONTENT: 'Message content cannot be empty',
    TOO_LONG: 'Message content is too long',
  },
  ROOM: {
    NOT_FOUND: 'Room not found',
    INVALID_ID: 'Invalid room ID',
    CANNOT_UPDATE: 'Cannot update room',
    CANNOT_DELETE: 'Cannot delete room',
    USER_NOT_MEMBER: 'User is not a member of this room',
    ROOM_FULL: 'Room is full',
    ACCESS_DENIED: 'Access denied to private room',
  },
  FILE: {
    TOO_LARGE: 'File is too large',
    INVALID_TYPE: 'Invalid file type',
    UPLOAD_FAILED: 'File upload failed',
    NOT_FOUND: 'File not found',
    DELETE_FAILED: 'File deletion failed',
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_COLOR: 'Invalid color format (must be hex color like #000000)',
    INVALID_USERNAME:
      'Username can only contain letters, numbers, and underscores',
    PASSWORD_TOO_SHORT: 'Password must be at least 6 characters long',
    INVALID_PAGINATION: 'Invalid pagination parameters',
  },
  GENERAL: {
    INTERNAL_ERROR: 'Internal server error',
    NOT_FOUND: 'Resource not found',
    BAD_REQUEST: 'Bad request',
    FORBIDDEN: 'Forbidden',
    RATE_LIMIT: 'Too many requests, please try again later',
  },
} as const;

export const SUCCESS_MESSAGES = {
  AUTH: {
    LOGIN_SUCCESS: 'Login successful',
    REGISTER_SUCCESS: 'Registration successful',
    LOGOUT_SUCCESS: 'Logout successful',
  },
  USER: {
    CREATED: 'User created successfully',
    UPDATED: 'User updated successfully',
    DELETED: 'User deleted successfully',
    STATUS_UPDATED: 'User status updated',
  },
  MESSAGE: {
    CREATED: 'Message sent successfully',
    UPDATED: 'Message updated successfully',
    DELETED: 'Message deleted successfully',
  },
  ROOM: {
    CREATED: 'Room created successfully',
    UPDATED: 'Room updated successfully',
    DELETED: 'Room deleted successfully',
    JOINED: 'Joined room successfully',
    LEFT: 'Left room successfully',
  },
  FILE: {
    UPLOADED: 'File uploaded successfully',
    DELETED: 'File deleted successfully',
  },
} as const;
