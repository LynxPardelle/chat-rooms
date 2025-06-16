import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export type UsernameOptions = {
  minLength?: number;
  maxLength?: number;
  allowUnderscore?: boolean;
  allowDash?: boolean;
  requireAlphaNumeric?: boolean;
  forbidReservedWords?: boolean;
};

const DEFAULT_OPTIONS: UsernameOptions = {
  minLength: 3,
  maxLength: 30,
  allowUnderscore: true,
  allowDash: false,
  requireAlphaNumeric: true,
  forbidReservedWords: true,
};

// Reserved words that cannot be used as usernames
const RESERVED_WORDS = [
  'admin',
  'administrator',
  'root',
  'system',
  'user',
  'guest',
  'anonymous',
  'null',
  'undefined',
  'api',
  'www',
  'mail',
  'email',
  'support',
  'help',
  'info',
  'contact',
  'about',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'auth',
  'account',
  'profile',
  'settings',
  'config',
  'dashboard',
  'chat',
  'room',
  'channel',
  'message',
  'messages',
  'bot',
  'service',
  'test',
  'demo',
  'sample',
  'example',
  'moderator',
  'mod',
  'owner',
];

@ValidatorConstraint({ name: 'isUsername', async: false })
export class IsUsernameConstraint implements ValidatorConstraintInterface {
  validate(username: string, args: ValidationArguments): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }

    const options: UsernameOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    // Check length
    if (options.minLength && username.length < options.minLength) {
      return false;
    }
    if (options.maxLength && username.length > options.maxLength) {
      return false;
    }

    // Build allowed character pattern
    let pattern = '[a-zA-Z0-9';
    if (options.allowUnderscore) {
      pattern += '_';
    }
    if (options.allowDash) {
      pattern += '-';
    }
    pattern += ']+';

    const regex = new RegExp(`^${pattern}$`);
    if (!regex.test(username)) {
      return false;
    }

    // Must start with alphanumeric character if required
    if (options.requireAlphaNumeric && !/^[a-zA-Z0-9]/.test(username)) {
      return false;
    }

    // Must end with alphanumeric character if required
    if (options.requireAlphaNumeric && !/[a-zA-Z0-9]$/.test(username)) {
      return false;
    }

    // Cannot be all numbers
    if (/^\d+$/.test(username)) {
      return false;
    }

    // Cannot contain consecutive special characters
    if (/__{2,}/.test(username) || /--{2,}/.test(username)) {
      return false;
    }

    // Check against reserved words
    if (options.forbidReservedWords && RESERVED_WORDS.includes(username.toLowerCase())) {
      return false;
    }

    // Additional pattern checks
    if (this.hasInvalidPatterns(username)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: UsernameOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    const allowedChars = ['letters', 'numbers'];
    if (options.allowUnderscore) {
      allowedChars.push('underscores');
    }
    if (options.allowDash) {
      allowedChars.push('dashes');
    }

    return `Username must be ${options.minLength}-${options.maxLength} characters long, ` +
           `contain only ${allowedChars.join(', ')}, ` +
           `start and end with a letter or number, ` +
           `and cannot be a reserved word or contain invalid patterns.`;
  }

  private hasInvalidPatterns(username: string): boolean {
    // Check for common invalid patterns
    const invalidPatterns = [
      /^_+/, // starts with underscore
      /_+$/, // ends with underscore
      /^-+/, // starts with dash
      /-+$/, // ends with dash
      /[._-]{2,}/, // consecutive special characters
      /^(test|demo|sample)/i, // test-related prefixes
      /\d{4,}/, // too many consecutive numbers (likely not a real username)
    ];

    return invalidPatterns.some(pattern => pattern.test(username));
  }
}

export function IsUsername(
  options?: UsernameOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsUsernameConstraint,
    });
  };
}
