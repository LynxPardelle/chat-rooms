import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export type RoomNameOptions = {
  minLength?: number;
  maxLength?: number;
  allowSpaces?: boolean;
  allowSpecialChars?: boolean;
  forbidReservedWords?: boolean;
  requireAlphaStart?: boolean;
};

const DEFAULT_OPTIONS: RoomNameOptions = {
  minLength: 3,
  maxLength: 50,
  allowSpaces: true,
  allowSpecialChars: false,
  forbidReservedWords: true,
  requireAlphaStart: true,
};

// Reserved room names that cannot be used
const RESERVED_ROOM_NAMES = [
  'general',
  'main',
  'lobby',
  'default',
  'system',
  'admin',
  'moderator',
  'support',
  'help',
  'announcements',
  'public',
  'private',
  'global',
  'all',
  'everyone',
  'room',
  'channel',
  'chat',
  'test',
  'demo',
  'sample',
  'null',
  'undefined',
  'api',
  'bot',
  'service',
];

@ValidatorConstraint({ name: 'isRoomName', async: false })
export class IsRoomNameConstraint implements ValidatorConstraintInterface {
  validate(roomName: string, args: ValidationArguments): boolean {
    if (!roomName || typeof roomName !== 'string') {
      return false;
    }

    const options: RoomNameOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    // Trim and check length
    const trimmed = roomName.trim();
    if (trimmed.length < (options.minLength || 0)) {
      return false;
    }
    if (trimmed.length > (options.maxLength || Infinity)) {
      return false;
    }

    // Check if it starts with alphabetic character if required
    if (options.requireAlphaStart && !/^[a-zA-Z]/.test(trimmed)) {
      return false;
    }

    // Build allowed character pattern
    let pattern = '[a-zA-Z0-9';
    if (options.allowSpaces) {
      pattern += ' ';
    }
    if (options.allowSpecialChars) {
      pattern += '_\\-\\.';
    }
    pattern += ']+';

    const regex = new RegExp(`^${pattern}$`);
    if (!regex.test(trimmed)) {
      return false;
    }

    // Cannot be only spaces or special characters
    if (!/[a-zA-Z0-9]/.test(trimmed)) {
      return false;
    }

    // Cannot have multiple consecutive spaces
    if (/\s{2,}/.test(trimmed)) {
      return false;
    }

    // Cannot start or end with spaces (after trim, this should not happen)
    if (trimmed !== trimmed.trim()) {
      return false;
    }

    // Check against reserved words
    if (options.forbidReservedWords && 
        RESERVED_ROOM_NAMES.includes(trimmed.toLowerCase().replace(/\s+/g, ''))) {
      return false;
    }

    // Additional validation
    if (this.hasInvalidPatterns(trimmed)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: RoomNameOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    const allowedChars = ['letters', 'numbers'];
    if (options.allowSpaces) {
      allowedChars.push('spaces');
    }
    if (options.allowSpecialChars) {
      allowedChars.push('underscores, dashes, dots');
    }

    return `Room name must be ${options.minLength}-${options.maxLength} characters long, ` +
           `contain only ${allowedChars.join(', ')}, ` +
           `${options.requireAlphaStart ? 'start with a letter, ' : ''}` +
           `and cannot be a reserved name or contain inappropriate content.`;
  }

  private hasInvalidPatterns(roomName: string): boolean {
    // Check for inappropriate content patterns
    const inappropriatePatterns = [
      /\b(fuck|shit|damn|hell|ass|bitch|crap)\b/i,
      /\b(admin|root|system)\b/i,
      /^test/i,
      /^demo/i,
      /^sample/i,
      /\d+$/, // only numbers
      /^[._-]+/, // starts with special chars
      /[._-]+$/, // ends with special chars
      /[._-]{2,}/, // consecutive special chars
    ];

    return inappropriatePatterns.some(pattern => pattern.test(roomName));
  }
}

export function IsRoomName(
  options?: RoomNameOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsRoomNameConstraint,
    });
  };
}
