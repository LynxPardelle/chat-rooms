/**
 * Validation utilities for form components
 */

/**
 * Check if a value meets minimum length requirement
 * @param value String to check
 * @param minLength Minimum length
 * @returns Boolean indicating if validation passes
 */
export const validateMinLength = (value: string, minLength?: number): boolean => {
  if (!minLength) return true;
  return value.length >= minLength;
};

/**
 * Check if a value doesn't exceed maximum length
 * @param value String to check
 * @param maxLength Maximum length
 * @returns Boolean indicating if validation passes
 */
export const validateMaxLength = (value: string, maxLength?: number): boolean => {
  if (!maxLength) return true;
  return value.length <= maxLength;
};

/**
 * Check if a value matches a pattern
 * @param value String to check
 * @param pattern RegExp pattern
 * @returns Boolean indicating if validation passes
 */
export const validatePattern = (value: string, pattern?: RegExp): boolean => {
  if (!pattern) return true;
  return pattern.test(value);
};

/**
 * Check if a value is not empty
 * @param value String to check
 * @param isRequired Whether the field is required
 * @returns Boolean indicating if validation passes
 */
export const validateRequired = (value: any, isRequired?: boolean): boolean => {
  if (!isRequired) return true;
  if (value === null || value === undefined) return false;
  
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  
  return true;
};

/**
 * Check if a value is within a numeric range
 * @param value Number to check
 * @param min Minimum value
 * @param max Maximum value
 * @returns Boolean indicating if validation passes
 */
export const validateRange = (value: number, min?: number, max?: number): boolean => {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
};

/**
 * Check if a value is a valid email
 * @param value String to check
 * @returns Boolean indicating if validation passes
 */
export const validateEmail = (value: string): boolean => {
  if (!value) return true;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(value);
};

/**
 * Check if a value is a valid URL
 * @param value String to check
 * @returns Boolean indicating if validation passes
 */
export const validateUrl = (value: string): boolean => {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};
