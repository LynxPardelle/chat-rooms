# Authentication Module Documentation

## Overview

The Authentication Module is a comprehensive, production-ready authentication system for the Vue.js Chat Rooms application. It provides secure user authentication with modern UI components, robust validation, and excellent user experience.

## Features

- ✅ **Modern UI Components** - Glassmorphism design with dark mode support
- ✅ **Comprehensive Validation** - Real-time client-side validation with detailed feedback
- ✅ **Password Strength Indicator** - Visual password strength feedback
- ✅ **Form State Management** - Advanced reactive form handling with Vue 3 Composition API
- ✅ **Error Handling** - Graceful error handling with user-friendly messages
- ✅ **Accessibility** - Full keyboard navigation and screen reader support
- ✅ **Responsive Design** - Mobile-first responsive design
- ✅ **Type Safety** - Full TypeScript support with comprehensive type definitions
- ✅ **Testing Ready** - Complete test suite with utilities and mocks

## Architecture

```
src/modules/auth/
├── components/          # Reusable UI components
│   ├── AuthLayout.vue   # Main authentication layout
│   ├── AuthFormField.vue # Reusable form field component
│   ├── LoginForm.vue    # Login form component
│   └── RegisterForm.vue # Registration form component
├── composables/         # Business logic and state management
│   └── useAuthForm.ts   # Form state management composable
├── types/              # TypeScript type definitions
│   └── auth-module.types.ts
├── validators/         # Client-side validation logic
│   └── auth.validators.ts
├── __tests__/          # Test files and utilities
│   ├── auth.validators.test.ts
│   ├── components.test.ts
│   └── test-utils.ts
└── index.ts           # Module exports
```

## Components

### AuthLayout

Main container for authentication pages with glassmorphism design.

```vue
<template>
  <AuthLayout>
    <LoginForm @success="handleSuccess" @error="handleError" />
  </AuthLayout>
</template>
```

**Props:**
- None

**Features:**
- Responsive glassmorphism design
- Dark mode support
- Animated background
- Mobile-optimized layout

### AuthFormField

Reusable form field component with validation and accessibility features.

```vue
<template>
  <AuthFormField
    id="email"
    v-model="email"
    label="Email Address"
    type="email"
    placeholder="Enter your email"
    :required="true"
    :error="emailError"
    autocomplete="email"
    @blur="validateEmail"
  />
</template>
```

**Props:**
- `id` (string, required) - Unique field identifier
- `label` (string, required) - Field label text
- `type` (string, required) - Input type (text, email, password, checkbox, color)
- `modelValue` (any, required) - v-model value
- `placeholder` (string) - Placeholder text
- `required` (boolean) - Whether field is required
- `disabled` (boolean) - Whether field is disabled
- `error` (string) - Error message to display
- `showPasswordStrength` (boolean) - Show password strength indicator
- `autocomplete` (string) - Autocomplete attribute

**Features:**
- Support for multiple input types
- Password visibility toggle
- Password strength indicator
- Color picker support
- Validation state styling
- Accessibility attributes

### LoginForm

Complete login form with validation and submission handling.

```vue
<template>
  <LoginForm
    @success="onLoginSuccess"
    @error="onLoginError"
  />
</template>
```

**Events:**
- `success(data)` - Emitted on successful login
- `error(message)` - Emitted on login error

**Features:**
- Email and password validation
- Remember me option
- Loading states
- Success animations
- Auto-focus on mount

### RegisterForm

Comprehensive registration form with all required fields.

```vue
<template>
  <RegisterForm
    @success="onRegisterSuccess"
    @error="onRegisterError"
  />
</template>
```

**Events:**
- `success(data)` - Emitted on successful registration
- `error(message)` - Emitted on registration error

**Features:**
- Username, email, password validation
- Password confirmation
- Color customization
- Terms acceptance
- Real-time validation feedback

## Composables

### useAuthForm

Advanced form state management composable.

```typescript
const {
  formData,
  errors,
  isSubmitting,
  isValid,
  uiState,
  validateField,
  resetForm
} = useAuthForm(initialData, validator, config);
```

**Returns:**
- `formData` - Reactive form data
- `errors` - Validation errors
- `isSubmitting` - Submission state
- `isValid` - Form validity state
- `uiState` - UI state (loading, success, error)
- `validateField` - Field validation function
- `resetForm` - Form reset function

### useLoginForm

Specialized login form composable.

```typescript
const {
  formData,
  errors,
  isSubmitting,
  isValid,
  uiState,
  submitLogin
} = useLoginForm();
```

### useRegisterForm

Specialized registration form composable.

```typescript
const {
  formData,
  errors,
  isSubmitting,
  isValid,
  uiState,
  submitRegister
} = useRegisterForm();
```

## Validation

### Password Validation

Comprehensive password strength validation:

- Minimum 8 characters
- Uppercase and lowercase letters
- Numbers and special characters
- Common password detection
- Dictionary word detection

### Email Validation

RFC 5322 compliant email validation with:

- Format verification
- Domain validation
- Common typo detection

### Username Validation

Username validation with:

- Length requirements (3-30 characters)
- Allowed characters (alphanumeric, underscore, hyphen)
- Reserved name checking

## Types

### Core Types

```typescript
interface AuthFormState<T> {
  data: T;
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
  errors: AuthFormErrors;
  touched: Record<keyof T, boolean>;
}

interface AuthFormErrors {
  [field: string]: string | string[] | null;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  textColor: string;
  backgroundColor: string;
  showColorPreview?: boolean;
}
```

## Usage Examples

### Basic Login

```vue
<template>
  <div class="login-page">
    <AuthLayout>
      <LoginForm
        @success="handleLoginSuccess"
        @error="handleLoginError"
      />
    </AuthLayout>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AuthLayout, LoginForm } from '@/modules/auth';

const router = useRouter();

const handleLoginSuccess = (data: any) => {
  console.log('Login successful:', data);
  router.push('/dashboard');
};

const handleLoginError = (error: string) => {
  console.error('Login failed:', error);
  // Handle error (show notification, etc.)
};
</script>
```

### Basic Registration

```vue
<template>
  <div class="register-page">
    <AuthLayout>
      <RegisterForm
        @success="handleRegisterSuccess"
        @error="handleRegisterError"
      />
    </AuthLayout>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { AuthLayout, RegisterForm } from '@/modules/auth';

const router = useRouter();

const handleRegisterSuccess = (data: any) => {
  console.log('Registration successful:', data);
  router.push('/auth/login?registered=true');
};

const handleRegisterError = (error: string) => {
  console.error('Registration failed:', error);
  // Handle error (show notification, etc.)
};
</script>
```

### Custom Form with useAuthForm

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <AuthFormField
      v-for="field in formFields"
      :key="field.id"
      v-bind="field"
      v-model="formData[field.id]"
      :error="errors[field.id]"
      @blur="validateField(field.id, formData[field.id])"
    />
    
    <button
      type="submit"
      :disabled="!isValid || isSubmitting"
      class="submit-button"
    >
      {{ isSubmitting ? 'Submitting...' : 'Submit' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { useAuthForm, AuthFormField } from '@/modules/auth';
import { validateCustomForm } from './validators';

const {
  formData,
  errors,
  isSubmitting,
  isValid,
  validateField
} = useAuthForm(
  {
    customField1: '',
    customField2: ''
  },
  validateCustomForm
);

const formFields = [
  {
    id: 'customField1',
    label: 'Custom Field 1',
    type: 'text',
    placeholder: 'Enter value',
    required: true
  },
  {
    id: 'customField2',
    label: 'Custom Field 2',
    type: 'email',
    placeholder: 'Enter email',
    required: true
  }
];

const handleSubmit = async () => {
  // Custom submission logic
};
</script>
```

## Testing

The module includes comprehensive tests and testing utilities:

### Running Tests

```bash
# Run all auth module tests
npm test src/modules/auth

# Run specific test files
npm test auth.validators.test.ts
npm test components.test.ts

# Run tests in watch mode
npm test:watch src/modules/auth
```

### Test Utilities

```typescript
import {
  mockAuthService,
  mockErrorService,
  createFormWrapper,
  triggerFormSubmit,
  fillFormField,
  expectValidationError,
  expectFormValid
} from '@/modules/auth/__tests__/test-utils';

// Mock services for testing
vi.mock('@/core/services/auth.service', () => ({
  default: mockAuthService
}));

// Test form validation
const errors = validateLoginForm(invalidData);
expectValidationError(errors, 'email');
expectFormValid(validatedForm);
```

## Router Integration

The module integrates seamlessly with Vue Router guards:

```typescript
import { authGuard, guestGuard } from '@/router/guards/auth.guard';

const routes = [
  {
    path: '/auth/login',
    component: LoginView,
    meta: { guest: true },
    beforeEnter: guestGuard
  },
  {
    path: '/dashboard',
    component: DashboardView,
    meta: { requiresAuth: true },
    beforeEnter: authGuard
  }
];
```

## Styling

The module uses Tailwind CSS with custom component classes:

```css
/* Auth layout styles */
.auth-layout { /* glassmorphism container */ }
.auth-layout__content { /* content wrapper */ }
.auth-layout__background { /* animated background */ }

/* Form field styles */
.field { /* base field container */ }
.field--error { /* error state */ }
.field--success { /* success state */ }
.field__label { /* field label */ }
.field__input { /* input element */ }
.field__error { /* error message */ }

/* Form styles */
.auth-form { /* form container */ }
.auth-form__header { /* form header */ }
.auth-form__fields { /* fields container */ }
.auth-form__actions { /* action buttons */ }
.auth-form__submit { /* submit button */ }
```

## Configuration

The module can be configured through the composable config:

```typescript
const config = {
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

const form = useAuthForm(initialData, validator, config);
```

## Best Practices

1. **Always use TypeScript** for type safety
2. **Validate on both client and server** for security
3. **Provide clear error messages** for better UX
4. **Use proper autocomplete attributes** for better accessibility
5. **Test all form states** including loading, error, and success
6. **Follow responsive design principles** for mobile compatibility
7. **Implement proper ARIA attributes** for screen readers
8. **Use debounced validation** to avoid excessive API calls

## Security Considerations

- Client-side validation is for UX only - always validate on server
- Passwords are never stored in plain text
- Use HTTPS for all authentication endpoints
- Implement proper CSRF protection
- Use secure tokens for authentication
- Follow OWASP guidelines for authentication security

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Dependencies

- Vue 3.3+
- Vue Router 4+
- TypeScript 5+
- Tailwind CSS 3+
- Vitest (for testing)

## Contributing

When contributing to the authentication module:

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Ensure accessibility compliance
5. Test on multiple browsers and devices
6. Follow semantic versioning for breaking changes

## Changelog

### Version 1.0.0
- Initial implementation
- Complete authentication components
- Comprehensive validation system
- Full TypeScript support
- Test suite and documentation
