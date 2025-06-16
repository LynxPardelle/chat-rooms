import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

export type StrongPasswordOptions = {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSymbols?: boolean;
  forbidCommonPasswords?: boolean;
};

const DEFAULT_OPTIONS: StrongPasswordOptions = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  forbidCommonPasswords: true,
};

// Common weak passwords to forbid
const COMMON_PASSWORDS = [
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '111111',
  'dragon',
  'master',
  'hello',
  'freedom',
  'whatever',
  'qazwsx',
  'trustno1',
];

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    if (!password || typeof password !== 'string') {
      return false;
    }

    const options: StrongPasswordOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    // Check minimum length
    if (options.minLength && password.length < options.minLength) {
      return false;
    }

    // Check for uppercase letters
    if (options.requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Check for lowercase letters
    if (options.requireLowercase && !/[a-z]/.test(password)) {
      return false;
    }

    // Check for numbers
    if (options.requireNumbers && !/\d/.test(password)) {
      return false;
    }

    // Check for symbols
    if (options.requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      return false;
    }

    // Check against common passwords
    if (options.forbidCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
      return false;
    }

    // Additional security checks
    // Prevent passwords that are just repeated characters
    if (/^(.)\1+$/.test(password)) {
      return false;
    }

    // Prevent simple sequential patterns
    if (this.hasSimplePattern(password)) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const options: StrongPasswordOptions = {
      ...DEFAULT_OPTIONS,
      ...(args.constraints[0] || {}),
    };

    const requirements: string[] = [];
    
    if (options.minLength) {
      requirements.push(`at least ${options.minLength} characters`);
    }
    if (options.requireUppercase) {
      requirements.push('at least one uppercase letter');
    }
    if (options.requireLowercase) {
      requirements.push('at least one lowercase letter');
    }
    if (options.requireNumbers) {
      requirements.push('at least one number');
    }
    if (options.requireSymbols) {
      requirements.push('at least one special character');
    }

    const baseMessage = `Password must contain ${requirements.join(', ')}`;
    const additionalRules = [
      'cannot be a common password',
      'cannot be repeated characters',
      'cannot be a simple sequential pattern',
    ];

    return `${baseMessage}, and ${additionalRules.join(', ')}.`;
  }

  private hasSimplePattern(password: string): boolean {
    const patterns = [
      /123456/,
      /abcdef/,
      /qwerty/,
      /asdfgh/,
      /zxcvbn/,
      /012345/,
      /987654/,
      /fedcba/,
    ];

    return patterns.some(pattern => pattern.test(password.toLowerCase()));
  }
}

export function IsStrongPassword(
  options?: StrongPasswordOptions,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [options],
      validator: IsStrongPasswordConstraint,
    });
  };
}
