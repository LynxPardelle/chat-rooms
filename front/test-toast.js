import { mount } from '@vue/test-utils';
import ToastNotification from './src/shared/components/ToastNotification.vue';

// Simple test to debug ToastNotification
const wrapper = mount(ToastNotification, {
  props: {
    message: 'Test message',
    type: 'success',
    show: true
  }
});

console.log('Component HTML:', wrapper.html());
console.log('Component classes:', wrapper.classes());
console.log('Toast element exists:', wrapper.find('.toast').exists());
