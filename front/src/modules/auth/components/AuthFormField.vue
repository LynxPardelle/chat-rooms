/**
 * AuthFormField Component
 * Reusable form field for authentication forms
 */

<template>
  <div class="auth-field field" :class="fieldClasses">
    <!-- Label -->
    <label 
      v-if="label" 
      :for="fieldId" 
      class="auth-field__label field__label"
    >
      {{ label }}
      <span v-if="required" class="auth-field__required">*</span>
    </label>
    
    <!-- Input Container -->
    <div class="auth-field__input-container field__input-container">
      <!-- Icon -->
      <div v-if="icon" class="auth-field__icon field__icon">
        <i :class="icon" />
      </div>
      
      <!-- Input Field -->
      <input
        :id="fieldId"
        ref="inputRef"
        :type="computedType"
        :value="modelValue"
        :placeholder="placeholder"
        :autocomplete="autocomplete"
        :disabled="disabled"
        :readonly="readonly"
        :minlength="minLength"
        :maxlength="maxLength"
        :class="inputClasses"
        class="auth-field__input field__input"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        @keyup.enter="$emit('enter')"
      />
      
      <!-- Color Input (for color picker) -->
      <input
        v-if="type === 'color'"
        :value="modelValue"
        type="color"
        class="auth-field__color-input field__color-input"
        @input="handleInput"
      />
      
      <!-- Checkbox Input -->
      <input
        v-if="type === 'checkbox'"
        :id="fieldId"
        :checked="modelValue"
        type="checkbox"
        class="auth-field__checkbox field__checkbox"
        @change="handleCheckboxChange"
      />
      
      <!-- Toggle Button (for password visibility) -->
      <button
        v-if="type === 'password' && showToggle"
        type="button"
        class="auth-field__toggle field__toggle"
        @click="togglePasswordVisibility"
      >
        <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'" />
      </button>
    </div>
    
    <!-- Error Message -->
    <div 
      v-if="error && touched" 
      class="auth-field__error field__error"
    >
      <i class="fas fa-exclamation-circle" />
      {{ error }}
    </div>
    
    <!-- Help Text -->
    <div 
      v-if="helpText && !error" 
      class="auth-field__help"
    >
      {{ helpText }}
    </div>
    
    <!-- Password Strength (for password fields) -->
    <div 
      v-if="type === 'password' && showPasswordStrength && modelValue && !error"
      class="auth-field__strength"
    >
      <div class="auth-field__strength-bar">
        <div 
          class="auth-field__strength-fill"
          :class="`auth-field__strength-fill--${passwordStrength.strength}`"
          :style="{ width: `${(passwordStrength.score + 1) * 20}%` }"
        />
      </div>
      <span class="auth-field__strength-text">
        Password strength: {{ passwordStrength.strength }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { validatePassword } from '../validators/auth.validators';
import type { PasswordStrengthResult } from '../types/auth-module.types';

interface Props {
  modelValue: any;
  type?: 'text' | 'email' | 'password' | 'color' | 'checkbox';
  id?: string;
  label?: string;
  placeholder?: string;
  icon?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  autocomplete?: string;
  minLength?: number;
  maxLength?: number;
  showToggle?: boolean;
  showPasswordStrength?: boolean;
  touched?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: any): void;
  (e: 'blur'): void;
  (e: 'focus'): void;
  (e: 'enter'): void;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  id: '',
  label: '',
  placeholder: '',
  icon: '',
  error: '',
  helpText: '',
  required: false,
  disabled: false,
  readonly: false,
  autocomplete: '',
  minLength: 0,
  maxLength: 999,
  showToggle: false,
  showPasswordStrength: false,
  touched: false
});

const emit = defineEmits<Emits>();

// Refs
const inputRef = ref<HTMLInputElement>();
const showPassword = ref(false);
const isFocused = ref(false);

// Computed
const fieldId = computed(() => props.id || `auth-field-${Math.random().toString(36).substr(2, 9)}`);

const computedType = computed(() => {
  if (props.type === 'password' && showPassword.value) {
    return 'text';
  }
  if (props.type === 'color' || props.type === 'checkbox') {
    return 'text'; // The actual color/checkbox input is separate
  }
  return props.type;
});

const fieldClasses = computed(() => ({
  'auth-field--error': props.error && props.touched,
  'field--error': props.error && props.touched,
  'auth-field--focused': isFocused.value,
  'field--focused': isFocused.value,
  'auth-field--disabled': props.disabled,
  'field--disabled': props.disabled,
  'auth-field--checkbox': props.type === 'checkbox',
  'field--checkbox': props.type === 'checkbox',
  'auth-field--color': props.type === 'color',
  'field--color': props.type === 'color'
}));

const inputClasses = computed(() => ({
  'auth-field__input--with-icon': !!props.icon,
  'auth-field__input--with-toggle': props.type === 'password' && props.showToggle,
  'auth-field__input--error': props.error && props.touched
}));

const passwordStrength = computed((): PasswordStrengthResult => {
  if (props.type === 'password' && props.modelValue) {
    return validatePassword(props.modelValue);
  }
  return {
    score: 0,
    feedback: [],
    isValid: false,
    strength: 'weak'
  };
});

// Methods
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};

const handleCheckboxChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.checked);
};

const handleBlur = () => {
  isFocused.value = false;
  emit('blur');
};

const handleFocus = () => {
  isFocused.value = true;
  emit('focus');
};

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value;
};

const focus = () => {
  inputRef.value?.focus();
};

// Expose methods
defineExpose({
  focus
});
</script>

<style scoped>
.auth-field {
  margin-bottom: 20px;
}

.auth-field__label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 6px;
}

.auth-field__required {
  color: #ef4444;
  margin-left: 2px;
}

.auth-field__input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-field__icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  z-index: 1;
  pointer-events: none;
}

.auth-field__input {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  transition: all 0.2s ease;
  background-color: #ffffff;
}

.auth-field__input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.auth-field__input--with-icon {
  padding-left: 40px;
}

.auth-field__input--with-toggle {
  padding-right: 40px;
}

.auth-field__input--error {
  border-color: #ef4444;
}

.auth-field__input--error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.auth-field__color-input {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.auth-field__checkbox {
  width: 18px;
  height: 18px;
  accent-color: #667eea;
  cursor: pointer;
}

.auth-field__toggle {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.2s ease;
}

.auth-field__toggle:hover {
  color: #374151;
}

.auth-field__error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 6px;
}

.auth-field__help {
  color: #6b7280;
  font-size: 0.75rem;
  margin-top: 6px;
}

.auth-field__strength {
  margin-top: 8px;
}

.auth-field__strength-bar {
  width: 100%;
  height: 4px;
  background-color: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.auth-field__strength-fill {
  height: 100%;
  transition: all 0.3s ease;
  border-radius: 2px;
}

.auth-field__strength-fill--weak {
  background-color: #ef4444;
}

.auth-field__strength-fill--fair {
  background-color: #f59e0b;
}

.auth-field__strength-fill--good {
  background-color: #3b82f6;
}

.auth-field__strength-fill--strong {
  background-color: #10b981;
}

.auth-field__strength-text {
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: capitalize;
}

/* Disabled state */
.auth-field--disabled .auth-field__input {
  background-color: #f9fafb;
  color: #6b7280;
  cursor: not-allowed;
}

.auth-field--disabled .auth-field__label {
  color: #6b7280;
}

/* Checkbox styling */
.auth-field--checkbox .auth-field__input-container {
  flex-direction: row-reverse;
  justify-content: flex-end;
  gap: 8px;
}

.auth-field--checkbox .auth-field__label {
  margin-bottom: 0;
  cursor: pointer;
  font-weight: 400;
}

/* Color field styling */
.auth-field--color .auth-field__input {
  padding-right: 50px;
}

/* Focus state */
.auth-field--focused .auth-field__icon {
  color: #667eea;
}

/* Error state */
.auth-field--error .auth-field__icon {
  color: #ef4444;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .auth-field__label {
    color: #d1d5db;
  }
  
  .auth-field__input {
    background-color: #374151;
    border-color: #4b5563;
    color: #f9fafb;
  }
  
  .auth-field__input:focus {
    border-color: #667eea;
  }
  
  .auth-field__icon {
    color: #9ca3af;
  }
  
  .auth-field--focused .auth-field__icon {
    color: #667eea;
  }
  
  .auth-field__help {
    color: #9ca3af;
  }
  
  .auth-field__strength-bar {
    background-color: #4b5563;
  }
  
  .auth-field__strength-text {
    color: #9ca3af;
  }
}

/* Responsive design */
@media (max-width: 480px) {
  .auth-field__input {
    padding: 10px 14px;
  }
  
  .auth-field__input--with-icon {
    padding-left: 36px;
  }
  
  .auth-field__input--with-toggle {
    padding-right: 36px;
  }
}
</style>
