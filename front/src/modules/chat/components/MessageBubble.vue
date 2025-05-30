<template>
  <div class="message-bubble" :class="messageClasses">
    <div v-if="showAvatar && !message.isOwn" class="avatar">
      <img 
        v-if="message.userColors?.backgroundColor" 
        :src="getUserAvatar()"
        :alt="message.username"
        class="avatar-img"
      />
      <div v-else class="avatar-placeholder" :style="{ backgroundColor: message.userColors?.backgroundColor }">
        {{ message.username.charAt(0).toUpperCase() }}
      </div>
    </div>
    
    <div class="message-content">
      <div v-if="!message.isOwn" class="message-header">
        <span class="username" :style="{ color: message.userColors?.textColor }">
          {{ message.username }}
        </span>
        <span v-if="showTimestamp" class="timestamp">
          {{ formatTime(message.createdAt) }}
        </span>
      </div>
      
      <div class="message-text">
        {{ message.content }}
      </div>
      
      <div v-if="isTemp" class="message-status temp">Sending...</div>
      <div v-else-if="message.status === 'sending'" class="message-status sending">Sending...</div>
      <div v-else-if="message.status === 'failed'" class="message-status failed">Failed</div>
      
      <div v-if="showTimestamp && message.isOwn" class="timestamp own">
        {{ formatTime(message.createdAt) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '../types/chat-module.types'

interface Props {
  message: ChatMessage
  showAvatar?: boolean
  showTimestamp?: boolean
  isTemp?: boolean
}

interface Emits {
  (e: 'reply', message: ChatMessage): void
  (e: 'edit', message: ChatMessage): void
  (e: 'delete', message: ChatMessage): void
  (e: 'react', message: ChatMessage, reaction: string): void
}

const props = withDefaults(defineProps<Props>(), {
  showAvatar: true,
  showTimestamp: true,
  isTemp: false
})

defineEmits<Emits>()

const messageClasses = computed(() => ({
  'own-message': props.message.isOwn,
  'temp-message': props.isTemp,
  'failed-message': props.message.status === 'failed'
}))

const formatTime = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

const getUserAvatar = (): string => {
  // Placeholder avatar generation
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(props.message.username)}&background=random`
}
</script>

<style scoped>
.message-bubble {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  max-width: 100%;
}

.message-bubble.own-message {
  flex-direction: row-reverse;
}

.avatar {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 16px;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.username {
  font-weight: 600;
  font-size: 14px;
}

.timestamp {
  font-size: 12px;
  color: #666;
}

.timestamp.own {
  text-align: right;
  margin-top: 4px;
}

.message-text {
  background: #f5f5f5;
  padding: 12px 16px;
  border-radius: 18px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
}

.own-message .message-text {
  background: #007bff;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble:not(.own-message) .message-text {
  border-bottom-left-radius: 4px;
}

.message-status {
  font-size: 12px;
  margin-top: 4px;
  text-align: right;
}

.message-status.temp,
.message-status.sending {
  color: #666;
  font-style: italic;
}

.message-status.failed {
  color: #ff5722;
}

.temp-message {
  opacity: 0.7;
}

.failed-message .message-text {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}
</style>
