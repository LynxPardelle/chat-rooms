/**
 * Authentication Module Types
 * Tipos específicos para el módulo de autenticación frontend
 */

import type { 
  LoginRequest, 
  RegisterRequest, 
  UserResponse
} from '@/core/types/enhanced-api.types';

// =====================================
// Form State Types
// =====================================

export interface AuthFormState<T = Record<string, any>> {
  data: T;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  errors: AuthFormErrors;
  touched: Record<keyof T, boolean>;
}

export interface AuthFormErrors {
  [field: string]: string | string[] | null;
}

export interface AuthUIState {
  loading: boolean;
  success: boolean;
  error: string | null;
  validating: boolean;
}

// =====================================
// Form Data Types
// =====================================

export interface LoginFormData extends LoginRequest {
  rememberMe?: boolean;
}

export interface RegisterFormData extends Omit<RegisterRequest, 'textColor' | 'backgroundColor'> {
  confirmPassword: string;
  acceptTerms: boolean;
  textColor: string;
  backgroundColor: string;
  showColorPreview?: boolean;
}

// =====================================
// Form Configuration Types
// =====================================

export interface AuthFormConfig {
  enableValidation: boolean;
  validationDelay: number;
  showPasswordStrength: boolean;
  allowRememberMe: boolean;
  enableColorPicker: boolean;
  requireTermsAcceptance: boolean;
}

export interface AuthFormFieldConfig {
  type: 'text' | 'email' | 'password' | 'color' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  autocomplete?: string;
  icon?: string;
  showToggle?: boolean; // For password visibility
  minLength?: number;
  maxLength?: number;
}

// =====================================
// Validation Types
// =====================================

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | null;
  message?: string;
}

export interface PasswordStrengthResult {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export interface UsernameValidationResult {
  isAvailable: boolean;
  isValid: boolean;
  message?: string | null;
}

// =====================================
// Auth Flow Types
// =====================================

export interface AuthFlowState {
  step: 'login' | 'register' | 'loading' | 'success' | 'error';
  canNavigateBack: boolean;
  redirectTo?: string;
  previousRoute?: string;
}

export interface AuthFlowConfig {
  autoRedirect: boolean;
  defaultRedirect: string;
  preventGuestAccess: boolean;
  persistRedirect: boolean;
}

// =====================================
// Response Types
// =====================================

export interface AuthModuleResponse<T = any> {
  success: boolean;
  data?: T;
  error?: AuthModuleError;
  message?: string;
}

export interface AuthModuleError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

// =====================================
// Event Types
// =====================================

export interface AuthFormEvent {
  type: 'submit' | 'validate' | 'reset' | 'change';
  field?: string;
  value?: any;
  errors?: AuthFormErrors;
}

export interface AuthModuleEvents {
  'auth:login-success': (user: UserResponse) => void;
  'auth:register-success': (user: UserResponse) => void;
  'auth:logout': () => void;
  'auth:error': (error: AuthModuleError) => void;
  'auth:validation-error': (field: string, error: string) => void;
}

// =====================================
// Component Props Types
// =====================================

export interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  backgroundImage?: string;
  variant?: 'card' | 'split' | 'fullscreen';
}

export interface AuthFormFieldProps {
  modelValue: any;
  config: AuthFormFieldConfig;
  error?: string | null;
  loading?: boolean;
  disabled?: boolean;
}

export interface LoginFormProps {
  config?: Partial<AuthFormConfig>;
  redirectTo?: string;
  showRegisterLink?: boolean;
}

export interface RegisterFormProps {
  config?: Partial<AuthFormConfig>;
  redirectTo?: string;
  showLoginLink?: boolean;
  enableColorCustomization?: boolean;
}

// =====================================
// Utility Types
// =====================================

export type AuthFormValidator<T> = (data: T) => AuthFormErrors;

export type AuthFormSubmitter<T, R = any> = (data: T) => Promise<AuthModuleResponse<R>>;

export type AuthFormFieldValidator = (value: any, config: AuthFormFieldConfig) => string | null;

// =====================================
// Constants
// =====================================

export const AUTH_FORM_DEFAULTS: AuthFormConfig = {
  enableValidation: true,
  validationDelay: 300,
  showPasswordStrength: true,
  allowRememberMe: true,
  enableColorPicker: true,
  requireTermsAcceptance: true,
};

export const AUTH_FLOW_DEFAULTS: AuthFlowConfig = {
  autoRedirect: true,
  defaultRedirect: '/',
  preventGuestAccess: false,
  persistRedirect: true,
};

export const PASSWORD_STRENGTH_COLORS = {
  weak: '#dc3545',
  fair: '#fd7e14',
  good: '#28a745',
  strong: '#007bff',
} as const;

export const AUTH_FIELD_CONFIGS: Record<string, AuthFormFieldConfig> = {
  email: {
    type: 'email',
    label: 'Email',
    placeholder: 'Ingresa tu email',
    required: true,
    autocomplete: 'email',
    icon: 'envelope',
  },
  password: {
    type: 'password',
    label: 'Contraseña',
    placeholder: 'Ingresa tu contraseña',
    required: true,
    autocomplete: 'current-password',
    icon: 'lock',
    showToggle: true,
    minLength: 8,
  },
  confirmPassword: {
    type: 'password',
    label: 'Confirmar Contraseña',
    placeholder: 'Confirma tu contraseña',
    required: true,
    autocomplete: 'new-password',
    icon: 'lock',
    showToggle: true,
  },
  username: {
    type: 'text',
    label: 'Nombre de Usuario',
    placeholder: 'Elige un nombre de usuario',
    required: true,
    autocomplete: 'username',
    icon: 'user',
    minLength: 3,
    maxLength: 20,
  },
  textColor: {
    type: 'color',
    label: 'Color de Texto',
    required: false,
  },
  backgroundColor: {
    type: 'color',
    label: 'Color de Fondo',
    required: false,
  },
  rememberMe: {
    type: 'checkbox',
    label: 'Recordarme',
    required: false,
  },
  acceptTerms: {
    type: 'checkbox',
    label: 'Acepto los términos y condiciones',
    required: true,
  },
};
