<template>  <div 
    class="base-card card" 
    :class="cardClasses" 
    :data-test="testId"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    @click="onClick"
    @keydown.enter="interactive && onClick"
  >
    <div v-if="hasHeaderSlot || title" class="card-header">
      <slot name="header">
        <div class="card-header-content">
          <h4 class="card-title" v-if="title">{{ title }}</h4>
          <div class="card-subtitle" v-if="subtitle">{{ subtitle }}</div>
        </div>
      </slot>
    </div>
    
    <div class="card-body" :class="bodyClass">
      <slot></slot>
    </div>
    
    <div v-if="hasFooterSlot" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { Size } from '../types';

interface Props {
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'flat';
  size?: Size;
  bodyClass?: string;
  interactive?: boolean;
  elevated?: boolean;
  testId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  interactive: false,
  elevated: false
});

const emits = defineEmits<{
  (e: 'click', event: MouseEvent | KeyboardEvent): void;
}>();

const slots = useSlots();
const hasHeaderSlot = computed(() => !!slots.header);
const hasFooterSlot = computed(() => !!slots.footer);

/**
 * Handle click event
 */
const onClick = (event: MouseEvent | KeyboardEvent) => {
  if (props.interactive) {
    emits('click', event);
  }
};

/**
 * Generate card CSS classes
 */
const cardClasses = computed(() => {
  return [
    `card-${props.variant}`,
    `card-${props.size}`,
    props.interactive ? 'card-interactive' : '',
    props.elevated ? 'card-elevated' : ''
  ].filter(Boolean).join(' ');
});
</script>

<style scoped>
.base-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  word-wrap: break-word;
  background-color: var(--card-bg);
  background-clip: border-box;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  transition: var(--transition-base);
}

/* Card variants */
.card-default {
  background-color: var(--card-bg);
}

.card-primary {
  background-color: var(--primary-light);
  border-color: var(--primary-color);
}

.card-secondary {
  background-color: var(--secondary-light);
  border-color: var(--secondary-color);
}

.card-outline {
  background-color: transparent;
}

.card-flat {
  border: none;
  box-shadow: none;
}

/* Card sizes */
.card-sm {
  border-radius: var(--border-radius-sm);
}

.card-lg {
  border-radius: var(--border-radius-lg);
}

.card-xl {
  border-radius: var(--border-radius-xl);
}

/* Card parts */
.card-header {
  padding: var(--spacing-md);
  margin-bottom: 0;
  background-color: rgba(0, 0, 0, 0.03);
  border-bottom: 1px solid var(--border-color);
}

.card-header-content {
  display: flex;
  flex-direction: column;
}

.card-title {
  margin: 0;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.card-subtitle {
  margin-top: 0.25rem;
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.card-body {
  flex: 1 1 auto;
  padding: var(--spacing-md);
}

.card-footer {
  padding: var(--spacing-md);
  background-color: rgba(0, 0, 0, 0.03);
  border-top: 1px solid var(--border-color);
}

/* Interactive card */
.card-interactive {
  cursor: pointer;
}

.card-interactive:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card-interactive:focus {
  outline: none;
  box-shadow: 0 0 0 3px var(--focus-ring-color), var(--shadow-md);
}

/* Elevated card */
.card-elevated {
  box-shadow: var(--shadow-md);
  border: none;
}

/* Size-specific padding */
.card-sm .card-body {
  padding: var(--spacing-sm);
}

.card-sm .card-header,
.card-sm .card-footer {
  padding: var(--spacing-sm);
}

.card-lg .card-body {
  padding: var(--spacing-lg);
}

.card-lg .card-header,
.card-lg .card-footer {
  padding: var(--spacing-lg);
}

.card-xl .card-body {
  padding: var(--spacing-xl);
}

.card-xl .card-header,
.card-xl .card-footer {
  padding: var(--spacing-xl);
}
</style>
