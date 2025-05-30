<template>  <div 
    aria-live="polite" 
    role="status" 
    class="loading-container"
  >
    <div 
      class="loading-spinner"
      :class="spinnerClasses"
    >
      <div 
        class="spinner spinner-border" 
        :class="spinnerBootstrapClasses"
        role="status"
        :aria-label="ariaLabel || 'Loading...'"
      ></div>
      <span class="spinner-text" v-if="text">{{ text }}</span>
      <span class="visually-hidden" v-if="!text">{{ ariaLabel || 'Loading...' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'light' | 'dark';
  text?: string;
  fullscreen?: boolean;
  overlay?: boolean;
  ariaLabel?: string;
  withText?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'primary',
  fullscreen: false,
  overlay: false,
  withText: false
});

/**
 * Generate spinner CSS classes
 */
const spinnerClasses = computed(() => {
  return [
    `spinner-${props.size}`,
    `spinner-${props.variant}`,
    props.fullscreen ? 'spinner-fullscreen' : '',
    props.overlay ? 'spinner-overlay' : '',
    props.withText ? 'spinner-with-text' : ''
  ].filter(Boolean).join(' ');
});

/**
 * Generate Bootstrap spinner classes
 */
const spinnerBootstrapClasses = computed(() => {
  const classes = [];
  
  // Bootstrap size classes
  if (props.size === 'sm') {
    classes.push('spinner-border-sm');
  } else if (props.size === 'lg') {
    classes.push('spinner-border-lg');
  }
  
  // Bootstrap color classes
  if (props.variant !== 'primary') {
    classes.push(`text-${props.variant}`);
  }
  
  return classes.join(' ');
});
</script>

<style scoped>
.loading-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Size variants */
.spinner-sm .spinner {
  width: 1.5rem;
  height: 1.5rem;
  border-width: 2px;
}

.spinner-md .spinner {
  width: 3rem;
  height: 3rem;
  border-width: 3px;
}

.spinner-lg .spinner {
  width: 4.5rem;
  height: 4.5rem;
  border-width: 4px;
}

/* The actual spinner */
.spinner {
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Text below spinner */
.spinner-text {
  margin-top: 0.75rem;
  font-size: var(--font-size-sm);
}

/* Screen reader only text - Bootstrap compatible */
.visually-hidden {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Fullscreen spinner */
.spinner-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-index-modal);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Overlay background */
.spinner-overlay {
  background-color: rgba(0, 0, 0, 0.5);
}

.spinner-overlay .spinner-text {
  color: #fff;
}

/* Color variants */
.spinner-primary .spinner {
  border: 3px solid rgba(74, 107, 255, 0.2);
  border-top-color: var(--primary-color);
}

.spinner-secondary .spinner {
  border: 3px solid rgba(108, 117, 125, 0.2);
  border-top-color: var(--secondary-color);
}

.spinner-light .spinner {
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffffff;
}

.spinner-dark .spinner {
  border: 3px solid rgba(0, 0, 0, 0.2);
  border-top-color: #000000;
}

/* Animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* With text layout */
.spinner-with-text {
  flex-direction: row;
  align-items: center;
}

.spinner-with-text .spinner-text {
  margin-top: 0;
  margin-left: 0.75rem;
}
</style>
