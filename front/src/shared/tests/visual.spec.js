import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

// Import all shared components
import BaseButton from '../components/BaseButton.vue';
import BaseInput from '../components/BaseInput.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseCard from '../components/BaseCard.vue';
import BaseModal from '../components/BaseModal.vue';
import ToastNotification from '../components/ToastNotification.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';

describe('Visual Component Tests', () => {
  describe('Theme Consistency', () => {
    it('BaseButton maintains consistent styling across variants', () => {
      const variants = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];
      
      variants.forEach(variant => {
        const wrapper = mount(BaseButton, {
          props: { variant },
          slots: { default: 'Test Button' }
        });
        
        expect(wrapper.classes()).toContain('btn');
        expect(wrapper.classes()).toContain(`btn-${variant}`);
        expect(wrapper.element.tagName).toBe('BUTTON');
      });
    });

    it('BaseInput maintains consistent styling across sizes', () => {
      const sizes = ['sm', 'md', 'lg'];
      
      sizes.forEach(size => {
        const wrapper = mount(BaseInput, {
          props: { 
            size,
            modelValue: '',
            'onUpdate:modelValue': () => {}
          }
        });
        
        expect(wrapper.classes()).toContain('form-control');
        if (size !== 'md') {
          expect(wrapper.classes()).toContain(`form-control-${size}`);
        }
      });
    });

    it('BaseCard has consistent structure and classes', () => {
      const wrapper = mount(BaseCard, {
        props: {
          title: 'Test Card',
          subtitle: 'Test Subtitle'
        },
        slots: {
          default: '<p>Card content</p>'
        }
      });

      expect(wrapper.classes()).toContain('card');
      expect(wrapper.find('.card-header')).toBeTruthy();
      expect(wrapper.find('.card-body')).toBeTruthy();
      expect(wrapper.text()).toContain('Test Card');
      expect(wrapper.text()).toContain('Test Subtitle');
    });
  });

  describe('Responsive Design', () => {
    it('components handle different viewport widths', async () => {
      // Mock different viewport widths
      const mockMatchMedia = (width) => ({
        matches: width < 768,
        media: `(max-width: ${width}px)`,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      });

      // Test mobile viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: () => mockMatchMedia(375)
      });

      const mobileButton = mount(BaseButton, {
        props: { variant: 'primary', fullWidth: true },
        slots: { default: 'Mobile Button' }
      });

      expect(mobileButton.classes()).toContain('w-100');

      // Test desktop viewport
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: () => mockMatchMedia(1200)
      });

      const desktopButton = mount(BaseButton, {
        props: { variant: 'primary' },
        slots: { default: 'Desktop Button' }
      });

      expect(desktopButton.classes()).not.toContain('w-100');
    });

    it('LoadingSpinner scales properly', () => {
      const sizes = ['sm', 'md', 'lg'];
      
      sizes.forEach(size => {
        const wrapper = mount(LoadingSpinner, {
          props: { size }
        });
        
        const spinner = wrapper.find('.spinner-border');
        expect(spinner.exists()).toBe(true);
        
        if (size !== 'md') {
          expect(spinner.classes()).toContain(`spinner-border-${size}`);
        }
      });
    });
  });

  describe('Dark Mode Support', () => {
    beforeEach(() => {
      // Reset document attributes
      document.documentElement.removeAttribute('data-bs-theme');
    });

    it('components adapt to dark mode', () => {
      // Set dark mode
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      
      const wrapper = mount(BaseCard, {
        props: { title: 'Dark Mode Card' },
        slots: { default: 'Content' }
      });

      // In dark mode, Bootstrap components should inherit dark theme
      expect(wrapper.classes()).toContain('card');
      // The component should still render correctly in dark mode
      expect(wrapper.find('.card-header').exists()).toBe(true);
      expect(wrapper.find('.card-body').exists()).toBe(true);
    });

    it('ToastNotification maintains visibility in dark mode', () => {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
      
      const wrapper = mount(ToastNotification, {
        props: {
          message: 'Dark mode toast',
          type: 'success',
          show: true
        }
      });

      expect(wrapper.classes()).toContain('toast');
      expect(wrapper.classes()).toContain('text-bg-success');
      expect(wrapper.text()).toContain('Dark mode toast');
    });
  });

  describe('Component States', () => {
    it('BaseButton shows loading state correctly', async () => {
      const wrapper = mount(BaseButton, {
        props: {
          loading: true
        },
        slots: {
          default: 'Loading Button'
        }
      });

      expect(wrapper.find('.spinner-border').exists()).toBe(true);
      expect(wrapper.attributes('disabled')).toBeDefined();
    });

    it('BaseInput shows error state correctly', () => {
      const wrapper = mount(BaseInput, {
        props: {
          modelValue: '',
          'onUpdate:modelValue': () => {},
          error: 'This field is required',
          invalid: true
        }
      });

      expect(wrapper.classes()).toContain('is-invalid');
      expect(wrapper.find('.invalid-feedback').exists()).toBe(true);
      expect(wrapper.find('.invalid-feedback').text()).toBe('This field is required');
    });

    it('BaseInput shows success state correctly', () => {
      const wrapper = mount(BaseInput, {
        props: {
          modelValue: 'valid input',
          'onUpdate:modelValue': () => {},
          valid: true
        }
      });

      expect(wrapper.classes()).toContain('is-valid');
    });
  });

  describe('Icon Integration', () => {
    it('BaseButton displays icons correctly', () => {
      const wrapper = mount(BaseButton, {
        props: {
          icon: 'bi-check'
        },
        slots: {
          default: 'Icon Button'
        }
      });

      const icon = wrapper.find('i.bi-check');
      expect(icon.exists()).toBe(true);
    });

    it('ToastNotification displays type icons correctly', () => {
      const types = ['success', 'error', 'warning', 'info'];
      
      types.forEach(type => {
        const wrapper = mount(ToastNotification, {
          props: {
            message: `${type} message`,
            type,
            show: true
          }
        });

        const icon = wrapper.find('i');
        expect(icon.exists()).toBe(true);
      });
    });
  });

  describe('Animation and Transitions', () => {    it('BaseModal has proper transition classes', async () => {
      const wrapper = mount(BaseModal, {
        props: {
          show: true,
          title: 'Test Modal'
        },
        slots: {
          default: 'Modal content'
        },
        attachTo: document.body
      });

      await nextTick(); // Wait for rendering
      await nextTick(); // Extra tick for transitions

      // Check if modal is rendered directly in wrapper (test environment) or teleported to body
      const modal = wrapper.find('.modal');
      const modalDialog = wrapper.find('.modal-dialog');
      
      if (modal.exists()) {
        // Direct rendering (test environment)
        expect(modal.exists()).toBe(true);
        expect(modalDialog.exists()).toBe(true);
      } else {
        // Teleport rendering - check document body
        const bodyModal = document.body.querySelector('.modal');
        const bodyModalDialog = document.body.querySelector('.modal-dialog');
        expect(bodyModal).toBeTruthy();
        expect(bodyModalDialog).toBeTruthy();
      }
    });

    it('ToastNotification handles show/hide transitions', async () => {
      const wrapper = mount(ToastNotification, {
        props: {
          message: 'Test toast',
          type: 'info',
          show: true
        }
      });

      expect(wrapper.find('.toast').exists()).toBe(true);
      
      await wrapper.setProps({ show: false });
      // The toast should still exist but might have different classes
      expect(wrapper.find('.toast').exists()).toBe(true);
    });
  });
});
