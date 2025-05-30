<template>
  <form @submit.prevent="handleSubmit" class="auth-form" novalidate>
    <!-- Success Message -->
    <Transition name="success-slide">
      <div v-if="uiState.success" class="auth-form__success">
        <div class="success-icon">✓</div>
        <p>Account created successfully! Please check your email to verify your account.</p>
      </div>
    </Transition>

    <!-- Error Message -->
    <Transition name="error-slide">
      <div v-if="uiState.error" class="auth-form__error">
        <span class="error-icon">⚠</span>
        <p>{{ uiState.error }}</p>
      </div>
    </Transition>    <!-- Form Fields -->
    <div class="auth-form__fields">
      <!-- Username -->
      <AuthFormField
        id="username"
        v-model="formData.username"
        label="Username"
        type="text"
        placeholder="Choose a unique username"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.username) ? errors.username[0] : errors.username || undefined"
        autocomplete="username"
        @blur="validateField('username', formData.username)"
      />

      <!-- Email -->
      <AuthFormField
        id="email"
        v-model="formData.email"
        label="Email"
        type="email"
        placeholder="Enter your email address"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.email) ? errors.email[0] : errors.email || undefined"
        autocomplete="email"
        @blur="validateField('email', formData.email)"
      />

      <!-- Password -->
      <AuthFormField
        id="password"
        v-model="formData.password"
        label="Password"
        type="password"
        placeholder="Create a strong password"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.password) ? errors.password[0] : errors.password || undefined"
        :show-password-strength="true"
        autocomplete="new-password"
        @blur="validateField('password', formData.password)"
      />      <!-- Confirm Password -->
      <AuthFormField
        id="confirmPassword"
        v-model="formData.confirmPassword"
        label="Confirm Password"
        type="password"
        placeholder="Confirm your password"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.confirmPassword) ? errors.confirmPassword[0] : errors.confirmPassword || undefined"
        :touched="touched.confirmPassword"
        autocomplete="new-password"
        @blur="validateField('confirmPassword', formData.confirmPassword)"
      />

      <!-- Text Color -->
      <AuthFormField
        id="textColor"
        v-model="formData.textColor"
        label="Text Color"
        type="color"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.textColor) ? errors.textColor[0] : errors.textColor || undefined"
        @blur="validateField('textColor', formData.textColor)"
      />

      <!-- Background Color -->
      <AuthFormField
        id="backgroundColor"
        v-model="formData.backgroundColor"
        label="Background Color"
        type="color"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.backgroundColor) ? errors.backgroundColor[0] : errors.backgroundColor || undefined"
        @blur="validateField('backgroundColor', formData.backgroundColor)"
      />

      <!-- Terms and Privacy -->
      <AuthFormField
        id="acceptTerms"
        v-model="formData.acceptTerms"
        label="I agree to the Terms of Service and Privacy Policy"
        type="checkbox"
        :required="true"
        :disabled="isSubmitting"
        :error="Array.isArray(errors.acceptTerms) ? errors.acceptTerms[0] : errors.acceptTerms || undefined"
        @change="validateField('acceptTerms', formData.acceptTerms)"
      />
    </div>

    <!-- Form Actions -->
    <div class="auth-form__actions">
      <button
        type="submit"
        :disabled="!isValid || isSubmitting"
        class="auth-form__submit"
        :class="{
          'auth-form__submit--loading': isSubmitting,
          'auth-form__submit--success': uiState.success
        }"
      >
        <span v-if="!isSubmitting && !uiState.success" class="auth-form__submit-text">
          Create Account
        </span>
        <span v-else-if="isSubmitting" class="auth-form__submit-text">
          <span class="loading-spinner"></span>
          Creating Account...
        </span>
        <span v-else class="auth-form__submit-text">
          <span class="success-checkmark">✓</span>
          Account Created!
        </span>
      </button>

      <div class="auth-form__footer">
        <p class="text-white mt-3">
          Already have an account?
          <router-link to="/auth/login" class="auth-form__link">
            Sign in here
          </router-link>
        </p>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AuthFormField from './AuthFormField.vue';
import { useRegisterForm } from '../composables/useAuthForm';

// =====================================
// Props & Emits
// =====================================

const emit = defineEmits<{
  success: [data: any];
  error: [error: string];
}>();

// =====================================
// Composables
// =====================================

const router = useRouter();

const {
  formData,
  errors,
  touched,
  isSubmitting,
  isValid,
  uiState,
  validateField,
  submitRegister
} = useRegisterForm();

// =====================================
// Methods
// =====================================

const handleSubmit = async () => {
  try {
    const result = await submitRegister();
    emit('success', result);
    
    // Show success message briefly before redirecting
    setTimeout(() => {
      router.push('/auth/login?registered=true');
    }, 2000);
  } catch (error) {
    emit('error', error as string);
  }
};

// =====================================
// Lifecycle
// =====================================

onMounted(() => {
  // Focus first field on mount
  const firstField = document.getElementById('username');
  if (firstField) {
    firstField.focus();
  }
});
</script>

<style scoped>
/* ===================================== */
/* Form Base Styles */
/* ===================================== */

.auth-form {
  @apply w-full max-w-md mx-auto space-y-6;
}

.auth-form__header {
  @apply text-center space-y-2 mb-8;
}

.auth-form__title {
  @apply text-2xl font-bold text-gray-900 dark:text-white;
}

.auth-form__subtitle {
  @apply text-gray-600 dark:text-gray-400;
}

.auth-form__fields {
  @apply space-y-4;
}

/* ===================================== */
/* Message Styles */
/* ===================================== */

.auth-form__success {
  @apply flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 
         border border-green-200 dark:border-green-700 rounded-lg text-green-800 dark:text-green-200;
}

.success-icon {
  @apply flex-shrink-0 w-5 h-5 text-green-500 font-bold;
}

.auth-form__error {
  @apply flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-900/20 
         border border-red-200 dark:border-red-700 rounded-lg text-red-800 dark:text-red-200;
}

.error-icon {
  @apply flex-shrink-0 w-5 h-5 text-red-500;
}

/* ===================================== */
/* Action Styles */
/* ===================================== */

.auth-form__actions {
  @apply space-y-4;
}

.auth-form__submit {
  @apply w-full flex justify-center items-center px-4 py-3 
         bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
         text-white font-medium rounded-lg transition-all duration-200
         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
         dark:focus:ring-offset-gray-800;
}

.auth-form__submit:disabled {
  @apply cursor-not-allowed opacity-60;
}

.auth-form__submit--loading {
  @apply bg-blue-500 cursor-wait;
}

.auth-form__submit--success {
  @apply bg-green-600 hover:bg-green-600;
}

.auth-form__submit-text {
  @apply flex items-center space-x-2;
}

.loading-spinner {
  @apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
}

.success-checkmark {
  @apply text-lg font-bold;
}

.auth-form__footer {
  @apply text-center text-sm text-gray-600 dark:text-gray-400;
}

.auth-form__link {
  @apply text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 
         font-medium transition-colors duration-200;
}

/* ===================================== */
/* Animations */
/* ===================================== */

.success-slide-enter-active,
.success-slide-leave-active,
.error-slide-enter-active,
.error-slide-leave-active {
  @apply transition-all duration-300;
}

.success-slide-enter-from,
.success-slide-leave-to,
.error-slide-enter-from,
.error-slide-leave-to {
  @apply opacity-0 transform -translate-y-2;
}

/* ===================================== */
/* Responsive Design */
/* ===================================== */

@media (max-width: 640px) {
  .auth-form {
    @apply max-w-full px-4;
  }
  
  .auth-form__title {
    @apply text-xl;
  }
  
  .auth-form__submit {
    @apply py-4 text-lg;
  }
}
</style>
