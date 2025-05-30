import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';

// ================================
// UI STORE TYPES
// ================================

interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // ms, 0 = permanent
  action?: {
    label: string;
    callback: () => void;
  };
  timestamp: Date;
}

interface ModalConfig {
  id: string;
  component: string;
  props?: Record<string, any>;
  persistent?: boolean; // Can't be closed by clicking outside
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
}

interface LoadingState {
  id: string;
  message?: string;
  progress?: number; // 0-100
  cancellable?: boolean;
  onCancel?: () => void;
}

interface ThemeConfig {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  accentColor: string;
  fontFamily: 'inter' | 'roboto' | 'system';
  fontSize: 'sm' | 'md' | 'lg';
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  animations: boolean;
}

interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    callback: () => void;
  };
}

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

// ================================
// UI STORE IMPLEMENTATION
// ================================

/**
 * Enterprise-grade UI Store for global UI state management
 * Features: Notifications, modals, themes, loading states, responsive design
 */
export const useUIStore = defineStore('ui', () => {
  // ================================
  // STATE
  // ================================
  
  // Notifications & Toasts
  const notifications = ref<NotificationItem[]>([]);
  const maxNotifications = 5;
  
  // Modals
  const modals = ref<ModalConfig[]>([]);
  const modalHistory = ref<string[]>([]); // For back navigation
  
  // Loading states
  const loadingStates = ref(new Map<string, LoadingState>());
  const globalLoading = ref(false);
  
  // Theme and appearance
  const theme = ref<ThemeConfig>({
    mode: 'auto',
    primaryColor: '#007bff',
    accentColor: '#28a745',
    fontFamily: 'inter',
    fontSize: 'md',
    borderRadius: 'md',
    animations: true
  });
  
  // Layout and responsive
  const isMobile = ref(false);
  const isTablet = ref(false);
  const isDesktop = ref(true);
  const screenWidth = ref(1920);
  const screenHeight = ref(1080);
  const sidebarCollapsed = ref(false);
  
  // Navigation and focus
  const currentRoute = ref('');
  const breadcrumbs = ref<Array<{ label: string; path?: string }>>([]);
  const pageTitle = ref('Chat Rooms');
  const focusTrap = ref<string | null>(null); // For accessibility
  
  // UI feedback
  const isOnline = ref(true);
  const lastActivity = ref<Date>(new Date());
  const idleTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
  const isIdle = ref(false);
  
  // Error boundary
  const globalError = ref<Error | null>(null);
  const errorBoundaryKey = ref(0);

  // ================================
  // GETTERS
  // ================================
  
  const visibleNotifications = computed(() => 
    notifications.value.slice(0, maxNotifications)
  );
  
  const currentModal = computed(() => 
    modals.value[modals.value.length - 1] || null
  );
  
  const hasModals = computed(() => modals.value.length > 0);
  
  const isLoading = computed(() => 
    globalLoading.value || loadingStates.value.size > 0
  );
  
  const activeLoadingStates = computed(() => 
    Array.from(loadingStates.value.values())
  );
  
  const isDarkMode = computed(() => {
    if (theme.value.mode === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme.value.mode === 'dark';
  });
  
  const deviceType = computed(() => {
    if (isMobile.value) return 'mobile';
    if (isTablet.value) return 'tablet';
    return 'desktop';
  });
  
  const cssVariables = computed(() => ({
    '--primary-color': theme.value.primaryColor,
    '--accent-color': theme.value.accentColor,
    '--font-family': theme.value.fontFamily,
    '--font-size': `${theme.value.fontSize === 'sm' ? 14 : theme.value.fontSize === 'lg' ? 18 : 16}px`,
    '--border-radius': `${theme.value.borderRadius === 'none' ? 0 : theme.value.borderRadius === 'sm' ? 4 : theme.value.borderRadius === 'lg' ? 12 : 8}px`
  }));

  // ================================
  // NOTIFICATION ACTIONS
  // ================================
  
  /**
   * Show a notification
   */
  function showNotification(
    title: string, 
    message?: string, 
    options: ToastOptions = {}
  ): string {
    const id = `notification_${Date.now()}_${Math.random()}`;
    const notification: NotificationItem = {
      id,
      type: options.type || 'info',
      title,
      message,
      duration: options.duration ?? 5000,
      action: options.action,
      timestamp: new Date()
    };
    
    notifications.value.push(notification);
    
    // Remove old notifications if exceeding max
    if (notifications.value.length > maxNotifications * 2) {
      notifications.value = notifications.value.slice(-maxNotifications);
    }
    
    // Auto-remove notification
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }
    
    return id;
  }
  
  /**
   * Show success notification
   */
  function showSuccess(title: string, message?: string, duration = 3000): string {
    return showNotification(title, message, { type: 'success', duration });
  }
  
  /**
   * Show error notification
   */
  function showError(title: string, message?: string, duration = 0): string {
    return showNotification(title, message, { type: 'error', duration });
  }
  
  /**
   * Show warning notification
   */
  function showWarning(title: string, message?: string, duration = 5000): string {
    return showNotification(title, message, { type: 'warning', duration });
  }
  
  /**
   * Show info notification
   */
  function showInfo(title: string, message?: string, duration = 5000): string {
    return showNotification(title, message, { type: 'info', duration });
  }
  
  /**
   * Remove a specific notification
   */
  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }
  
  /**
   * Clear all notifications
   */
  function clearNotifications() {
    notifications.value = [];
  }

  // ================================
  // MODAL ACTIONS
  // ================================
  
  /**
   * Open a modal
   */
  function openModal(config: Omit<ModalConfig, 'id'>): string {
    const id = `modal_${Date.now()}_${Math.random()}`;
    const modal: ModalConfig = {
      id,
      persistent: false,
      size: 'md',
      closable: true,
      ...config
    };
    
    modals.value.push(modal);
    modalHistory.value.push(id);
    
    // Trap focus for accessibility
    if (focusTrap.value === null) {
      focusTrap.value = id;
    }
    
    return id;
  }
  
  /**
   * Close a specific modal
   */
  function closeModal(id: string) {
    const index = modals.value.findIndex(m => m.id === id);
    if (index > -1) {
      modals.value.splice(index, 1);
      
      // Remove from history
      const historyIndex = modalHistory.value.indexOf(id);
      if (historyIndex > -1) {
        modalHistory.value.splice(historyIndex, 1);
      }
      
      // Update focus trap
      if (focusTrap.value === id) {
        focusTrap.value = modalHistory.value[modalHistory.value.length - 1] || null;
      }
    }
  }
  
  /**
   * Close the top modal
   */
  function closeTopModal() {
    if (currentModal.value && currentModal.value.closable !== false) {
      closeModal(currentModal.value.id);
    }
  }
  
  /**
   * Close all modals
   */
  function closeAllModals() {
    modals.value = [];
    modalHistory.value = [];
    focusTrap.value = null;
  }
  
  /**
   * Show confirmation dialog
   */
  function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const modalId = openModal({
        component: 'ConfirmDialog',
        props: {
          ...options,
          onConfirm: async () => {
            try {
              await options.onConfirm();
              closeModal(modalId);
              resolve(true);
            } catch (err) {
              console.error('Confirmation action failed:', err);
              showError('Action Failed', err instanceof Error ? err.message : 'Unknown error');
              resolve(false);
            }
          },
          onCancel: () => {
            options.onCancel?.();
            closeModal(modalId);
            resolve(false);
          }
        },
        persistent: true,
        size: 'sm'
      });
    });
  }

  // ================================
  // LOADING ACTIONS
  // ================================
  
  /**
   * Start a loading state
   */
  function startLoading(
    id: string, 
    message?: string, 
    options?: { 
      progress?: number;
      cancellable?: boolean;
      onCancel?: () => void;
    }
  ) {
    const loadingState: LoadingState = {
      id,
      message,
      progress: options?.progress,
      cancellable: options?.cancellable,
      onCancel: options?.onCancel
    };
    
    loadingStates.value.set(id, loadingState);
  }
  
  /**
   * Update loading progress
   */
  function updateLoadingProgress(id: string, progress: number, message?: string) {
    const state = loadingStates.value.get(id);
    if (state) {
      state.progress = progress;
      if (message) state.message = message;
    }
  }
  
  /**
   * Stop a loading state
   */
  function stopLoading(id: string) {
    loadingStates.value.delete(id);
  }
  
  /**
   * Stop all loading states
   */
  function stopAllLoading() {
    loadingStates.value.clear();
    globalLoading.value = false;
  }
  
  /**
   * Set global loading state
   */
  function setGlobalLoading(loading: boolean, message?: string) {
    globalLoading.value = loading;
    if (loading && message) {
      startLoading('global', message);
    } else if (!loading) {
      stopLoading('global');
    }
  }

  // ================================
  // THEME ACTIONS
  // ================================
  
  /**
   * Update theme configuration
   */
  function updateTheme(updates: Partial<ThemeConfig>) {
    theme.value = { ...theme.value, ...updates };
    
    // Apply theme to document
    applyThemeToDocument();
    
    // Persist theme
    localStorage.setItem('ui-theme', JSON.stringify(theme.value));
  }
  
  /**
   * Toggle dark mode
   */
  function toggleDarkMode() {
    const newMode = isDarkMode.value ? 'light' : 'dark';
    updateTheme({ mode: newMode });
  }
  
  /**
   * Apply theme to document
   */
  function applyThemeToDocument() {
    const root = document.documentElement;
    
    // Apply CSS variables
    Object.entries(cssVariables.value).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Apply dark mode class
    if (isDarkMode.value) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    
    // Apply animations preference
    if (!theme.value.animations) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }
  }
  
  /**
   * Reset theme to defaults
   */
  function resetTheme() {
    theme.value = {
      mode: 'auto',
      primaryColor: '#007bff',
      accentColor: '#28a745',
      fontFamily: 'inter',
      fontSize: 'md',
      borderRadius: 'md',
      animations: true
    };
    applyThemeToDocument();
    localStorage.removeItem('ui-theme');
  }

  // ================================
  // LAYOUT ACTIONS
  // ================================
  
  /**
   * Update screen dimensions
   */
  function updateScreenSize(width: number, height: number) {
    screenWidth.value = width;
    screenHeight.value = height;
    
    // Update device type
    isMobile.value = width < 768;
    isTablet.value = width >= 768 && width < 1024;
    isDesktop.value = width >= 1024;
  }
  
  /**
   * Toggle sidebar
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
  
  /**
   * Set sidebar state
   */
  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed;
  }
  
  /**
   * Update page title
   */
  function setPageTitle(title: string) {
    pageTitle.value = title;
    document.title = `${title} - Chat Rooms`;
  }
  
  /**
   * Update breadcrumbs
   */
  function setBreadcrumbs(crumbs: Array<{ label: string; path?: string }>) {
    breadcrumbs.value = crumbs;
  }

  // ================================
  // UTILITY ACTIONS
  // ================================
  
  /**
   * Track user activity
   */
  function trackActivity() {
    lastActivity.value = new Date();
    
    if (isIdle.value) {
      isIdle.value = false;
      showInfo('Welcome back!', 'You are no longer idle');
    }
    
    // Reset idle timeout
    if (idleTimeout.value) {
      clearTimeout(idleTimeout.value);
    }
    
    idleTimeout.value = setTimeout(() => {
      isIdle.value = true;
      showWarning('You appear to be idle', 'Your session may be affected');
    }, 15 * 60 * 1000); // 15 minutes
  }
  
  /**
   * Set online status
   */
  function setOnlineStatus(online: boolean) {
    if (isOnline.value !== online) {
      isOnline.value = online;
      if (online) {
        showSuccess('Connection restored', 'You are back online');
      } else {
        showWarning('Connection lost', 'You are now offline');
      }
    }
  }
  
  /**
   * Handle global error
   */
  function handleGlobalError(error: Error) {
    globalError.value = error;
    errorBoundaryKey.value++;
    
    console.error('Global error:', error);
    showError('Application Error', 'Something went wrong. Please refresh the page.');
  }
  
  /**
   * Clear global error
   */
  function clearGlobalError() {
    globalError.value = null;
  }
  
  /**
   * Initialize UI store
   */
  function initialize() {
    // Load persisted theme
    const savedTheme = localStorage.getItem('ui-theme');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        theme.value = { ...theme.value, ...parsedTheme };
      } catch (err) {
        console.warn('Failed to load saved theme:', err);
      }
    }
    
    // Apply initial theme
    applyThemeToDocument();
    
    // Setup responsive listeners
    const updateSize = () => {
      updateScreenSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    
    // Setup online/offline listeners
    window.addEventListener('online', () => setOnlineStatus(true));
    window.addEventListener('offline', () => setOnlineStatus(false));
    setOnlineStatus(navigator.onLine);
    
    // Setup activity tracking
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });
    trackActivity();
    
    // Setup dark mode listener
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeQuery.addEventListener('change', () => {
      if (theme.value.mode === 'auto') {
        applyThemeToDocument();
      }
    });
  }
  
  /**
   * Cleanup UI store
   */
  function cleanup() {
    clearNotifications();
    closeAllModals();
    stopAllLoading();
    clearGlobalError();
    
    if (idleTimeout.value) {
      clearTimeout(idleTimeout.value);
      idleTimeout.value = null;
    }
  }

  return {
    // State (readonly)
    notifications: readonly(notifications),
    modals: readonly(modals),
    loadingStates: readonly(loadingStates),
    globalLoading: readonly(globalLoading),
    theme: readonly(theme),
    isMobile: readonly(isMobile),
    isTablet: readonly(isTablet),
    isDesktop: readonly(isDesktop),
    screenWidth: readonly(screenWidth),
    screenHeight: readonly(screenHeight),
    sidebarCollapsed: readonly(sidebarCollapsed),
    currentRoute: readonly(currentRoute),
    breadcrumbs: readonly(breadcrumbs),
    pageTitle: readonly(pageTitle),
    isOnline: readonly(isOnline),
    isIdle: readonly(isIdle),
    globalError: readonly(globalError),
    
    // Getters
    visibleNotifications,
    currentModal,
    hasModals,
    isLoading,
    activeLoadingStates,
    isDarkMode,
    deviceType,
    cssVariables,
    
    // Notification actions
    showNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification,
    clearNotifications,
    
    // Modal actions
    openModal,
    closeModal,
    closeTopModal,
    closeAllModals,
    showConfirmDialog,
    
    // Loading actions
    startLoading,
    updateLoadingProgress,
    stopLoading,
    stopAllLoading,
    setGlobalLoading,
    
    // Theme actions
    updateTheme,
    toggleDarkMode,
    resetTheme,
    
    // Layout actions
    updateScreenSize,
    toggleSidebar,
    setSidebarCollapsed,
    setPageTitle,
    setBreadcrumbs,
    
    // Utility actions
    trackActivity,
    setOnlineStatus,
    handleGlobalError,
    clearGlobalError,
    initialize,
    cleanup
  };
});
