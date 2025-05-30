<template>
  <div class="chat-room">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="room-info">        <h2 class="room-name">{{ activeRoom?.name || 'Select a room' }}</h2>
        <div v-if="activeRoom?.description" class="room-description">
          {{ activeRoom.description }}
        </div>
      </div>
      <div class="room-actions">
        <button 
          @click="toggleUserList" 
          class="toggle-users-btn"
          title="Toggle user list"        >
          👥 {{ onlineUsersList?.length || 0 }}
        </button>
        <button 
          @click="toggleSettings" 
          class="settings-btn"
          title="Room settings"
        >
          ⚙️
        </button>
      </div>
    </div>

    <!-- Chat Messages Area -->
    <div class="chat-content">
      <!-- Messages Container with Virtual Scrolling -->
      <div 
        ref="messagesWrapper"
        class="messages-container-wrapper"
      >        <!-- Loading skeletons when loading initial messages -->
        <div v-if="isLoading && !activeRoomMessages.length" class="loading-skeletons">
          <MessageSkeleton 
            v-for="i in 5" 
            :key="`skeleton-${i}`"
            :is-own="i % 3 === 0"
            :lines="i % 2 === 0 ? 3 : 2"
          />
        </div>

        <RecycleScroller
          v-else
          ref="messageScroller"
          class="messages-container"
          :items="messagesWithDividers"
          :item-size="dynamicItemSize"
          key-field="uniqueId"
          v-slot="{ item }"
          :buffer="1500"
          @scroll.passive="handleScroll"
        >
          <!-- Date divider -->
          <div v-if="item.type === 'divider'" class="date-divider">
            {{ item.date }}
          </div>
          
          <!-- Regular message -->
          <div 
            v-else
            class="message-wrapper"
            :class="{ 'own-message': item.isOwn }"
          >            <MessageBubble 
              :message="item"
              :show-avatar="true"
              :show-timestamp="true"
              @reply="handleReply"
              @edit="handleEdit"
              @delete="handleDelete"
              @react="handleReact"
            />
          </div>
        </RecycleScroller>        <!-- Temporary messages would go here when implemented -->        <!-- Typing Indicators -->
        <div v-if="activeTypingUsers && activeTypingUsers.length > 0" class="typing-indicators">
          <div class="typing-indicator">
            <span class="typing-users">
              {{ activeTypingUsers.map(u => u.username).join(', ') }}
            </span>
            <span class="typing-text">
              {{ activeTypingUsers.length === 1 ? 'is typing' : 'are typing' }}
            </span>
            <div class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        <!-- Scroll to bottom button -->
        <button 
          v-if="showScrollToBottom" 
          @click="scrollToBottom" 
          class="scroll-to-bottom-btn"
        >
          ↓
        </button>
      </div>

      <!-- User List Sidebar -->
      <div 
        v-if="showUserList" 
        class="user-list-sidebar"
      >        <UserList
          :users="chatUsers"
          :online-users="onlineChatUsers"
          @user-click="handleUserClick"
          @user-mention="handleUserMention"
        />
      </div>
    </div>

    <!-- Message Input Area -->
    <div class="message-input-area">      <MessageInput
        :message-input="messageInput"
        :is-sending="isLoading"
        :is-typing="false"
        @send="handleSendMessage"
        @typing="handleTyping"
        @file-upload="handleFileUpload"
      />
    </div>    <!-- Error Display -->
    <div v-if="connectionError" class="connection-error">
      ⚠️ Connection error: {{ connectionError }}
      <button @click="reconnect" class="retry-btn">Retry</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useChatStore } from '@/stores/chat'
import MessageBubble from './MessageBubble.vue'
import MessageInput from './MessageInput.vue'
import UserList from './UserList.vue'
import MessageSkeleton from './MessageSkeleton.vue'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import type { EnhancedMessage } from '@/types'

// Store
const chatStore = useChatStore()

// Computed properties from store that actually exist
const activeRoom = computed(() => chatStore.activeRoom)
const activeRoomMessages = computed(() => chatStore.activeRoomMessages)
const onlineUsersList = computed(() => chatStore.onlineUsersList)
const isConnected = computed(() => chatStore.isConnected)
const activeTypingUsers = computed(() => chatStore.activeTypingUsers)

// Transform user presence data to ChatUser format for UserList component
const chatUsers = computed(() => {
  const userPresence = chatStore.onlineUsersList || []
  return userPresence.filter(Boolean).map((presence: any) => ({
    id: presence.userId || 'unknown',
    username: presence.userId || 'Unknown User',
    email: `${presence.userId}@example.com`,
    textColor: '#333333',
    backgroundColor: '#e0e0e0',
    isOnline: presence.status === 'online',
    lastSeen: new Date(presence.lastSeen || Date.now()),
    status: presence.status || 'offline',
    isTyping: false,
  }))
})

// Filter online users for UserList component
const onlineChatUsers = computed(() => {
  return chatUsers.value.filter(user => user.isOnline)
})

// Date formatting helper (replacing date-fns)
const formatDate = (date: string | Date, formatType: 'date' | 'full' = 'date') => {
  const d = new Date(date)
  if (formatType === 'date') {
    return d.toISOString().split('T')[0] // YYYY-MM-DD format
  }
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

// Local reactive state
const showUserList = ref(false)
const showScrollToBottom = ref(false)
const messageText = ref('')
const isLoading = ref(false)
const connectionError = ref<string | null>(null)
const replyingTo = ref<EnhancedMessage | null>(null)

// MessageInput state
const messageInput = ref({
  content: '',
  attachments: [],
  replyTo: null,
  mentions: [],
  isTyping: false,
  uploadProgress: {}
})

// UI state
const messagesWrapper = ref<HTMLElement>()
const messageScroller = ref<InstanceType<typeof RecycleScroller>>()
const lastScrollPosition = ref(0)
const hasNewMessages = ref(false)
const newMessageCount = ref(0)

// Messages with date dividers for virtual scrolling
const messagesWithDividers = computed(() => {
  const messages = activeRoomMessages.value
  const result: Array<EnhancedMessage | { type: 'date-divider'; date: string; uniqueId: string }> = []
  
  let lastDate = ''
  
  messages.forEach((message) => {
    if (!message?.createdAt || !message?.id) return // Skip invalid messages
    
    const messageDate = formatDate(message.createdAt, 'date')
    
    if (messageDate !== lastDate) {
      result.push({
        type: 'date-divider',
        date: formatDate(message.createdAt, 'full'),
        uniqueId: `divider-${messageDate}`
      })
      lastDate = messageDate
    }
    
    result.push({
      ...message,
      uniqueId: message.id
    } as EnhancedMessage)
  })
  
  return result
})

// Dynamic item sizing for virtual scroller
const dynamicItemSize = (item: any) => {
  if (item.type === 'date-divider') return 40
  
  // Base height for message
  let height = 60
  
  // Add height for content length
  const contentLines = Math.ceil((item.content?.length || 0) / 50)
  height += Math.max(contentLines * 20, 20)
  
  // Add height for attachments
  if (item.attachments?.length > 0) {
    height += 100
  }
  
  return height
}

// Scroll handling
const handleScroll = (event: any) => {
  const target = event.target
  const scrollTop = target.scrollTop
  const scrollHeight = target.scrollHeight
  const clientHeight = target.clientHeight
  
  // Show/hide scroll to bottom button
  showScrollToBottom.value = scrollHeight - scrollTop - clientHeight > 200
  
  // Load older messages when near top
  if (scrollTop < 100 && !isLoading.value) {
    loadOlderMessages()
  }
  
  lastScrollPosition.value = scrollTop
}

// User interaction handlers
const handleSendMessage = async (content: string) => {
  if (!content.trim()) return
  
  try {
    await chatStore.sendMessage(content)
    messageText.value = ''
    scrollToBottom()
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const handleTyping = (isTyping: boolean) => {
  if (isTyping) {
    chatStore.startTyping()
  } else {
    chatStore.stopTyping()
  }
}

const handleFileUpload = (files: File[]) => {
  // File upload not implemented in current store
  console.log('File upload:', files)
}

const handleReply = (message: any) => {
  replyingTo.value = message
}

const handleEdit = (message: any) => {
  // Edit not implemented in current store
  console.log('Edit message:', message)
}

const handleDelete = (message: any) => {
  // Delete not implemented in current store
  console.log('Delete message:', message)
}

const handleReact = (message: any, reaction: string) => {
  // Reactions not implemented in current store
  console.log('React to message:', message, reaction)
}

const handleUserClick = (user: any) => {
  console.log('User clicked:', user)
}

const handleUserMention = (user: any) => {
  console.log('User mentioned:', user)
}

// UI actions
const toggleUserList = () => {
  showUserList.value = !showUserList.value
}

const toggleSettings = () => {
  // Settings not implemented in current store
  console.log('Toggle settings')
}

const reconnect = async () => {
  try {
    await chatStore.connectWebSocket()
  } catch (error) {
    connectionError.value = 'Failed to reconnect'
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messageScroller.value) {
      // Use a type assertion to work around virtual scroller types
      const scroller = messageScroller.value as any
      if (scroller.scrollToEnd) {
        scroller.scrollToEnd()
      } else if (scroller.$el) {
        scroller.$el.scrollTop = scroller.$el.scrollHeight
      }
    }
  })
}

const loadOlderMessages = async () => {
  // Older message loading not implemented in current store
  // This would be added to the store interface later
  console.log('Load older messages')
}

// Lifecycle hooks
onMounted(async () => {
  // Connect if not already connected
  if (!isConnected.value) {
    await chatStore.connectWebSocket()
  }
  
  // Scroll to bottom initially
  scrollToBottom()
})

onUnmounted(() => {
  // Cleanup handled by store
})

// Watch for new messages to scroll to bottom
watch(activeRoomMessages, () => {
  if (!showScrollToBottom.value) {
    scrollToBottom()
  } else {
    hasNewMessages.value = true
    newMessageCount.value += 1
  }
}, { deep: true })

// Reset new message counter when scrolled to bottom
watch(showScrollToBottom, (isShown) => {
  if (!isShown) {
    hasNewMessages.value = false
    newMessageCount.value = 0
  }
})
</script>

<style scoped>
.chat-room {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  flex-shrink: 0;
}

.room-name {
  margin: 0;
  font-size: 1.2rem;
}

.room-description {
  font-size: 0.9rem;
  color: #666;
  margin-top: 4px;
}

.room-actions {
  display: flex;
  gap: 12px;
}

.toggle-users-btn,
.settings-btn {
  padding: 8px 12px;
  background: #f1f1f1;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-users-btn:hover,
.settings-btn:hover {
  background: #e0e0e0;
}

.chat-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.messages-container-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Style for the RecycleScroller */
.messages-container {
  height: 100%;
  width: 100%;
  overflow-y: auto;
}

.message-wrapper {
  padding: 4px 16px;
  max-width: 80%;
  margin: 0;
}

.message-wrapper.own-message {
  margin-left: auto;
}

.date-divider {
  padding: 8px 16px;
  text-align: center;
  color: #666;
  font-size: 0.85rem;
  background: rgba(0, 0, 0, 0.05);
  margin: 12px 0;
}

.temp-messages {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.typing-indicators {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  z-index: 5;
}

.typing-indicator {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

.typing-users {
  font-weight: 500;
  margin-right: 4px;
}

.typing-dots {
  display: flex;
  margin-left: 6px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #666;
  margin: 0 2px;
  animation: typing-dot 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
}

.scroll-to-bottom-btn {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #2196F3;
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 20;
  transition: all 0.2s;
}

.scroll-to-bottom-btn:hover {
  background: #1976D2;
  transform: scale(1.1);
}

.loading-skeletons {
  padding: 16px;
}

.user-list-sidebar {
  width: 280px;
  border-left: 1px solid #e0e0e0;
  background: #fafafa;
}

.message-input-area {
  border-top: 1px solid #e0e0e0;
  background: white;
}

.connection-error {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #ff5722;
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(255, 87, 34, 0.3);
  z-index: 1000;
}

.retry-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.retry-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.compact-mode .message-wrapper {
  margin-bottom: 4px;
}

.compact-mode .messages-container {
  gap: 4px;
}

/* Responsive design */
@media (max-width: 768px) {
  .chat-content {
    flex-direction: column;
  }
  
  .user-list-sidebar {
    width: 100%;
    height: 200px;
    border-left: none;
    border-top: 1px solid #e0e0e0;
  }
  
  .message-wrapper {
    max-width: 85%;
  }
  
  .room-actions {
    gap: 8px;
  }
  
  .toggle-users-btn,
  .settings-btn {
    padding: 6px 10px;
    font-size: 12px;
  }
}
</style>
