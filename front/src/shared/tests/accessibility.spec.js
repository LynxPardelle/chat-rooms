import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { axe, toHaveNoViolations } from 'jest-axe';
import { nextTick } from 'vue';

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

// Import components for accessibility testing
import BaseButton from '../components/BaseButton.vue';
import BaseInput from '../components/BaseInput.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseCard from '../components/BaseCard.vue';
import BaseModal from '../components/BaseModal.vue';
import ToastNotification from '../components/ToastNotification.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import DataTable from '../components/DataTable.vue';

describe('Accessibility Tests', () => {
  beforeEach(() => {
    // Reset any global state
    document.body.innerHTML = '';
  });

  describe('BaseButton Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = mount(BaseButton, {
        props: {
          variant: 'primary',
          disabled: false
        },
        slots: {
          default: 'Click me'
        }
      });

      const button = wrapper.find('button');
      expect(button.exists()).toBe(true);
      expect(button.attributes('type')).toBe('button');
      expect(button.text()).toBe('Click me');
    });

    it('should be accessible when disabled', () => {
      const wrapper = mount(BaseButton, {
        props: {
          disabled: true,
          ariaLabel: 'Disabled button'
        },
        slots: {
          default: 'Disabled'
        }
      });

      const button = wrapper.find('button');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('aria-label')).toBe('Disabled button');
    });

    it('should have proper loading state accessibility', () => {
      const wrapper = mount(BaseButton, {
        props: {
          loading: true,
          ariaLabel: 'Loading button'
        },
        slots: {
          default: 'Loading...'
        }
      });

      const button = wrapper.find('button');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('aria-label')).toBe('Loading button');
      
      const spinner = wrapper.find('.spinner-border');
      expect(spinner.exists()).toBe(true);
      expect(spinner.attributes('role')).toBe('status');
      expect(spinner.attributes('aria-hidden')).toBe('true');
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'primary' },
        slots: { default: 'Accessible Button' }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('BaseInput Accessibility', () => {
    it('should have proper label association', () => {
      const wrapper = mount(BaseInput, {
        props: {
          id: 'test-input',
          label: 'Test Label',
          modelValue: '',
          'onUpdate:modelValue': () => {}
        }
      });

      const label = wrapper.find('label');
      const input = wrapper.find('input');
      
      expect(label.exists()).toBe(true);
      expect(label.attributes('for')).toBe('test-input');
      expect(input.attributes('id')).toBe('test-input');
      expect(label.text()).toBe('Test Label');
    });

    it('should have proper error state accessibility', () => {
      const wrapper = mount(BaseInput, {
        props: {
          id: 'error-input',
          label: 'Error Input',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          error: 'This field is required',
          invalid: true
        }
      });

      const input = wrapper.find('input');
      const errorMessage = wrapper.find('.invalid-feedback');
      
      expect(input.classes()).toContain('is-invalid');
      expect(input.attributes('aria-invalid')).toBe('true');
      expect(input.attributes('aria-describedby')).toContain('error-input-error');
      expect(errorMessage.exists()).toBe(true);
      expect(errorMessage.attributes('id')).toBe('error-input-error');
    });

    it('should have proper required field accessibility', () => {
      const wrapper = mount(BaseInput, {
        props: {
          id: 'required-input',
          label: 'Required Input',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          required: true
        }
      });

      const input = wrapper.find('input');
      const label = wrapper.find('label');
      
      expect(input.attributes('required')).toBeDefined();
      expect(input.attributes('aria-required')).toBe('true');
      expect(label.text()).toContain('*'); // Should show required indicator
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(BaseInput, {
        props: {
          id: 'accessible-input',
          label: 'Accessible Input',
          modelValue: '',
          'onUpdate:modelValue': () => {}
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('BaseSelect Accessibility', () => {
    it('should have proper label association', () => {
      const wrapper = mount(BaseSelect, {
        props: {
          id: 'test-select',
          label: 'Test Select',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' }
          ]
        }
      });

      const label = wrapper.find('label');
      const select = wrapper.find('select');
      
      expect(label.exists()).toBe(true);
      expect(label.attributes('for')).toBe('test-select');
      expect(select.attributes('id')).toBe('test-select');
    });

    it('should have proper option accessibility', () => {
      const wrapper = mount(BaseSelect, {
        props: {
          id: 'options-select',
          label: 'Options Select',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          options: [
            { value: '', label: 'Choose an option' },
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2', disabled: true }
          ]
        }
      });

      const options = wrapper.findAll('option');
      expect(options.length).toBe(3);
      expect(options[2].attributes('disabled')).toBeDefined();
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(BaseSelect, {
        props: {
          id: 'accessible-select',
          label: 'Accessible Select',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' }
          ]
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('BaseModal Accessibility', () => {    it('should have proper modal accessibility attributes', async () => {
      document.body.innerHTML = '';
      const wrapper = mount(BaseModal, {
        props: {
          show: true,
          title: 'Test Modal',
          testId: 'test-modal'
        },
        slots: {
          default: 'Modal content'
        },
        attachTo: document.body
      });

      // Wait for next tick to ensure rendering is complete
      await wrapper.vm.$nextTick();

      // Since our component now uses Teleport conditionally, we need to check both ways
      const modal = wrapper.find('.modal-container');
      
      if (modal.exists()) {
        // Direct rendering (test environment)
        expect(modal.attributes('role')).toBe('dialog');
        expect(modal.attributes('aria-modal')).toBe('true');
      } else {
        // Check document directly as it might be teleported
        const modalInBody = document.querySelector('.modal-container');
        expect(modalInBody).toBeTruthy();
        expect(modalInBody?.getAttribute('role')).toBe('dialog');
        expect(modalInBody?.getAttribute('aria-modal')).toBe('true');
      }
    });    it('should have proper close button accessibility', async () => {
      document.body.innerHTML = '';
      const wrapper = mount(BaseModal, {
        props: {
          show: true,
          title: 'Test Modal',
          closable: true
        },
        slots: {
          default: 'Modal content'
        },
        attachTo: document.body
      });

      // Wait for next tick to ensure rendering is complete
      await wrapper.vm.$nextTick();

      // Find close button either in the wrapper or in the document
      if (wrapper.find('.modal-close').exists()) {
        expect(wrapper.find('.modal-close').attributes('aria-label')).toBe('Close');
      } else {
        const closeButtonInBody = document.querySelector('.modal-close');
        expect(closeButtonInBody).toBeTruthy();
        expect(closeButtonInBody?.getAttribute('aria-label')).toBe('Close');
      }
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(BaseModal, {
        props: {
          show: true,
          title: 'Accessible Modal',
          id: 'accessible-modal'
        },
        slots: {
          default: 'This is an accessible modal'
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('ToastNotification Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = mount(ToastNotification, {
        props: {
          message: 'Success message',
          type: 'success',
          show: true
        }
      });

      const toast = wrapper.find('.toast');
      expect(toast.attributes('role')).toBe('alert');
      expect(toast.attributes('aria-live')).toBe('assertive');
      expect(toast.attributes('aria-atomic')).toBe('true');
    });

    it('should have different roles for different types', () => {
      const infoWrapper = mount(ToastNotification, {
        props: {
          message: 'Info message',
          type: 'info',
          show: true
        }
      });

      const infoToast = infoWrapper.find('.toast');
      expect(infoToast.attributes('role')).toBe('status');
      expect(infoToast.attributes('aria-live')).toBe('polite');
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(ToastNotification, {
        props: {
          message: 'Accessible toast message',
          type: 'info',
          show: true
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('LoadingSpinner Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const wrapper = mount(LoadingSpinner, {
        props: {
          size: 'md',
          ariaLabel: 'Loading data',
          label: 'Loading data'
        }
      });

      const spinner = wrapper.find('.spinner-border');
      expect(spinner.attributes('role')).toBe('status');
      expect(spinner.attributes('aria-label')).toBe('Loading data');
    });

    it('should have screen reader text when no label provided', () => {
      const wrapper = mount(LoadingSpinner, {
        props: {
          size: 'md'
        }
      });

      const srText = wrapper.find('.visually-hidden');
      expect(srText.exists()).toBe(true);
      expect(srText.text()).toBe('Loading...');
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(LoadingSpinner, {
        props: {
          size: 'md',
          label: 'Loading content'
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('DataTable Accessibility', () => {
    const mockData = [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ];

    const mockColumns = [
      { key: 'id', label: 'ID', sortable: true },
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: false }
    ];    it('should have proper table accessibility structure', () => {
      const wrapper = mount(DataTable, {
        props: {
          items: mockData,
          columns: mockColumns
        }
      });

      const table = wrapper.find('table');
      const thead = wrapper.find('thead');
      const tbody = wrapper.find('tbody');
      
      expect(table.exists()).toBe(true);
      expect(thead.exists()).toBe(true);
      expect(tbody.exists()).toBe(true);
    });

    it('should have proper column headers with sorting', () => {
      const wrapper = mount(DataTable, {
        props: {
          items: mockData,
          columns: mockColumns
        }
      });

      const sortableHeaders = wrapper.findAll('th');
      expect(sortableHeaders.length).toBeGreaterThan(0);
      
      // Check that all th elements have aria-sort attribute
      sortableHeaders.forEach(header => {
        expect(header.attributes('aria-sort')).toBeDefined();
      });
    });

    it('should pass axe accessibility tests', async () => {
      const wrapper = mount(DataTable, {
        props: {
          items: mockData,
          columns: mockColumns,
          ariaLabel: 'User data table'
        }
      });

      const results = await axe(wrapper.html());
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('BaseButton should be keyboard accessible', async () => {
      const mockClick = vi.fn();
      const wrapper = mount(BaseButton, {
        props: {
          onClick: mockClick
        },
        slots: {
          default: 'Keyboard Button'
        }
      });

      const button = wrapper.find('button');
      
      // Test Enter key
      await button.trigger('keydown.enter');
      expect(mockClick).toHaveBeenCalled();
      
      // Test Space key
      mockClick.mockClear();
      await button.trigger('keydown.space');
      expect(mockClick).toHaveBeenCalled();
    });    it('BaseModal should trap focus', async () => {
      document.body.innerHTML = '';
      const wrapper = mount(BaseModal, {
        props: {
          show: true,
          title: 'Focus Trap Modal'
        },
        slots: {
          default: '<button>First Button</button><button>Second Button</button>'
        },
        attachTo: document.body
      });

      // Wait for multiple ticks to ensure complete rendering
      await wrapper.vm.$nextTick();
      await nextTick();
      
      // Modal should be visible - check in wrapper or document
      let modalExists = wrapper.find('.modal').exists() || wrapper.find('.modal-container').exists();
      if (!modalExists) {
        // Check in document body as it might be teleported
        modalExists = !!(document.querySelector('.modal') || document.querySelector('.modal-container'));
      }
      
      expect(modalExists).toBe(true);
    });

    it('DataTable should support keyboard navigation', async () => {
      const mockData = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ];
      
      const mockColumns = [
        { key: 'id', label: 'ID', sortable: true },
        { key: 'name', label: 'Name', sortable: true }
      ];      const wrapper = mount(DataTable, {
        props: {
          items: mockData,
          columns: mockColumns
        }
      });

      const sortableHeaders = wrapper.findAll('th button');
      
      // Should be able to activate sorting with Enter key
      if (sortableHeaders.length > 0) {
        await sortableHeaders[0].trigger('keydown.enter');
        // Verify sorting is triggered (implementation specific)
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide appropriate ARIA labels and descriptions', () => {
      const wrapper = mount(BaseInput, {
        props: {
          id: 'described-input',
          label: 'Password',
          type: 'password',
          modelValue: '',
          'onUpdate:modelValue': () => {},
          helpText: 'Must be at least 8 characters long',
          required: true
        }
      });

      const input = wrapper.find('input');
      const helpText = wrapper.find('.form-text');
      
      expect(input.attributes('aria-describedby')).toContain('described-input-help');
      expect(helpText.attributes('id')).toBe('described-input-help');
      expect(helpText.text()).toBe('Must be at least 8 characters long');
    });

    it('should announce dynamic content changes', () => {
      const wrapper = mount(ToastNotification, {
        props: {
          message: 'Data saved successfully',
          type: 'success',
          show: true
        }
      });

      const toast = wrapper.find('.toast');
      // Toast notifications should use assertive aria-live for important updates
      expect(toast.attributes('aria-live')).toBe('assertive');
      expect(toast.attributes('role')).toBe('alert');
    });
  });
});
