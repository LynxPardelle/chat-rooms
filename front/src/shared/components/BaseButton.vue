<template>
  <button
    :type="type"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :aria-disabled="disabled || loading ? 'true' : undefined"
    :aria-busy="loading ? 'true' : undefined"
    :aria-label="ariaLabel"
    :data-test="testId"
    v-bind="$attrs"
    @click="onClick"
    @keydown.enter="onKeyDown"
    @keydown.space.prevent="onKeyDown"
  >
    <span v-if="loading" class="spinner spinner-border" role="status" aria-hidden="true"></span>
    <slot v-else-if="icon && iconPosition === 'left'" name="icon">
      <span class="icon icon-left" :class="iconClasses">
        <i :class="icon" aria-hidden="true"></i>
      </span>
    </slot>
    <slot>{{ label }}</slot>
    <slot v-if="icon && iconPosition === 'right'" name="icon">
      <span class="icon icon-right" :class="iconClasses">
        <i :class="icon" aria-hidden="true"></i>
      </span>
    </slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Size, Variant } from '../types';
import { getComponentClasses, getSizeClass } from '../utils/style';

interface Props {
  label?: string;
  type?: 'button' | 'submit' | 'reset';
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  outline?: boolean;
  rounded?: boolean;
  block?: boolean;
  fullWidth?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  ariaLabel?: string;
  testId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  outline: false,
  rounded: false,
  block: false,
  fullWidth: false,
  iconPosition: 'left'
});

const emits = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

/**
 * Handle click event with loading state check
 */
const onClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emits('click', event);
  }
};

/**
 * Handle keyboard events for accessibility
 */
const onKeyDown = (event: KeyboardEvent) => {
  if (!props.disabled && !props.loading) {
    emits('click', event as unknown as MouseEvent);
  }
};

/**
 * Generate button CSS classes
 */
const buttonClasses = computed(() => {
  const baseClasses = getComponentClasses('btn', {
    size: props.size,
    variant: props.variant,
    outline: props.outline,
    rounded: props.rounded,
    block: props.block
  });
  
  const stateClasses = [
    props.disabled ? 'disabled' : '',
    props.loading ? 'loading' : '',
    props.fullWidth ? 'w-100' : ''
  ].filter(Boolean);
  
  return [baseClasses, ...stateClasses].join(' ');
});

/**
 * Generate icon CSS classes
 */
const iconClasses = computed(() => {
  return getSizeClass(props.size, 'icon');
});
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  text-align: center;
  vertical-align: middle;
  user-select: none;
  border: 1px solid transparent;
  padding: 0.5rem 1rem;
  font-size: var(--font-size-md);
  line-height: 1.5;
  border-radius: var(--border-radius-md);
  transition: var(--transition-base);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  white-space: nowrap;
}

/* Size variants */
.btn-sm {
  padding: 0.25rem 0.5rem;
  font-size: var(--font-size-sm);
  border-radius: var(--border-radius-sm);
}

.btn-lg {
  padding: 0.75rem 1.5rem;
  font-size: var(--font-size-lg);
  border-radius: var(--border-radius-lg);
}

.btn-xl {
  padding: 1rem 2rem;
  font-size: var(--font-size-xl);
  border-radius: var(--border-radius-lg);
}

/* Color variants */
.btn-primary {
  background-color: var(--primary-color);
  color: var(--text-white);
  border-color: var(--primary-color);
}

.btn-primary:hover, .btn-primary:focus {
  background-color: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-primary:active {
  background-color: var(--primary-active);
  border-color: var(--primary-active);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: var(--text-white);
  border-color: var(--secondary-color);
}

.btn-secondary:hover, .btn-secondary:focus {
  background-color: var(--secondary-hover);
  border-color: var(--secondary-hover);
}

.btn-secondary:active {
  background-color: var(--secondary-active);
  border-color: var(--secondary-active);
}

.btn-success {
  background-color: var(--success-color);
  color: var(--text-white);
  border-color: var(--success-color);
}

.btn-success:hover, .btn-success:focus {
  background-color: var(--success-hover);
  border-color: var(--success-hover);
}

.btn-danger {
  background-color: var(--danger-color);
  color: var(--text-white);
  border-color: var(--danger-color);
}

.btn-danger:hover, .btn-danger:focus {
  background-color: var(--danger-hover);
  border-color: var(--danger-hover);
}

.btn-warning {
  background-color: var(--warning-color);
  color: var(--text-white);
  border-color: var(--warning-color);
}

.btn-warning:hover, .btn-warning:focus {
  background-color: var(--warning-hover);
  border-color: var(--warning-hover);
}

.btn-info {
  background-color: var(--info-color);
  color: var(--text-white);
  border-color: var(--info-color);
}

.btn-info:hover, .btn-info:focus {
  background-color: var(--info-hover);
  border-color: var(--info-hover);
}

.btn-light {
  background-color: var(--light-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-light:hover, .btn-light:focus {
  background-color: var(--border-color);
}

.btn-dark {
  background-color: var(--dark-bg);
  color: var(--text-white);
  border-color: var(--dark-bg);
}

/* Outline variants */
.btn-primary-outline {
  background-color: transparent;
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.btn-primary-outline:hover, .btn-primary-outline:focus {
  background-color: var(--primary-light);
}

.btn-secondary-outline {
  background-color: transparent;
  color: var(--secondary-color);
  border-color: var(--secondary-color);
}

.btn-secondary-outline:hover, .btn-secondary-outline:focus {
  background-color: var(--secondary-light);
}

.btn-success-outline {
  background-color: transparent;
  color: var(--success-color);
  border-color: var(--success-color);
}

.btn-success-outline:hover, .btn-success-outline:focus {
  background-color: var(--success-light);
}

.btn-danger-outline {
  background-color: transparent;
  color: var(--danger-color);
  border-color: var(--danger-color);
}

.btn-danger-outline:hover, .btn-danger-outline:focus {
  background-color: var(--danger-light);
}

.btn-warning-outline {
  background-color: transparent;
  color: var(--warning-color);
  border-color: var(--warning-color);
}

.btn-warning-outline:hover, .btn-warning-outline:focus {
  background-color: var(--warning-light);
}

.btn-info-outline {
  background-color: transparent;
  color: var(--info-color);
  border-color: var(--info-color);
}

.btn-info-outline:hover, .btn-info-outline:focus {
  background-color: var(--info-light);
}

/* Style modifiers */
.btn-rounded {
  border-radius: var(--border-radius-full);
}

.btn-block {
  display: block;
  width: 100%;
}

/* States */
.btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--focus-ring-color);
}

.btn.disabled,
.btn:disabled {
  opacity: 0.65;
  pointer-events: none;
}

.btn.loading {
  color: transparent !important;
  pointer-events: none;
}

/* Loading spinner */
.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1rem;
  height: 1rem;
  margin-top: -0.5rem;
  margin-left: -0.5rem;
  border: 0.2rem solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

.btn-outline .spinner,
.btn-light .spinner {
  border: 0.2rem solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--text-primary);
}

/* Icon positioning */
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-left {
  margin-right: 0.5rem;
}

.icon-right {
  margin-left: 0.5rem;
}

.icon-sm {
  font-size: 0.75em;
}

.icon-lg {
  font-size: 1.25em;
}

.icon-xl {
  font-size: 1.5em;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
