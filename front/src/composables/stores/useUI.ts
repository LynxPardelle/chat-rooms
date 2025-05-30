/**
 * UI Store Composable
 * Provides reactive UI state and actions with TypeScript support
 */

import { computed, readonly } from 'vue';
import { useUIStore } from '../../stores/ui';

export function useUI() {
  const uiStore = useUIStore();
  
  // Reactive state
  const theme = computed(() => uiStore.theme);
  const isLoading = computed(() => uiStore.isLoading);
  const notifications = computed(() => uiStore.notifications);
  
  // Actions
  const showError = (message: string, options?: any) => {
    uiStore.showError(message, options);
  };

  const showSuccess = (message: string, options?: any) => {
    uiStore.showSuccess(message, options);
  };

  const showWarning = (message: string, options?: any) => {
    uiStore.showWarning(message, options);
  };

  const showInfo = (message: string, options?: any) => {
    uiStore.showInfo(message, options);
  };

  const updateTheme = (themeUpdates: any) => {
    uiStore.updateTheme(themeUpdates);
  };

  const toggleDarkMode = () => {
    uiStore.toggleDarkMode();
  };

  const startLoading = (key: string, message?: string) => {
    uiStore.startLoading(key, message);
  };

  const stopLoading = (key: string) => {
    uiStore.stopLoading(key);
  };

  // Computed helpers
  const isDarkMode = computed(() => uiStore.isDarkMode);
  const hasNotifications = computed(() => uiStore.notifications.length > 0);

  return {
    // State
    theme: readonly(theme),
    isLoading: readonly(isLoading),
    notifications: readonly(notifications),

    // Actions
    showError,
    showSuccess, 
    showWarning,
    showInfo,
    updateTheme,
    toggleDarkMode,
    startLoading,
    stopLoading,

    // Computed helpers
    isDarkMode: readonly(isDarkMode),
    hasNotifications: readonly(hasNotifications)
  };
}
