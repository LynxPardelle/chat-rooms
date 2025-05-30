/**
 * Composable for handling theme management
 */
import { ref, computed, onMounted, watch } from 'vue';
import type { ThemeConfig } from '../types';

// Default theme configuration
const defaultTheme: ThemeConfig = {
  primaryColor: 'var(--primary-color)',
  secondaryColor: 'var(--secondary-color)',
  backgroundColor: 'var(--light-bg)',
  textColor: 'var(--text-primary)',
  errorColor: 'var(--danger-color)',
  warningColor: 'var(--warning-color)',
  successColor: 'var(--success-color)',
  infoColor: 'var(--info-color)',
  borderRadius: 'var(--border-radius-md)',
  fontFamily: 'var(--font-family-base)',
  boxShadow: 'var(--shadow-md)',
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)'
  }
};

// Available theme modes
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Composable for theme management
 * @returns Theme management utilities
 */
export function useTheme() {
  const currentTheme = ref<ThemeConfig>({ ...defaultTheme });
  const themeMode = ref<ThemeMode>('system');
  const isDarkMode = ref(false);
  
  // Check system preference
  const prefersDarkMode = () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };
  
  // Apply dark mode to document
  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    isDarkMode.value = isDark;
  };
  
  // Update theme mode based on user preference or system
  const updateThemeMode = () => {
    switch (themeMode.value) {
      case 'light':
        applyDarkMode(false);
        break;
      case 'dark':
        applyDarkMode(true);
        break;
      case 'system':
      default:
        applyDarkMode(prefersDarkMode());
        break;
    }
    
    // Save to localStorage
    localStorage.setItem('themeMode', themeMode.value);
  };
  
  // Set theme mode
  const setThemeMode = (mode: ThemeMode) => {
    themeMode.value = mode;
    updateThemeMode();
  };
  
  // Apply theme configuration
  const applyTheme = (theme: Partial<ThemeConfig>) => {
    currentTheme.value = { ...currentTheme.value, ...theme };
    
    // Save to localStorage
    localStorage.setItem('themeConfig', JSON.stringify(currentTheme.value));
  };
  
  // Reset to default theme
  const resetTheme = () => {
    currentTheme.value = { ...defaultTheme };
    localStorage.removeItem('themeConfig');
  };
  
  // CSS variables computed from theme config
  const cssVariables = computed(() => {
    const variables: Record<string, string> = {};
    
    // Add all theme properties as CSS variables
    Object.entries(currentTheme.value).forEach(([key, value]) => {
      if (typeof value === 'string') {
        variables[`--theme-${key}`] = value;
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          variables[`--theme-${key}-${nestedKey}`] = nestedValue as string;
        });
      }
    });
    
    return variables;
  });
  
  // Watch for system preference changes
  onMounted(() => {
    // Load saved theme mode
    const savedThemeMode = localStorage.getItem('themeMode');
    if (savedThemeMode) {
      themeMode.value = savedThemeMode as ThemeMode;
    }
    
    // Load saved theme config
    const savedThemeConfig = localStorage.getItem('themeConfig');
    if (savedThemeConfig) {
      try {
        const parsedTheme = JSON.parse(savedThemeConfig);
        currentTheme.value = { ...defaultTheme, ...parsedTheme };
      } catch (error) {
        console.error('Failed to parse saved theme:', error);
      }
    }
    
    // Apply initial theme
    updateThemeMode();
    
    // Watch for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeMode.value === 'system') {
        applyDarkMode(prefersDarkMode());
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
  });
  
  // Watch for theme mode changes
  watch(themeMode, updateThemeMode);
  
  return {
    currentTheme,
    themeMode,
    isDarkMode,
    cssVariables,
    setThemeMode,
    applyTheme,
    resetTheme
  };
}
