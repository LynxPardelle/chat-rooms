import type { NavigationGuard, RouteLocationNormalized } from 'vue-router';
import authService from '@/core/services/auth.service';
import { errorService } from '@/core/services/error.service';

/**
 * Authentication guard that checks if user is authenticated
 * before accessing protected routes
 */
export const authGuard: NavigationGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next
) => {
  
  try {
    // Check if route requires authentication
    if (!to.meta.requiresAuth) {
      return next();
    }
    
    // Check if user is already authenticated
    if (authService.isAuthenticated) {
      return next();
    }
    
    // Try to refresh token if available
    if (authService.accessToken) {
      try {
        await authService.refreshTokens();
        if (authService.isAuthenticated) {
          return next();
        }
      } catch (refreshError) {
        console.warn('Token refresh failed during navigation:', refreshError);
        // Continue to redirect to login
      }
    }
    
    // User is not authenticated, redirect to login
    return next({
      name: 'Login',
      query: {
        redirect: to.fullPath,
        reason: 'authentication_required'
      }
    });
    
  } catch (error) {    errorService.handleError(error);
    
    return next({
      name: 'Login',
      query: {
        redirect: to.fullPath,
        reason: 'auth_error'
      }
    });
  }
};

/**
 * Guest guard that prevents authenticated users from accessing
 * guest-only routes (like login page)
 */
export const guestGuard: NavigationGuard = async (
  to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next
) => {
  
  try {
    // Check if route is guest-only
    if (!to.meta.guest) {
      return next();
    }    // If user is authenticated, redirect to home
    if (authService.isAuthenticated) {
      const redirectQuery = to.query.redirect;
      const redirectTo = typeof redirectQuery === 'string' ? redirectQuery : '/';
      return next(redirectTo);
    }
    
    // User is not authenticated, allow access to guest route
    return next();
    
  } catch (error) {
    // On error, allow access to guest route
    console.warn('Guest guard error:', error);
    return next();
  }
};

/**
 * Role-based authorization guard
 * Can be extended for different user roles/permissions
 */
export const roleGuard = (requiredRoles: string[]): NavigationGuard => {
  return async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next) => {
    
    try {
      // First check authentication
      if (!authService.isAuthenticated) {
        return next({
          name: 'Login',
          query: {
            redirect: to.fullPath,
            reason: 'authentication_required'
          }
        });
      }
      
      const user = authService.currentUser;
      if (!user) {
        return next({ name: 'Login' });
      }
      
      // Check if user has required roles
      // For now, we'll assume all authenticated users have access
      // This can be extended when role system is implemented
      const userRoles = (user as any).roles || ['user'];
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        return next({
          name: 'Forbidden',
          query: {
            reason: 'insufficient_permissions',
            required: requiredRoles.join(',')
          }
        });
      }
      
      return next();
      
    } catch (error) {      errorService.handleError(error);
      
      return next({ name: 'Login' });
    }
  };
};

/**
 * Loading guard that shows loading state during authentication checks
 */
export const loadingGuard: NavigationGuard = async (
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next
) => {
  
  // If auth service is loading, wait for it to complete
  if (authService.isLoading) {
    // Wait for auth state to stabilize
    await new Promise<void>((resolve) => {
      const unsubscribe = authService.onAuthStateChange((state) => {
        if (!state.loading) {
          unsubscribe();
          resolve();
        }
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        unsubscribe();
        resolve();
      }, 5000);
    });
  }
  
  return next();
};
