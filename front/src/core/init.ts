// import { useAuthStore } from '../stores/auth';
import { AuthService } from '@/core/services/auth.service';

/**
 * Initialize the application services and state
 */
export async function initializeApp() {
  try {
    // Initialize services
    AuthService.getInstance();    // Initialize auth store
    // const authStore = useAuthStore();
    // Note: initialize method will be available when full auth store is restored
    // await authStore.initialize();
    
    console.log('Application initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
}
