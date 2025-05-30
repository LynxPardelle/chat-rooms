/**
 * Authentication Components Tests
 * Integration tests for auth components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import LoginForm from '../components/LoginForm.vue';
import RegisterForm from '../components/RegisterForm.vue';
import AuthFormField from '../components/AuthFormField.vue';

// Mock the auth service
vi.mock('@/core/services/auth.service', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    isAuthenticated: false
  }
}));

// Mock the error service
vi.mock('@/core/services/error.service', () => ({
  errorService: {
    handleApiError: vi.fn((_error) => ({
      message: 'Test error',
      type: 'api_error'
    }))
  }
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/auth/login', component: { template: '<div>Login</div>' } }
  ]
});

describe('AuthFormField Component', () => {
  it('should render text input correctly', () => {
    const wrapper = mount(AuthFormField, {
      props: {
        id: 'test-field',
        label: 'Test Field',
        type: 'text',
        modelValue: '',
        placeholder: 'Enter text'
      }
    });

    expect(wrapper.find('label').text()).toBe('Test Field');
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter text');
  });
  it('should render password input with toggle', () => {
    const wrapper = mount(AuthFormField, {
      props: {
        id: 'password-field',
        label: 'Password',
        type: 'password',
        modelValue: '',
        showToggle: true
      }
    });

    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.find('.field__toggle').exists()).toBe(true);
  });
  it('should display error messages', () => {
    const wrapper = mount(AuthFormField, {
      props: {
        id: 'error-field',
        label: 'Error Field',
        type: 'text',
        modelValue: '',
        error: 'This field has an error',
        touched: true
      }
    });

    expect(wrapper.find('.field__error').text()).toBe('This field has an error');
    expect(wrapper.find('.field--error').exists()).toBe(true);
  });

  it('should render checkbox input', () => {
    const wrapper = mount(AuthFormField, {
      props: {
        id: 'checkbox-field',
        label: 'Accept Terms',
        type: 'checkbox',
        modelValue: false
      }
    });

    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
    expect(wrapper.find('.field--checkbox').exists()).toBe(true);
  });
});

describe('LoginForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render login form correctly', () => {
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [router]
      }
    });

    expect(wrapper.find('h2').text()).toBe('Welcome Back');
    expect(wrapper.find('#email').exists()).toBe(true);
    expect(wrapper.find('#password').exists()).toBe(true);
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true);
  });

  it('should emit success on successful login', async () => {
    const wrapper = mount(LoginForm, {
      global: {
        plugins: [router]
      }
    });    // Mock successful login
    const authService = await import('@/core/services/auth.service');
    vi.mocked(authService.default.login).mockResolvedValue({
      id: '1', 
      username: 'testuser',
      email: 'test@example.com',      textColor: '#000000',
      backgroundColor: '#ffffff',
      isOnline: true,
      lastSeen: new Date(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Fill form and submit
    await wrapper.find('#email').setValue('test@example.com');
    await wrapper.find('#password').setValue('password123');
    await wrapper.find('form').trigger('submit.prevent');

    // Wait for async operations
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('success')).toBeTruthy();
  });
});

describe('RegisterForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render register form correctly', () => {
    const wrapper = mount(RegisterForm, {
      global: {
        plugins: [router]
      }
    });

    expect(wrapper.find('h2').text()).toBe('Create Account');
    expect(wrapper.find('#username').exists()).toBe(true);
    expect(wrapper.find('#email').exists()).toBe(true);
    expect(wrapper.find('#password').exists()).toBe(true);
    expect(wrapper.find('#confirmPassword').exists()).toBe(true);
    expect(wrapper.find('#acceptTerms').exists()).toBe(true);
  });
  it('should validate password confirmation', async () => {
    const wrapper = mount(RegisterForm, {
      global: {
        plugins: [router]
      }
    });

    // Set different passwords by triggering input events
    const passwordInput = wrapper.find('#password');
    const confirmPasswordInput = wrapper.find('#confirmPassword');
    
    await passwordInput.setValue('password123');
    await passwordInput.trigger('input');
    await wrapper.vm.$nextTick();
    
    await confirmPasswordInput.setValue('different123');
    await confirmPasswordInput.trigger('input');
    await wrapper.vm.$nextTick();
    
    // Trigger validation by blurring the confirm password field
    await confirmPasswordInput.trigger('blur');
    await wrapper.vm.$nextTick();

    // Should show validation error
    expect(wrapper.text()).toContain('Passwords do not match');
  });
});
