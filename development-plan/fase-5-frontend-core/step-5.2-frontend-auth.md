# Step 5.2: Frontend Authentication System

## Overview
Implement comprehensive frontend authentication system with JWT token management, route protection, and user state management.

## Implementation Details

### 1. Authentication Store (Zustand)

```typescript
// src/stores/authStore.ts
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.auth.login(credentials);
      const { user, token, refreshToken } = response;
      
      // Store tokens securely
      storageService.setItem('auth_token', token);
      storageService.setItem('refresh_token', refreshToken, { ttl: 7 * 24 * 60 * 60 * 1000 });
      
      set({ 
        user, 
        token, 
        refreshToken, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error.message, 
        isLoading: false,
        isAuthenticated: false 
      });
      throw error;
    }
  },

  logout: () => {
    storageService.removeItem('auth_token');
    storageService.removeItem('refresh_token');
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null
    });
  },

  refreshAuth: async () => {
    const refreshToken = get().refreshToken;
    if (!refreshToken) {
      get().logout();
      return;
    }

    try {
      const response = await apiService.auth.refresh(refreshToken);
      const { token: newToken } = response;
      
      storageService.setItem('auth_token', newToken);
      set({ token: newToken });
    } catch (error) {
      get().logout();
      throw error;
    }
  }
}));
```

### 2. Authentication Hook

```typescript
// src/hooks/useAuth.ts
export const useAuth = () => {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    refreshAuth,
    updateProfile,
    clearError
  } = useAuthStore();

  const loginWithCredentials = useCallback(async (credentials: LoginCredentials) => {
    await login(credentials);
  }, [login]);

  const loginWithProvider = useCallback(async (provider: 'google' | 'github') => {
    const response = await apiService.auth.loginWithProvider(provider);
    window.location.href = response.authUrl;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return await apiService.auth.register(data);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    return await apiService.auth.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    return await apiService.auth.resetPassword(token, password);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    return await apiService.auth.changePassword(currentPassword, newPassword);
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    return await apiService.auth.verifyEmail(token);
  }, []);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    actions: {
      login: loginWithCredentials,
      loginWithProvider,
      logout,
      register,
      forgotPassword,
      resetPassword,
      changePassword,
      verifyEmail,
      refreshAuth,
      updateProfile,
      clearError
    }
  };
};
```

### 3. Protected Route Component

```typescript
// src/components/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  fallback = <div>Access denied</div>,
  redirectTo = '/login'
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(redirectTo);
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.some(role => 
      user.roles.includes(role)
    );
    if (!hasRequiredRole) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};
```

### 4. Authentication Forms

```typescript
// src/components/auth/LoginForm.tsx
export const LoginForm: React.FC = () => {
  const { actions, isLoading, error } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await actions.login(data);
      navigate('/chat');
    } catch (error) {
      // Error handling is managed by the store
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Input
          {...register('email')}
          type="email"
          placeholder="Email"
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Input
          {...register('password')}
          type="password"
          placeholder="Password"
          disabled={isLoading}
        />
        {errors.password && (
          <p className="text-red-500 text-sm">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Signing in...' : 'Sign In'}
      </Button>

      <div className="flex space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.loginWithProvider('google')}
          className="flex-1"
        >
          <FaGoogle className="mr-2" />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.loginWithProvider('github')}
          className="flex-1"
        >
          <FaGithub className="mr-2" />
          GitHub
        </Button>
      </div>
    </form>
  );
};
```

### 5. Auth Context Provider

```typescript
// src/providers/AuthProvider.tsx
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { refreshAuth } = useAuth();

  useEffect(() => {
    const initAuth = async () => {
      const token = storageService.getItem('auth_token');
      if (token) {
        try {
          await refreshAuth();
        } catch (error) {
          console.error('Failed to refresh auth:', error);
        }
      }
    };

    initAuth();
  }, [refreshAuth]);

  // Setup token refresh interval
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshAuth();
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }, 15 * 60 * 1000); // Refresh every 15 minutes

    return () => clearInterval(interval);
  }, [refreshAuth]);

  return <>{children}</>;
};
```

### 6. Validation Schemas

```typescript
// src/schemas/authSchemas.ts
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional()
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-z])/, 'Password must contain at least one lowercase letter')
    .regex(/(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
    .regex(/(?=.*\d)/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});
```

## Security Features

### 1. Token Management
- Secure storage with encryption
- Automatic token refresh
- Token expiration handling
- Logout on token errors

### 2. Route Protection
- Role-based access control
- Automatic redirects
- Loading states
- Fallback components

### 3. Error Handling
- User-friendly error messages
- Automatic error clearing
- Retry mechanisms
- Security error logging

## Integration Points
- API service for authentication endpoints
- Storage service for secure token storage
- WebSocket service for real-time auth status
- Router for navigation and protection

## Testing Strategy
- Unit tests for auth store
- Integration tests for auth flows
- E2E tests for complete auth journey
- Security testing for token management

## Performance Considerations
- Lazy loading of auth forms
- Efficient re-renders with Zustand
- Token refresh optimization
- Memory leak prevention

## Next Steps
- Step 5.3: Routing and state management
- Integration with messaging system
- Real-time authentication status
- Advanced security features
