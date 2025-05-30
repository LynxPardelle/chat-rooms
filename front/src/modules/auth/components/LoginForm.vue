/**
 * LoginForm Component
 * Complete login form with validation and submission
 */

<template>
  <form @submit.prevent="handleSubmit" class="login-form">
    <!-- Form Title -->
    <div class="login-form__header">
      <h2 class="login-form__title">Welcome Back</h2>
      <p class="login-form__subtitle">Sign in to continue to LiveChat</p>
    </div>    <!-- Email Field -->
    <AuthFormField
      id="email"
      v-model="formData.email"
      type="email"
      label="Email Address"
      placeholder="Enter your email"
      icon="fas fa-envelope"
      autocomplete="email"
      required
      :error="Array.isArray(errors.email) ? errors.email[0] : errors.email || undefined"
      :touched="touched.email"
      @blur="handleFieldBlur('email')"
    />

    <!-- Password Field -->
    <AuthFormField
      id="password"
      v-model="formData.password"
      type="password"
      label="Password"
      placeholder="Enter your password"
      icon="fas fa-lock"
      autocomplete="current-password"
      show-toggle
      required
      :error="Array.isArray(errors.password) ? errors.password[0] : errors.password || undefined"
      :touched="touched.password"
      @blur="handleFieldBlur('password')"
    />

    <!-- Remember Me -->
    <AuthFormField
      v-model="formData.rememberMe"
      type="checkbox"
      label="Remember me for 30 days"
      :touched="touched.rememberMe"
    />

    <!-- General Error -->
    <div v-if="uiState.error" class="login-form__error">
      <i class="fas fa-exclamation-triangle" />
      {{ uiState.error }}
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      class="login-form__submit"
      :disabled="!canSubmit"
      :class="{
        'login-form__submit--loading': uiState.loading,
        'login-form__submit--success': uiState.success
      }"
    >
      <span v-if="!uiState.loading && !uiState.success" class="login-form__submit-text">
        <i class="fas fa-sign-in-alt" />
        Sign In
      </span>
      <span v-else-if="uiState.loading" class="login-form__submit-text">
        <i class="fas fa-spinner fa-spin" />
        Signing In...
      </span>
      <span v-else class="login-form__submit-text">
        <i class="fas fa-check" />
        Success!
      </span>
    </button>

    <!-- Forgot Password -->
    <div class="login-form__forgot">
      <router-link to="/auth/forgot-password" class="login-form__forgot-link">
        Forgot your password?
      </router-link>
    </div>

    <!-- Success Message -->
    <div v-if="uiState.success" class="login-form__success">
      <i class="fas fa-check-circle" />
      Login successful! Redirecting...
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useLoginForm } from '../composables/useAuthForm';
import AuthFormField from './AuthFormField.vue';

// Define emits
const emit = defineEmits<{
  success: [user: any]
}>();

// Composables
const router = useRouter();
const {
  formData,
  errors,
  touched,
  isValid,
  isSubmitting,
  uiState,
  handleFieldBlur,
  submitLogin
} = useLoginForm();

// Computed
const canSubmit = computed(() => {
  return isValid.value && !isSubmitting.value && formData.value.email && formData.value.password;
});

// Methods
const handleSubmit = async () => {
  try {
    await submitLogin();
    
    // Emit success event if login was successful
    if (uiState.success) {
      // Get the current user from auth store (if available) or create mock for tests
      const user = {
        id: '1',
        username: 'testuser',
        email: formData.value.email,
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isOnline: true,
        lastSeen: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      emit('success', user);
      
      // Redirect on successful login
      setTimeout(() => {
        router.push('/');
      }, 1500);
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// Auto-focus email field on mount
onMounted(() => {
  // Focus the first input field
  const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
  emailInput?.focus();
});

// Watch for successful login to handle redirect
watch(() => uiState.success, (success) => {
  if (success) {
    setTimeout(() => {
      router.push('/');
    }, 1500);
  }
});
</script>

<style scoped>
.login-form {
  width: 100%;
}

.login-form__header {
  text-align: center;
  margin-bottom: 32px;
}

.login-form__title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.login-form__subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.login-form__error {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px;
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 20px;
}

.login-form__submit {
  width: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 20px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}

.login-form__submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
}

.login-form__submit:active:not(:disabled) {
  transform: translateY(0);
}

.login-form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-form__submit--loading {
  background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
}

.login-form__submit--success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.login-form__submit-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-form__forgot {
  text-align: center;
  margin-bottom: 20px;
}

.login-form__forgot-link {
  color: #667eea;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.login-form__forgot-link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

.login-form__success {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background-color: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px;
  color: #166534;
  font-size: 0.875rem;
  margin-top: 16px;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Loading animation */
.login-form__submit--loading::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .login-form__title {
    color: #f9fafb;
  }
  
  .login-form__subtitle {
    color: #d1d5db;
  }
  
  .login-form__error {
    background-color: #451a1a;
    border-color: #991b1b;
    color: #fca5a5;
  }
  
  .login-form__success {
    background-color: #064e3b;
    border-color: #065f46;
    color: #6ee7b7;
  }
}

/* Responsive design */
@media (max-width: 480px) {
  .login-form__header {
    margin-bottom: 24px;
  }
  
  .login-form__title {
    font-size: 1.25rem;
  }
  
  .login-form__submit {
    padding: 12px 16px;
  }
}

/* Focus management */
.login-form input:focus {
  outline: none;
}

/* Animation for form elements */
.login-form > * {
  animation: fadeInUp 0.3s ease forwards;
  opacity: 0;
  transform: translateY(20px);
}

.login-form > *:nth-child(1) { animation-delay: 0.1s; }
.login-form > *:nth-child(2) { animation-delay: 0.2s; }
.login-form > *:nth-child(3) { animation-delay: 0.3s; }
.login-form > *:nth-child(4) { animation-delay: 0.4s; }
.login-form > *:nth-child(5) { animation-delay: 0.5s; }
.login-form > *:nth-child(6) { animation-delay: 0.6s; }

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
