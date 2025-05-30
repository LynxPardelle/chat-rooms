/**
 * Authentication Module Setup
 * Test utilities and mocks for auth module testing
 */

import { vi } from 'vitest';
import { expect } from 'vitest';
import type { AuthFormErrors, LoginFormData, RegisterFormData } from '../types/auth-module.types';

// =====================================
// Mock Data
// =====================================

export const mockLoginData: LoginFormData = {
  email: 'test@example.com',
  password: 'Password123!',
  rememberMe: false
};

export const mockRegisterData: RegisterFormData = {
  username: 'testuser123',
  email: 'test@example.com',
  password: 'Password123!',
  confirmPassword: 'Password123!',
  acceptTerms: true,
  textColor: '#000000',
  backgroundColor: '#ffffff',
  showColorPreview: false
};

export const mockUser = {
  id: '1',
  username: 'testuser123',
  email: 'test@example.com',
  textColor: '#000000',
  backgroundColor: '#ffffff',
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token'
};

// =====================================
// Mock Services
// =====================================

export const mockAuthService = {
  login: vi.fn().mockResolvedValue(mockAuthResponse),
  register: vi.fn().mockResolvedValue(mockAuthResponse),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshTokens: vi.fn().mockResolvedValue(mockAuthResponse),
  isAuthenticated: false,
  currentUser: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  onAuthStateChange: vi.fn()
};

export const mockErrorService = {
  handleApiError: vi.fn().mockReturnValue({
    message: 'Test error message',
    type: 'api_error',
    details: null
  }),
  handleError: vi.fn(),
  formatError: vi.fn().mockReturnValue('Formatted error message')
};

// =====================================
// Test Utilities
// =====================================

export const createMockFormErrors = (fields: string[]): AuthFormErrors => {
  const errors: AuthFormErrors = {};
  fields.forEach(field => {
    errors[field] = `${field} is required`;
  });
  return errors;
};

export const waitForValidation = (ms: number = 350) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockRouterPush = vi.fn();
export const mockRouter = {
  push: mockRouterPush,
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn()
};

// =====================================
// Component Test Helpers
// =====================================

export const createFormWrapper = (_component: any, props: any = {}) => {
  return {
    props: {
      ...props
    },
    global: {
      plugins: [mockRouter],
      mocks: {
        $router: mockRouter
      }
    }
  };
};

export const triggerFormSubmit = async (wrapper: any) => {
  await wrapper.find('form').trigger('submit.prevent');
  await wrapper.vm.$nextTick();
};

export const fillFormField = async (wrapper: any, selector: string, value: any) => {
  const field = wrapper.find(selector);
  if (field.element.type === 'checkbox') {
    await field.setChecked(value);
  } else {
    await field.setValue(value);
  }
  await wrapper.vm.$nextTick();
};

// =====================================
// Validation Test Helpers
// =====================================

export const expectValidationError = (errors: AuthFormErrors, field: string) => {
  expect(errors[field]).toBeTruthy();
  expect(typeof errors[field]).toBe('string');
};

export const expectNoValidationError = (errors: AuthFormErrors, field: string) => {
  expect(errors[field]).toBeNull();
};

export const expectFormValid = (errors: AuthFormErrors) => {
  const errorCount = Object.values(errors).filter(error => error !== null).length;
  expect(errorCount).toBe(0);
};

export const expectFormInvalid = (errors: AuthFormErrors) => {
  const errorCount = Object.values(errors).filter(error => error !== null).length;
  expect(errorCount).toBeGreaterThan(0);
};
