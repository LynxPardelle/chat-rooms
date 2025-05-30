/**
 * Authentication Validators Tests
 * Unit tests for auth validation functions
 */

import { describe, it, expect } from 'vitest';
import {
  validatePassword,
  validateEmail,
  validateUsername,
  validateLoginForm,
  validateRegisterForm
} from '../validators/auth.validators';

describe('Password Validation', () => {
  it('should validate strong passwords', () => {
    const result = validatePassword('MyStrongP@ssw0rd');
    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThan(3);
  });

  it('should reject weak passwords', () => {
    const result = validatePassword('weak');
    expect(result.isValid).toBe(false);
    expect(result.feedback.length).toBeGreaterThan(0);
  });  it('should provide feedback for missing elements', () => {
    const result = validatePassword('password');
    expect(result.feedback).toContain('Password must contain at least one uppercase letter');
  });
});

describe('Email Validation', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toBeNull();
    expect(validateEmail('user.name+tag@domain.co.uk')).toBeNull();
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid')).toBeTruthy();
    expect(validateEmail('test@')).toBeTruthy();
    expect(validateEmail('@domain.com')).toBeTruthy();
  });
});

describe('Username Validation', () => {
  it('should validate correct usernames', () => {
    const result = validateUsername('validuser123');
    expect(result.isValid).toBe(true);
    expect(result.message).toBeNull();
  });

  it('should reject usernames that are too short', () => {
    const result = validateUsername('ab');
    expect(result.isValid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('should reject usernames with invalid characters', () => {
    const result = validateUsername('user@name');
    expect(result.isValid).toBe(false);
    expect(result.message).toBeTruthy();
  });
});

describe('Login Form Validation', () => {
  it('should validate correct login data', () => {
    const errors = validateLoginForm({
      email: 'test@example.com',
      password: 'ValidPassword123!'
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should return errors for invalid data', () => {
    const errors = validateLoginForm({
      email: 'invalid-email',
      password: 'weak'
    });
    expect(errors.email).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });
});

describe('Register Form Validation', () => {
  it('should validate correct registration data', () => {
    const errors = validateRegisterForm({
      username: 'testuser123',
      email: 'test@example.com',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      acceptTerms: true,
      textColor: '#000000',
      backgroundColor: '#ffffff'
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should return errors for mismatched passwords', () => {
    const errors = validateRegisterForm({
      username: 'testuser123',
      email: 'test@example.com',
      password: 'StrongPassword123!',
      confirmPassword: 'DifferentPassword123!',
      acceptTerms: true,
      textColor: '#000000',
      backgroundColor: '#ffffff'
    });
    expect(errors.confirmPassword).toBeTruthy();
  });

  it('should require terms acceptance', () => {
    const errors = validateRegisterForm({
      username: 'testuser123',
      email: 'test@example.com',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
      acceptTerms: false,
      textColor: '#000000',
      backgroundColor: '#ffffff'
    });
    expect(errors.acceptTerms).toBeTruthy();
  });
});
