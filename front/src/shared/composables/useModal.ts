/**
 * Composable for managing modal dialogs
 */
import { reactive } from 'vue';
import type { ModalOptions } from '../types';
import { generateUniqueId } from '../utils/accessibility';

export function useModal() {
  const modals = reactive<Map<string, ModalOptions & { isVisible: boolean }>>(new Map());
  
  /**
   * Open a modal dialog
   * @param options Modal configuration
   * @returns Modal ID
   */
  const openModal = (options: ModalOptions): string => {
    // Generate ID if not provided
    const id = options.id || generateUniqueId();
    
    // Configure modal options
    const modal = {
      ...options,
      id,
      isVisible: true,
      closable: options.closable !== false,
      size: options.size || 'md',
      persistent: !!options.persistent
    };
    
    // Add to collection
    modals.set(id, modal);
    
    return id;
  };
  
  /**
   * Close a specific modal by ID
   * @param id Modal ID
   */
  const closeModal = (id: string): void => {
    modals.delete(id);
  };
  
  /**
   * Close all open modals
   */
  const closeAllModals = (): void => {
    modals.clear();
  };
  
  /**
   * Check if a specific modal is open
   * @param id Modal ID
   * @returns True if modal is open
   */
  const isModalOpen = (id: string): boolean => {
    return modals.has(id) && modals.get(id)?.isVisible === true;
  };
  
  /**
   * Update a modal's options
   * @param id Modal ID
   * @param options New options to apply
   */
  const updateModal = (id: string, options: Partial<ModalOptions>): void => {
    const modal = modals.get(id);
    if (modal) {
      Object.assign(modal, options);
    }
  };
  
  return {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    isModalOpen,
    updateModal
  };
}
