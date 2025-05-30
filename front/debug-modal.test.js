import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import BaseModal from './src/shared/components/BaseModal.vue';

describe('Debug BaseModal', () => {
  it('should debug modal rendering', async () => {
    console.log('=== Starting debug test ===');
    
    const wrapper = mount(BaseModal, {
      props: {
        show: true,
        title: 'Debug Modal'
        // explicitly NOT passing modelValue
      },
      slots: {
        default: 'Debug content'
      },
      attachTo: document.body
    });

    console.log('=== After mounting ===');
    console.log('Props passed:', wrapper.props());
    console.log('wrapper.html():', wrapper.html());
    console.log('document.body.innerHTML:', document.body.innerHTML);
    
    await wrapper.vm.$nextTick();
    
    console.log('=== After nextTick ===');
    console.log('wrapper.html():', wrapper.html());
    console.log('document.body.innerHTML:', document.body.innerHTML);
    
    const modal = wrapper.find('.modal-container');
    console.log('modal.exists():', modal.exists());
    
    const modalInBody = document.querySelector('.modal-container');
    console.log('modalInBody:', modalInBody);
    
    expect(true).toBe(true); // Just to pass the test
  });
});
