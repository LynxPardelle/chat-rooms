/**
 * Auth Form Composable
 * Advanced reactive form management for authentication
 */

import { ref, reactive, computed, watch, nextTick } from 'vue';
import authService from '@/core/services/auth.service';
import { ErrorService } from '@/core/services/error.service';
import type {
  AuthFormErrors,
  AuthUIState,
  AuthFormConfig,
  LoginFormData,
  RegisterFormData
} from '../types/auth-module.types';
import {
  validateLoginForm,
  validateRegisterForm
} from '../validators/auth.validators';

// Extended configuration for the composable
interface ExtendedAuthFormConfig extends AuthFormConfig {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  enableAutoComplete?: boolean;
}

// Default configuration
const AUTH_FORM_DEFAULTS: ExtendedAuthFormConfig = {
  enableValidation: true,
  validationDelay: 300,
  showPasswordStrength: true,
  allowRememberMe: true,
  enableColorPicker: true,
  requireTermsAcceptance: true,
  validateOnChange: true,
  validateOnBlur: true,
  debounceMs: 300,
  enableAutoComplete: true
};

/**
 * Advanced composable for authentication form management
 * Provides reactive form state, validation, and submission handling
 */
export function useAuthForm<T extends Record<string, any>>(
  initialData: T,
  validator: (data: T) => AuthFormErrors,
  config: Partial<ExtendedAuthFormConfig> = {}
) {
  // Configuration with defaults
  const formConfig = reactive({ ...AUTH_FORM_DEFAULTS, ...config });
  
  // Reactive form data
  const formData = ref<T>({ ...initialData });
  const errors = ref<AuthFormErrors>({});
  const touched = ref<Record<keyof T, boolean>>(
    Object.keys(initialData).reduce((acc, key) => {
      acc[key as keyof T] = false;
      return acc;
    }, {} as Record<keyof T, boolean>)
  );
  
  // Form control state
  const isSubmitting = ref(false);
  const isDirty = ref(false);
  
  // UI state
  const uiState = reactive<AuthUIState>({
    loading: false,
    success: false,
    error: null,
    validating: false
  });

  // Computed properties
  const isValid = computed(() => {
    return Object.keys(errors.value).length === 0;
  });

  const hasChanges = computed(() => {
    return JSON.stringify(formData.value) !== JSON.stringify(initialData);
  });
  // Validation timer for debouncing
  let validationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Validate form data with debouncing
   */
  const validateForm = () => {
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    validationTimer = setTimeout(() => {
      uiState.validating = true;
      
      try {
        const validationErrors = validator(formData.value);
        errors.value = validationErrors;
        isDirty.value = hasChanges.value;
      } catch (error) {
        console.error('Validation error:', error);
        errors.value = { general: 'Validation failed. Please try again.' };
      } finally {
        uiState.validating = false;
      }
    }, formConfig.debounceMs);
  };

  /**
   * Validate a specific field
   */
  const validateField = (fieldName: keyof T, value: any) => {
    const fieldData = { ...formData.value, [fieldName]: value };
    const fieldErrors = validator(fieldData);
    
    if (fieldErrors[fieldName as string]) {
      errors.value[fieldName as string] = fieldErrors[fieldName as string];
    } else {
      delete errors.value[fieldName as string];
    }
    
    touched.value[fieldName] = true;
  };

  /**
   * Update field value with optional validation
   */
  const updateField = (fieldName: keyof T, value: any) => {
    formData.value[fieldName] = value;
    touched.value[fieldName] = true;
    isDirty.value = true;

    if (formConfig.validateOnChange) {
      validateField(fieldName, value);
    }
  };

  /**
   * Handle field blur event
   */
  const handleFieldBlur = (fieldName: keyof T) => {
    touched.value[fieldName] = true;
    
    if (formConfig.validateOnBlur) {
      validateField(fieldName, formData.value[fieldName]);
    }
  };

  /**
   * Clear field error
   */
  const clearError = (fieldName: keyof T) => {
    delete errors.value[fieldName as string];
  };

  /**
   * Clear all errors
   */
  const clearAllErrors = () => {
    errors.value = {};
    uiState.error = null;
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    formData.value = { ...initialData };
    errors.value = {};
    touched.value = Object.keys(initialData).reduce((acc, key) => {
      acc[key as keyof T] = false;
      return acc;
    }, {} as Record<keyof T, boolean>);
    isDirty.value = false;
    isSubmitting.value = false;
    uiState.loading = false;
    uiState.success = false;
    uiState.error = null;
    uiState.validating = false;
  };

  /**
   * Set form data programmatically
   */
  const setFormData = (newData: Partial<T>) => {
    Object.assign(formData.value, newData);
    isDirty.value = hasChanges.value;
    
    if (formConfig.validateOnChange) {
      validateForm();
    }
  };

  // Watch for form data changes
  watch(
    () => formData.value,
    () => {
      isDirty.value = hasChanges.value;
      if (formConfig.validateOnChange) {
        validateForm();
      }
    },
    { deep: true }
  );

  // Return the composable interface
  return {
    // Reactive data
    formData,
    errors,
    touched,
    isValid,
    isSubmitting,
    isDirty,
    hasChanges,
    uiState,
    formConfig,

    // Methods
    updateField,
    validateField,
    validateForm,
    handleFieldBlur,
    clearError,
    clearAllErrors,
    resetForm,
    setFormData
  };
}

// =====================================
// Specialized Auth Form Composables
// =====================================

/**
 * Login form composable
 */
export function useLoginForm() {
  const form = useAuthForm<LoginFormData>(
    {
      email: '',
      password: '',
      rememberMe: false
    },
    validateLoginForm,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      enableAutoComplete: true
    }
  );
  /**
   * Submit login form
   */
  const submitLogin = async (): Promise<void> => {
    try {
      form.isSubmitting.value = true;
      form.uiState.loading = true;
      form.uiState.error = null;

      // Final validation
      form.validateForm();
      await nextTick();

      if (!form.isValid.value) {
        throw new Error('Please fix form errors before submitting');
      }

      // Submit to auth service - it returns UserResponse on success or throws on error
      const user = await authService.login({
        email: form.formData.value.email,
        password: form.formData.value.password
      });

      // If we reach here, login was successful
      form.uiState.success = true;
      console.log('Login successful:', user);

    } catch (error: any) {
      console.error('Login error:', error);
      const apiError = ErrorService.handleApiError(error);
      form.uiState.error = apiError.message;
      
      // Handle specific error cases
      if (ErrorService.isAuthError(error)) {
        form.errors.value.general = 'Invalid email or password';
      }
    } finally {
      form.isSubmitting.value = false;
      form.uiState.loading = false;
    }
  };

  return {
    ...form,
    submitLogin
  };
}

/**
 * Register form composable
 */
export function useRegisterForm() {
  const form = useAuthForm<RegisterFormData>(
    {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
      textColor: '#000000',
      backgroundColor: '#ffffff',
      showColorPreview: false
    },
    validateRegisterForm,
    {
      validateOnChange: true,
      validateOnBlur: true,
      debounceMs: 300,
      showPasswordStrength: true,
      enableAutoComplete: false
    }
  );
  /**
   * Submit registration form
   */
  const submitRegister = async (): Promise<void> => {
    try {
      form.isSubmitting.value = true;
      form.uiState.loading = true;
      form.uiState.error = null;

      // Final validation
      form.validateForm();
      await nextTick();

      if (!form.isValid.value) {
        throw new Error('Please fix form errors before submitting');
      }

      // Submit to auth service - it returns UserResponse on success or throws on error
      const user = await authService.register({
        username: form.formData.value.username,
        email: form.formData.value.email,
        password: form.formData.value.password,
        textColor: form.formData.value.textColor,
        backgroundColor: form.formData.value.backgroundColor
      });

      // If we reach here, registration was successful
      form.uiState.success = true;
      console.log('Registration successful:', user);

    } catch (error: any) {
      console.error('Registration error:', error);
      const apiError = ErrorService.handleApiError(error);
      form.uiState.error = apiError.message;
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        form.errors.value.username = 'Username already exists';
      }
    } finally {
      form.isSubmitting.value = false;
      form.uiState.loading = false;
    }
  };

  return {
    ...form,
    submitRegister
  };
}
