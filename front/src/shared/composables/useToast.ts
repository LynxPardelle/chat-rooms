/**
 * Composable for managing toast notifications
 */
import { ref, reactive } from 'vue';
import type { ToastOptions } from '../types';
import { generateUniqueId } from '../utils/accessibility';

export function useToast() {
  const toasts = reactive<Map<string, ToastOptions>>(new Map());
  const defaultTimeout = ref(5000);
  
  /**
   * Show a toast notification
   * @param options Toast configuration options
   * @returns Toast ID
   */
  const showToast = (options: ToastOptions): string => {
    // Generate ID if not provided
    const id = options.id || generateUniqueId();
    
    // Set default options
    const toast: ToastOptions = {
      ...options,
      id,
      timeout: options.timeout ?? defaultTimeout.value,
      variant: options.variant || 'info',
      closable: options.closable !== false,
      position: options.position || 'top-right'
    };
    
    // Add toast to collection
    toasts.set(id, toast);
    
    // Set timeout to remove toast if needed
    if (toast.timeout && toast.timeout > 0) {
      setTimeout(() => {
        closeToast(id);
      }, toast.timeout);
    }
    
    return id;
  };
  
  /**
   * Close a specific toast by ID
   * @param id Toast ID
   */
  const closeToast = (id: string): void => {
    toasts.delete(id);
  };
  
  /**
   * Clear all active toasts
   */
  const clearToasts = (): void => {
    toasts.clear();
  };
  
  /**
   * Show a success toast
   * @param message Toast message
   * @param title Optional title
   * @returns Toast ID
   */
  const success = (message: string, title?: string): string => {
    return showToast({
      title,
      message,
      variant: 'success'
    });
  };
  
  /**
   * Show an error toast
   * @param message Toast message
   * @param title Optional title
   * @returns Toast ID
   */
  const error = (message: string, title?: string): string => {
    return showToast({
      title,
      message,
      variant: 'danger'
    });
  };
  
  /**
   * Show a warning toast
   * @param message Toast message
   * @param title Optional title
   * @returns Toast ID
   */
  const warning = (message: string, title?: string): string => {
    return showToast({
      title,
      message,
      variant: 'warning'
    });
  };
  
  /**
   * Show an info toast
   * @param message Toast message
   * @param title Optional title
   * @returns Toast ID
   */
  const info = (message: string, title?: string): string => {
    return showToast({
      title,
      message,
      variant: 'info'
    });
  };
  
  return {
    toasts,
    showToast,
    closeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
    defaultTimeout
  };
}
