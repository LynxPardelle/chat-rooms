import { defineStore } from 'pinia';
import { ref, readonly } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const isAuthenticated = ref(false);

  return {
    user: readonly(user),
    isAuthenticated: readonly(isAuthenticated)
  };
});
