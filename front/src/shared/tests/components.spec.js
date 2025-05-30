import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

// Base Components
import BaseButton from '../components/BaseButton.vue';
import BaseInput from '../components/BaseInput.vue';
import BaseSelect from '../components/BaseSelect.vue';
import BaseCard from '../components/BaseCard.vue';

// Feedback Components
import BaseModal from '../components/BaseModal.vue';
import ToastNotification from '../components/ToastNotification.vue';
import LoadingSpinner from '../components/LoadingSpinner.vue';
import Confirmation from '../components/Confirmation.vue';

// Layout Components
import AppLayout from '../components/AppLayout.vue';
import DataTable from '../components/DataTable.vue';

// Mock router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn()
  })
}));

describe('BaseButton', () => {  it('renders with default props', () => {
    const wrapper = mount(BaseButton, {
      slots: {
        default: 'Button Text'
      }
    });
    
    expect(wrapper.text()).toContain('Button Text');
    expect(wrapper.classes()).toContain('btn');
    expect(wrapper.classes()).toContain('btn-primary');
  });

  it('applies variant class correctly', () => {
    const wrapper = mount(BaseButton, {
      props: {
        variant: 'danger'
      }
    });
    
    expect(wrapper.classes()).toContain('btn-danger');
  });

  it('shows loading state correctly', async () => {
    const wrapper = mount(BaseButton, {
      props: {
        loading: true
      }
    });
    
    expect(wrapper.classes()).toContain('loading');
    expect(wrapper.find('.spinner').exists()).toBe(true);
    expect(wrapper.attributes('disabled')).toBeDefined();
  });

  it('emits click event when not disabled or loading', async () => {
    const wrapper = mount(BaseButton);
    
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });

  it('does not emit click when disabled', async () => {
    const wrapper = mount(BaseButton, {
      props: {
        disabled: true
      }
    });
    
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeFalsy();
  });
});

describe('BaseInput', () => {
  it('renders with default props', () => {
    const wrapper = mount(BaseInput, {
      props: {
        modelValue: '',
        label: 'Test Label'
      }
    });
    
    expect(wrapper.find('label').text()).toBe('Test Label');
    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(BaseInput, {
      props: {
        modelValue: ''
      }
    });
    
    const input = wrapper.find('input');
    await input.setValue('New Value');
    
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('New Value');
  });
  it('shows error state correctly', () => {
    const wrapper = mount(BaseInput, {
      props: {
        modelValue: '',
        errorMessage: 'This field is required'
      }
    });
    
    expect(wrapper.find('.is-invalid').exists()).toBe(true);
    expect(wrapper.find('.form-error').text()).toBe('This field is required');
  });
  it('renders with left and right icons correctly', () => {
    const wrapper = mount(BaseInput, {
      props: {
        modelValue: ''
      },
      slots: {
        leftIcon: '<i class="fa fa-user"></i>',
        rightIcon: '<i class="fa fa-search"></i>'
      }
    });
    
    expect(wrapper.find('.input-icon-left').exists()).toBe(true);
    expect(wrapper.find('.input-icon-right').exists()).toBe(true);
    expect(wrapper.find('input').classes()).toContain('has-icon-left');
    expect(wrapper.find('input').classes()).toContain('has-icon-right');
  });
});

describe('BaseSelect', () => {  it('renders with options', () => {
    const wrapper = mount(BaseSelect, {
      props: {
        modelValue: '',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      }
    });
    
    const options = wrapper.findAll('option');
    expect(options.length).toBe(2); // Without placeholder, only 2 options
    expect(options[0].text()).toBe('Option 1');
    expect(options[0].attributes('value')).toBe('option1');
  });
  it('emits update:modelValue on selection', async () => {
    const wrapper = mount(BaseSelect, {
      props: {
        modelValue: '',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]
      }
    });
    
    const select = wrapper.find('select');
    await select.setValue('option1');
    
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0][0]).toBe('option1');
  });
  it('supports option groups', () => {
    const wrapper = mount(BaseSelect, {
      props: {
        modelValue: '',
        options: [
          { value: 'option1', label: 'Option 1', group: 'Group 1' },
          { value: 'option2', label: 'Option 2', group: 'Group 1' },
          { value: 'option3', label: 'Option 3', group: 'Group 2' },
          { value: 'option4', label: 'Option 4', group: 'Group 2' }
        ]
      }
    });
    
    const groups = wrapper.findAll('optgroup');
    expect(groups.length).toBe(2);
    expect(groups[0].attributes('label')).toBe('Group 1');
    expect(groups[1].attributes('label')).toBe('Group 2');
  });
});

describe('BaseCard', () => {  it('renders with default slot', () => {
    const wrapper = mount(BaseCard, {
      slots: {
        default: 'Card Content'
      }
    });
    
    expect(wrapper.find('.base-card').exists()).toBe(true);
    expect(wrapper.find('.card-body').text()).toContain('Card Content');
  });

  it('renders with header and footer slots', () => {
    const wrapper = mount(BaseCard, {
      slots: {
        header: 'Card Header',
        default: 'Card Content',
        footer: 'Card Footer'
      }
    });
    
    expect(wrapper.find('.card-header').text()).toContain('Card Header');
    expect(wrapper.find('.card-body').text()).toContain('Card Content');
    expect(wrapper.find('.card-footer').text()).toContain('Card Footer');
  });
  it('applies variant styles correctly', () => {
    const wrapper = mount(BaseCard, {
      props: {
        variant: 'primary'
      }
    });
    
    expect(wrapper.find('.base-card').classes()).toContain('card-primary');
  });
});

describe('BaseModal', () => {  it('renders when visible', async () => {
    const wrapper = mount(BaseModal, {
      props: {
        show: true,
        title: 'Test Modal'
      },
      slots: {
        default: 'Modal content'
      }
    });
    
    await nextTick(); // Wait for rendering
    
    // Since isTestEnvironment is true, modal should render directly in wrapper
    const modalTitle = wrapper.find('.modal-title');
    const modalBody = wrapper.find('.modal-body');
    
    expect(modalTitle.exists()).toBe(true);
    expect(modalBody.exists()).toBe(true);
    expect(modalTitle.text()).toContain('Test Modal');
    expect(modalBody.text()).toContain('Modal content');
    
    // Verify accessibility attributes
    const modalDialog = wrapper.find('[role="dialog"]');
    expect(modalDialog.exists()).toBe(true);
    expect(modalDialog.attributes('aria-modal')).toBe('true');
    expect(modalDialog.attributes('aria-labelledby')).toBeTruthy();
    expect(modalDialog.attributes('aria-describedby')).toBeTruthy();
  });it('emits close event when backdrop clicked', async () => {
    const wrapper = mount(BaseModal, {      props: {
        show: true,
        persistent: false
      },
      attachTo: document.body
    });
    
    await nextTick();
    
    // Since the modal content is teleported to body, we need to find it in the document
    // But to test the event emission properly, we need to directly call the component method
    // Find the actual modal component instance and call the handleOutsideClick method
    const modalComponent = wrapper.vm;
    
    // Call the handleOutsideClick method directly to simulate backdrop click
    modalComponent.handleOutsideClick();
    await nextTick();
      // Check that the modal emits update:show with false
    const emitted = wrapper.emitted('update:show');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toBe(false);
  });
});

describe('ToastNotification', () => {  it('renders container correctly', async () => {
    const wrapper = mount(ToastNotification, {
      attachTo: document.body
    });
    
    await nextTick();
    
    // Toast container is teleported to body
    const toastContainer = document.querySelector('.toast-container');
    expect(toastContainer).toBeTruthy();
  });

  it('shows no toasts initially', () => {
    const wrapper = mount(ToastNotification);
    expect(wrapper.findAll('.toast').length).toBe(0);
  });
});

describe('LoadingSpinner', () => {  it('renders with default props', () => {
    const wrapper = mount(LoadingSpinner);
    
    expect(wrapper.find('.loading-spinner').exists()).toBe(true);
    expect(wrapper.find('.spinner').exists()).toBe(true);
  });
  it('applies size class correctly', () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        size: 'lg'
      }
    });
    
    expect(wrapper.find('.loading-spinner').classes()).toContain('spinner-lg');
  });
  it('applies variant class correctly', () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        variant: 'primary'
      }
    });
    
    expect(wrapper.find('.loading-spinner').classes()).toContain('spinner-primary');
  });
});

describe('DataTable', () => {  const testColumns = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true }
  ];
  
  const testItems = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
  ];

  it('renders table with columns and data', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: testColumns,
        items: testItems
      }
    });
    
    // Check headers
    const headers = wrapper.findAll('th');
    expect(headers.length).toBe(3);
    expect(headers[0].text()).toBe('ID');
    expect(headers[1].text()).toBe('Name');
    expect(headers[2].text()).toBe('Email');
    
    // Check rows
    const rows = wrapper.findAll('tbody tr');
    expect(rows.length).toBe(3);
    
    // Check first row cells
    const firstRowCells = rows[0].findAll('td');
    expect(firstRowCells[0].text()).toBe('1');
    expect(firstRowCells[1].text()).toBe('John Doe');
    expect(firstRowCells[2].text()).toBe('john@example.com');
  });
  it('handles sorting', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: testColumns,
        items: testItems,
        sortable: true
      }
    });
    
    // Click on Name header to sort - first click sorts alphabetically ascending
    await wrapper.findAll('th .sort-button')[1].trigger('click');
    let rows = wrapper.findAll('tbody tr');
    expect(rows[0].findAll('td')[1].text()).toBe('Bob Johnson'); // First in alphabetical order
    
    // Click again to reverse sort - second click sorts descending
    await wrapper.findAll('th .sort-button')[1].trigger('click');
    rows = wrapper.findAll('tbody tr');
    expect(rows[0].findAll('td')[1].text()).toBe('John Doe'); // First in reverse alphabetical order
  });

  it('emits row-click event', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns: testColumns,
        items: testItems
      }
    });
    
    // Click on first row
    await wrapper.find('tbody tr').trigger('click');
    
    // Check emitted event
    expect(wrapper.emitted('row-click')).toBeTruthy();
    expect(wrapper.emitted('row-click')[0][0]).toEqual(testItems[0]);
  });
});
