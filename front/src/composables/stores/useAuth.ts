/**
 * Auth Store Composable
 * Provides reactive auth state and actions with TypeScript support
 */

import { computed, readonly } from 'vue';
import { useAuthStore } from '../../stores/auth';

export function useAuth() {
  const authStore = useAuthStore();
  
  // Reactive state (minimal version)
  const user = computed(() => authStore.user);
  const isAuthenticated = computed(() => authStore.isAuthenticated);

  // Return minimal interface
  return {
    // State
    user: readonly(user),
    isAuthenticated: readonly(isAuthenticated),

    // Actions (placeholder - will be implemented when full store is restored)
    login: async () => { throw new Error('Login not implemented in minimal auth store'); },
    logout: async () => { throw new Error('Logout not implemented in minimal auth store'); },
    
    // Computed helpers
    isLoggedIn: computed(() => authStore.isAuthenticated),
    currentUser: computed(() => authStore.user)
  };
}
