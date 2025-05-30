<template>
  <div class="message-input">
    <div v-if="messageInput.replyTo" class="reply-preview">
      <div class="reply-content">
        <strong>{{ messageInput.replyTo.username }}</strong>: {{ messageInput.replyTo.content }}
      </div>
      <button @click="$emit('cancel-reply')" class="cancel-reply">×</button>
    </div>
    
    <div class="input-container">
      <textarea
        v-model="inputText"
        @keydown="handleKeydown"
        @input="handleInput"
        placeholder="Type a message..."
        class="message-textarea"
        rows="1"
        :disabled="isSending"
      ></textarea>
      
      <div class="input-actions">
        <button 
          @click="$emit('file-upload', [])" 
          class="attach-btn"
          title="Attach file"
          :disabled="isSending"
        >
          📎
        </button>
        
        <button 
          @click="handleSend"
          class="send-btn"
          :disabled="!canSend"
          title="Send message"
        >
          {{ isSending ? '⏳' : '➤' }}
        </button>
      </div>
    </div>
    
    <div v-if="isTyping" class="typing-indicator">
      You are typing...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MessageInputState } from '../types/chat-module.types'

interface Props {
  messageInput: MessageInputState
  isSending?: boolean
  isTyping?: boolean
}

interface Emits {
  (e: 'send', content: string): void
  (e: 'typing', isTyping: boolean): void
  (e: 'file-upload', files: File[]): void
  (e: 'cancel-reply'): void
}

const props = withDefaults(defineProps<Props>(), {
  isSending: false,
  isTyping: false
})

const emit = defineEmits<Emits>()

const inputText = ref('')
let typingTimeout: ReturnType<typeof setTimeout> | null = null

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !props.isSending
})

const handleInput = () => {
  // Clear existing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }
  
  // Emit typing start
  emit('typing', true)
  
  // Set timeout to stop typing indicator
  typingTimeout = setTimeout(() => {
    emit('typing', false)
  }, 1000)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (canSend.value) {
    emit('send', inputText.value.trim())
    inputText.value = ''
    emit('typing', false)
  }
}

// Watch for external content changes
watch(() => props.messageInput.content, (newContent) => {
  inputText.value = newContent
})
</script>

<style scoped>
.message-input {
  padding: 16px;
  background: white;
  border-top: 1px solid #e0e0e0;
}

.reply-preview {
  display: flex;
  align-items: center;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid #007bff;
}

.reply-content {
  flex: 1;
  font-size: 14px;
  color: #666;
}

.cancel-reply {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cancel-reply:hover {
  color: #666;
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background: #f8f9fa;
  border-radius: 24px;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  transition: border-color 0.2s;
}

.input-container:focus-within {
  border-color: #007bff;
}

.message-textarea {
  flex: 1;
  border: none;
  background: none;
  resize: none;
  outline: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  max-height: 120px;
  min-height: 20px;
}

.message-textarea::placeholder {
  color: #999;
}

.input-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.attach-btn,
.send-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.attach-btn:hover {
  background: #e0e0e0;
}

.send-btn {
  background: #007bff;
  color: white;
}

.send-btn:hover:not(:disabled) {
  background: #0056b3;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.typing-indicator {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
  font-style: italic;
}

/* Mobile adjustments */
@media (max-width: 768px) {
  .message-input {
    padding: 12px;
  }
  
  .input-container {
    padding: 6px 12px;
  }
  
  .message-textarea {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>
