<template>
  <BaseModal
    v-model="isVisible"
    :title="title"
    :closable="closable"
    size="sm"
    :persistent="true"
    :loading="loading"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    :confirm-variant="confirmVariant"
    @confirm="onConfirm"
    @cancel="onCancel"
  >
    <div class="confirmation-content">
      <div v-if="icon" class="confirmation-icon" :class="iconClass">
        <i :class="iconClasses"></i>
      </div>
      <div class="confirmation-message">
        {{ message }}
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import BaseModal from './BaseModal.vue';
import type { Variant } from '../types';

interface Props {
  message: string;
  title?: string;
  icon?: 'success' | 'warning' | 'danger' | 'info' | 'question' | 'none';
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: Variant;
  closable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Confirm',
  icon: 'question',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmVariant: 'primary',
  closable: true
});

const emits = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const isVisible = ref(true);
const loading = ref(false);

/**
 * CSS class for the icon container
 */
const iconClass = computed(() => {
  return `confirmation-icon-${props.icon}`;
});

/**
 * CSS classes for the icon itself
 */
const iconClasses = computed(() => {
  switch (props.icon) {
    case 'success': return 'fas fa-check-circle';
    case 'warning': return 'fas fa-exclamation-triangle';
    case 'danger': return 'fas fa-exclamation-circle';
    case 'info': return 'fas fa-info-circle';
    case 'question': return 'fas fa-question-circle';
    default: return '';
  }
});

/**
 * Handle confirm action
 */
const onConfirm = async () => {
  loading.value = true;
  try {
    emits('confirm');
  } finally {
    loading.value = false;
    isVisible.value = false;
  }
};

/**
 * Handle cancel action
 */
const onCancel = () => {
  emits('cancel');
  isVisible.value = false;
};
</script>

<style scoped>
.confirmation-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem 0;
}

.confirmation-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.confirmation-message {
  font-size: var(--font-size-md);
  line-height: 1.5;
}

/* Icon variants */
.confirmation-icon-success {
  color: var(--success-color);
}

.confirmation-icon-warning {
  color: var(--warning-color);
}

.confirmation-icon-danger {
  color: var(--danger-color);
}

.confirmation-icon-info {
  color: var(--info-color);
}

.confirmation-icon-question {
  color: var(--primary-color);
}
</style>
