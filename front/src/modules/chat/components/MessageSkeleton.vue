<template>  <div class="message-skeleton" :class="messageClasses">
    <div v-if="!isOwn" class="avatar-skeleton"></div>
    
    <div class="message-content-skeleton">
      <div v-if="!isOwn" class="header-skeleton">
        <div class="username-skeleton"></div>
        <div class="timestamp-skeleton"></div>
      </div>
      
      <div class="text-skeleton">
        <div class="line"></div>
        <div class="line" :style="{ width: lineWidths[0] }"></div>
        <div v-if="shouldShowAdditionalLine" class="line" :style="{ width: lineWidths[1] }"></div>
      </div>
      
      <div v-if="isOwn" class="timestamp-skeleton own"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  isOwn: {
    type: Boolean,
    default: false
  },
  lines: {
    type: Number,
    default: 2
  }
});

// Generate random widths for the skeleton lines for more natural appearance
const lineWidths = computed(() => {
  return [
    `${Math.floor(30 + Math.random() * 40)}%`, // 30-70%
    `${Math.floor(20 + Math.random() * 50)}%`  // 20-70%
  ];
});

// Use props in computed to ensure they're recognized as used
const messageClasses = computed(() => ({
  'own-message': props.isOwn
}));

const shouldShowAdditionalLine = computed(() => props.lines > 2);
</script>

<style scoped>
.message-skeleton {
  display: flex;
  margin-bottom: 16px;
  animation: pulse 1.5s infinite ease-in-out;
}

.message-skeleton.own-message {
  flex-direction: row-reverse;
}

.avatar-skeleton {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #e0e0e0;
  margin-right: 8px;
  flex-shrink: 0;
}

.message-content-skeleton {
  max-width: 70%;
  border-radius: 12px;
  padding: 12px;
  background-color: #e0e0e0;
}

.own-message .message-content-skeleton {
  background-color: #e3f2fd;
}

.header-skeleton {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.username-skeleton {
  width: 80px;
  height: 14px;
  background-color: #ccc;
  border-radius: 3px;
}

.timestamp-skeleton {
  width: 50px;
  height: 12px;
  background-color: #ccc;
  border-radius: 3px;
}

.text-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  height: 14px;
  background-color: #ccc;
  border-radius: 3px;
  width: 100%;
}

.own-message .line,
.own-message .timestamp-skeleton {
  background-color: #b3e5fc;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
</style>
