/**
 * Authentication Form Validators
 */

import type { 
  AuthFormErrors, 
  LoginFormData, 
  RegisterFormData,
  PasswordStrengthResult 
} from '../types/auth-module.types';

// Define the missing type
interface ValidationRule {
  required?: boolean;
  message?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
}

// =====================================
// Email Validation
// =====================================

export function validateEmail(email: string): string | null {
  if (!email) {
    return 'Email is required';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  
  return null;
}

// =====================================
// Password Validation
// =====================================

export function validatePassword(password: string): PasswordStrengthResult {
  if (!password) {
    return {
      score: 0,
      feedback: ['Password is required'],
      isValid: false,
      strength: 'weak'
    };
  }

  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }
  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Password must contain at least one uppercase letter');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add lowercase letters');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add numbers');
  }

  // Special character check
  if (/[^A-Za-z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Add special characters');
  }

  const strengthMap = {
    0: 'weak',
    1: 'weak', 
    2: 'fair',
    3: 'good',
    4: 'strong',
    5: 'strong'
  } as const;

  const strength = strengthMap[score as keyof typeof strengthMap];
  const isValid = score >= 3;

  return {
    score,
    feedback,
    isValid,
    strength
  };
}

// =====================================
// Username Validation
// =====================================

export function validateUsername(username: string): { isValid: boolean; message: string | null } {
  if (!username) {
    return {
      isValid: false,
      message: 'Username is required'
    };
  }
  
  if (username.length < 3) {
    return {
      isValid: false,
      message: 'Username must be at least 3 characters long'
    };
  }
  
  if (username.length > 30) {
    return {
      isValid: false,
      message: 'Username must be less than 30 characters'
    };
  }
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return {
      isValid: false,
      message: 'Username can only contain letters, numbers, underscores, and hyphens'
    };
  }
  
  return {
    isValid: true,
    message: null
  };
}

// =====================================
// Color Validation
// =====================================

// Adding the missing color validation functions
export function validateColor(color: string): string | null {
  const hexColorRegex = /^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
  if (!hexColorRegex.test(color)) {
    return 'Please provide a valid hex color';
  }
  return null;
}

export function validateColorContrast(textColor: string, backgroundColor: string): string | null {
  // Simple contrast check - in a real app you would use WCAG calculations
  if (textColor.toLowerCase() === backgroundColor.toLowerCase()) {
    return 'Text and background colors cannot be the same';
  }
  return null;
}

// =====================================
// Generic Field Validation
// =====================================

export const validateField = (value: any, rules: ValidationRule): string | null => {
  // Required validation
  if (rules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
    return rules.message || 'This field is required';
  }

  // Skip other validations if field is empty and not required
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    // Min length validation
    if (rules.minLength && value.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    // Max length validation
    if (rules.maxLength && value.length > rules.maxLength) {
      return `Cannot be more than ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(value)) {
      return rules.message || 'Invalid format';
    }
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
};

// =====================================
// Form Validators
// =====================================

export function validateLoginForm(data: LoginFormData): AuthFormErrors {
  const errors: AuthFormErrors = {};

  // Email validation
  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;
  // Password validation
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.feedback[0] || 'Password is required';
  }

  return errors;
}

export function validateRegisterForm(data: RegisterFormData): AuthFormErrors {
  const errors: AuthFormErrors = {};
    // Username validation
  const usernameValidation = validateUsername(data.username);
  if (!usernameValidation.isValid) {
    errors.username = usernameValidation.message;
  }
  
  // Email validation
  const emailError = validateEmail(data.email);
  if (emailError) {
    errors.email = emailError;
  }
  
  // Password validation
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.feedback[0] || 'Password is too weak';
  }
  
  // Confirm password validation
  if (!data.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }
  
  // Color validation
  if (data.textColor) {
    const textColorError = validateColor(data.textColor);
    if (textColorError) errors.textColor = textColorError;
  } else {
    errors.textColor = 'Please select a text color';
  }
  
  if (data.backgroundColor) {
    const bgColorError = validateColor(data.backgroundColor);
    if (bgColorError) errors.backgroundColor = bgColorError;
  } else {
    errors.backgroundColor = 'Please select a background color';
  }

  // Color contrast validation
  if (data.textColor && data.backgroundColor) {
    const contrastError = validateColorContrast(data.textColor, data.backgroundColor);
    if (contrastError) {
      errors.colorContrast = contrastError;
    }
  }
  
  // Terms acceptance validation
  if (!data.acceptTerms) {
    errors.acceptTerms = 'You must accept the terms and conditions';
  }
  
  return errors;
}

// =====================================
// Utility Functions
// =====================================

export function hasErrors(errors: AuthFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function clearFieldError(errors: AuthFormErrors, field: string): AuthFormErrors {
  const newErrors = { ...errors };
  delete newErrors[field];
  return newErrors;
}

export function getFirstError(errors: AuthFormErrors): string | null {
  const firstErrorKey = Object.keys(errors)[0];
  if (!firstErrorKey) return null;
  
  const error = errors[firstErrorKey];
  return Array.isArray(error) ? error[0] : error;
}
