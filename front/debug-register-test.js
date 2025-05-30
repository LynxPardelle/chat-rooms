import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import RegisterForm from './src/modules/auth/components/RegisterForm.vue';

// Mock the auth service
vi.mock('@/core/services/auth.service', () => ({
  default: {
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

describe('Debug RegisterForm', () => {
  it('should debug password confirmation validation', async () => {
    const wrapper = mount(RegisterForm, {
      global: {
        plugins: [router]
      }
    });

    console.log('Initial wrapper state:', wrapper.vm);
    
    // Check initial form data
    console.log('Initial form data:', wrapper.vm.formData);
    console.log('Initial errors:', wrapper.vm.errors);
    
    // Set different passwords by triggering input events
    const passwordInput = wrapper.find('#password');
    const confirmPasswordInput = wrapper.find('#confirmPassword');
    
    console.log('Password input found:', passwordInput.exists());
    console.log('Confirm password input found:', confirmPasswordInput.exists());
    
    await passwordInput.setValue('password123');
    await passwordInput.trigger('input');
    await wrapper.vm.$nextTick();
    
    console.log('After setting password:', wrapper.vm.formData);
    
    await confirmPasswordInput.setValue('different123');
    await confirmPasswordInput.trigger('input');
    await wrapper.vm.$nextTick();
    
    console.log('After setting confirm password:', wrapper.vm.formData);
    console.log('Errors after setting confirm password:', wrapper.vm.errors);
    
    // Trigger validation by blurring the confirm password field
    await confirmPasswordInput.trigger('blur');
    await wrapper.vm.$nextTick();

    console.log('After blur - errors:', wrapper.vm.errors);
    console.log('After blur - form data:', wrapper.vm.formData);
    
    // Check if error elements exist
    const errorElements = wrapper.findAll('.field__error');
    console.log('Error elements found:', errorElements.length);
    errorElements.forEach((el, index) => {
      console.log(`Error ${index}:`, el.text());
    });
    
    // Check the full wrapper text
    console.log('Full wrapper text:', wrapper.text());
    
    // Try to find the specific error
    const confirmPasswordField = wrapper.find('#confirmPassword').element.closest('.auth-field');
    if (confirmPasswordField) {
      console.log('Confirm password field HTML:', confirmPasswordField.innerHTML);
    }
  });
});
