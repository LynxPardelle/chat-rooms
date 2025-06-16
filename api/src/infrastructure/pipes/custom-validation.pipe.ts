import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { AppLoggerService } from '../logging/app-logger.service';

@Injectable()
export class CustomValidationPipe implements PipeTransform<any> {
  constructor(private readonly logger: AppLoggerService) {}

  async transform(value: any, { metatype }: ArgumentMetadata): Promise<any> {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const errorMessages = this.formatValidationErrors(errors);
      
      // Log validation errors for monitoring
      this.logger.warn('Validation failed', {
        validationErrors: errorMessages,
        inputData: this.sanitizeLogData(value),
        targetClass: metatype.name,
      });

      throw new BadRequestException({
        message: 'Validation failed',
        error: 'ValidationError',
        details: errorMessages,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private formatValidationErrors(errors: ValidationError[]): string[] {
    return errors.flatMap((error) => this.extractErrorMessages(error));
  }

  private extractErrorMessages(error: ValidationError): string[] {
    const messages: string[] = [];

    // Extract constraint messages
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }

    // Extract messages from nested errors
    if (error.children && error.children.length > 0) {
      error.children.forEach((child) => {
        messages.push(...this.extractErrorMessages(child));
      });
    }

    // If no specific constraints, create a generic message
    if (messages.length === 0) {
      messages.push(`Validation failed for property '${error.property}'`);
    }

    return messages;
  }

  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    
    // Remove sensitive fields from logs
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
