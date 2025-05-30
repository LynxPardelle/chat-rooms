<template>
  <div
    class="toast"
    :class="getSingleToastClasses()"
    :role="getSingleToastRole()"
    :aria-live="getSingleToastAriaLive()"
    aria-atomic="true"
    v-if="props.message"
    :style="{ display: props.show ? 'block' : 'none' }"
  >
    <div class="toast-header">
      <div class="toast-icon" v-if="props.type">
        <span class="icon" :class="`icon-${props.type}`">
          <i :class="getSingleToastIconClass()" aria-hidden="true"></i>
        </span>
      </div>
      <div class="toast-content">
        <div class="toast-title" v-if="props.title">{{ props.title }}</div>
        <div class="toast-message">{{ props.message }}</div>
      </div>
      <button 
        v-if="props.closable" 
        type="button"
        class="toast-close"
        @click="$emit('close')"
        aria-label="Close toast notification"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  </div>
  
  <!-- Service-based toasts for normal usage (when no message prop) -->
  <template v-else>
    <Teleport to="body">
      <div class="toast-container">
        <TransitionGroup name="toast">
          <div
            v-for="[id, toast] in toasts"
            :key="id"
            class="toast"
            :class="getToastClasses(toast)"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div class="toast-header">
              <div class="toast-icon" v-if="toast.variant">
                <span class="icon" :class="`icon-${toast.variant}`">
                  <i :class="getIconClass(toast)" aria-hidden="true"></i>
                </span>
              </div>
              <div class="toast-content">
                <div class="toast-title" v-if="toast.title">{{ toast.title }}</div>
                <div class="toast-message">{{ toast.message }}</div>
              </div>
              <button 
                v-if="toast.closable" 
                type="button"
                class="toast-close"
                @click="closeToast(id)"
                aria-label="Close toast notification"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="toast-progress" v-if="toast.timeout && toast.timeout > 0">
              <div 
                class="toast-progress-bar"
                :style="{ animationDuration: `${toast.timeout}ms` }"
              ></div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </template>
</template>

<script setup lang="ts">
import { } from 'vue';
import { useToast } from '../composables/useToast';
import type { ToastOptions } from '../types';

// Props for testing/single toast mode
interface Props {
  message?: string;
  type?: 'success' | 'info' | 'warning' | 'danger';
  title?: string;
  show?: boolean;
  closable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  closable: true
});

defineEmits<{
  (e: 'close'): void;
}>();

// Use singleton toast service for normal mode
const { toasts, closeToast } = useToast();

/**
 * Get CSS classes for single toast (testing mode)
 */
const getSingleToastClasses = () => {
  const classes = [
    props.type ? `toast-${props.type}` : '',
    'toast-top-right'
  ];
  
  // Add Bootstrap classes for test compatibility
  if (props.type) {
    classes.push(`text-bg-${props.type}`);
  }
  
  return classes.filter(Boolean);
};

/**
 * Get role for single toast based on type
 */
const getSingleToastRole = () => {
  switch (props.type) {
    case 'success':
    case 'danger':
    case 'warning':
      return 'alert';
    case 'info':
    default:
      return 'status';
  }
};

/**
 * Get aria-live for single toast based on type
 */
const getSingleToastAriaLive = () => {
  switch (props.type) {
    case 'success':
    case 'danger':
    case 'warning':
      return 'assertive';
    case 'info':
    default:
      return 'polite';
  }
};

/**
 * Get icon class for single toast
 */
const getSingleToastIconClass = () => {
  switch (props.type) {
    case 'success': return 'fas fa-check-circle';    
    case 'danger': return 'fas fa-exclamation-circle';
    case 'warning': return 'fas fa-exclamation-triangle';
    case 'info': return 'fas fa-info-circle';
    default: return 'fas fa-bell';
  }
};

/**
 * Get CSS classes for a toast (service mode)
 */
const getToastClasses = (toast: ToastOptions) => {
  return [
    toast.variant ? `toast-${toast.variant}` : '',
    toast.position ? `toast-${toast.position}` : 'toast-top-right'
  ].filter(Boolean);
};

/**
 * Get appropriate icon class based on toast variant (service mode)
 */
const getIconClass = (toast: ToastOptions) => {
  if (toast.icon) {
    return toast.icon;
  }
  
  switch (toast.variant) {
    case 'success': return 'fas fa-check-circle';
    case 'danger': return 'fas fa-exclamation-circle';
    case 'warning': return 'fas fa-exclamation-triangle';
    case 'info': return 'fas fa-info-circle';
    default: return 'fas fa-bell';
  }
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  z-index: var(--z-index-toast);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: none;
}

/* Position variants */
.toast-top-right {
  top: 0;
  right: 0;
}

.toast-top-left {
  top: 0;
  left: 0;
}

.toast-bottom-right {
  bottom: 0;
  right: 0;
}

.toast-bottom-left {
  bottom: 0;
  left: 0;
}

.toast-top-center {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.toast-bottom-center {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

/* Toast styling */
.toast {
  width: 350px;
  max-width: 100%;
  background-color: var(--card-bg);
  color: var(--text-primary);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
  position: relative;
}

.toast-header {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  gap: 0.75rem;
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  width: 1.5rem;
  height: 1.5rem;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  font-size: var(--font-size-md);
  margin-bottom: 0.25rem;
}

.toast-message {
  font-size: var(--font-size-sm);
}

.toast-close {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--text-muted);
  padding: 0;
  margin-left: auto;
  cursor: pointer;
}

.toast-close:hover {
  color: var(--text-primary);
}

/* Progress bar */
.toast-progress {
  height: 4px;
  background-color: rgba(0, 0, 0, 0.1);
  width: 100%;
}

.toast-progress-bar {
  height: 100%;
  width: 100%;
  background-color: currentColor;
  transform-origin: left;
  animation: progress-bar 3000ms linear forwards;
}

@keyframes progress-bar {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

/* Variant styling */
.toast-success {
  border-left: 4px solid var(--success-color);
}
.toast-success .icon-success {
  color: var(--success-color);
}
.toast-success .toast-progress-bar {
  background-color: var(--success-color);
}

.toast-danger {
  border-left: 4px solid var(--danger-color);
}
.toast-danger .icon-danger {
  color: var(--danger-color);
}
.toast-danger .toast-progress-bar {
  background-color: var(--danger-color);
}

.toast-warning {
  border-left: 4px solid var(--warning-color);
}
.toast-warning .icon-warning {
  color: var(--warning-color);
}
.toast-warning .toast-progress-bar {
  background-color: var(--warning-color);
}

.toast-info {
  border-left: 4px solid var(--info-color);
}
.toast-info .icon-info {
  color: var(--info-color);
}
.toast-info .toast-progress-bar {
  background-color: var(--info-color);
}

/* Animation */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Position-specific animations */
.toast-top-left .toast-enter-from,
.toast-bottom-left .toast-enter-from,
.toast-top-left .toast-leave-to,
.toast-bottom-left .toast-leave-to {
  transform: translateX(-100%);
}

.toast-top-center .toast-enter-from,
.toast-bottom-center .toast-enter-from {
  transform: translateY(-100%);
}

.toast-top-center .toast-leave-to,
.toast-bottom-center .toast-leave-to {
  transform: translateY(-100%);
}
</style>
