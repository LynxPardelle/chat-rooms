/**
 * Authentication Module Components Export
 * Entry point for all authentication module components
 */

// Layout Components
export { default as AuthLayout } from './components/AuthLayout.vue';

// Form Components
export { default as AuthFormField } from './components/AuthFormField.vue';
export { default as LoginForm } from './components/LoginForm.vue';
export { default as RegisterForm } from './components/RegisterForm.vue';

// View Components
export { default as LoginView } from './LoginView.vue';
export { default as RegisterView } from './RegisterView.vue';

// Composables
export { useAuthForm, useLoginForm, useRegisterForm } from './composables/useAuthForm';

// Validators
export * from './validators/auth.validators';

// Types
export type * from './types/auth-module.types';

// Guards (if they exist)
// export * from './guards/auth.guards';
