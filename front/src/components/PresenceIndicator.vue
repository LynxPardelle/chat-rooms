<template>
  <div class="presence-container">
    <!-- User Presence Status -->
    <div class="presence-status" :class="statusClass">
      <div class="status-indicator" :class="ownStatus"></div>
      <select 
        v-model="ownStatus" 
        @change="updateStatus"
        class="status-selector"
      >
        <option value="online">Online</option>
        <option value="away">Away</option>
        <option value="busy">Busy</option>
        <option value="offline">Offline</option>
      </select>
      
      <input 
        v-if="ownStatus !== 'online' && ownStatus !== 'offline'"
        v-model="customMessage"
        @blur="updateStatus"
        @keyup.enter="updateStatus"
        placeholder="Set status message..."
        class="status-message"
      />
    </div>

    <!-- Online Users List -->
    <div class="online-users" v-if="showOnlineUsers">
      <h4>Online Users ({{ onlineUsersCount }})</h4>
      <div class="user-list">        <div 
          v-for="user in onlineUsersList" 
          :key="user?.userId || 'unknown'"
          class="user-item"
          :class="user?.status || 'offline'"
        >
          <div class="user-avatar" v-if="user">
            <div class="status-dot" :class="user.status"></div>
            {{ user.username?.charAt(0).toUpperCase() || '?' }}
          </div>
          <div class="user-info" v-if="user">
            <span class="username">{{ user.username || 'Unknown' }}</span>
            <span v-if="user.customMessage" class="custom-message">
              {{ user.customMessage }}
            </span>
            <span v-else class="status-text">{{ user.status || 'offline' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Typing Indicators -->
    <div class="typing-indicators" v-if="activeRoomId && typingUsers.length > 0">
      <div class="typing-text">
        <span v-if="typingUsers.length === 1">
          {{ typingUsers[0].username }} is typing
        </span>
        <span v-else-if="typingUsers.length === 2">
          {{ typingUsers[0].username }} and {{ typingUsers[1].username }} are typing
        </span>
        <span v-else>
          {{ typingUsers[0].username }} and {{ typingUsers.length - 1 }} others are typing
        </span>
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { usePresenceStore } from '@/stores/presence';

// Props
interface Props {
  showOnlineUsers?: boolean;
  activeRoomId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlineUsers: true,
  activeRoomId: undefined
});

// Stores
const presenceStore = usePresenceStore();

// Reactive data
const ownStatus = ref(presenceStore.state.ownStatus);
const customMessage = ref(presenceStore.state.ownCustomMessage);

// Computed
const statusClass = computed(() => ({
  'presence-status': true,
  [ownStatus.value]: true
}));

const onlineUsersCount = computed(() => presenceStore.onlineUsersCount);
const onlineUsersList = computed(() => presenceStore.onlineUsersList);

const typingUsers = computed(() => {
  if (!props.activeRoomId) return [];
  return presenceStore.getTypingIndicatorsForRoom(props.activeRoomId).value;
});

// Methods
const updateStatus = async () => {
  try {
    await presenceStore.updateOwnPresence(ownStatus.value, customMessage.value);
  } catch (error) {
    console.error('Failed to update presence:', error);
  }
};

// Watch for external status changes
watch(() => presenceStore.state.ownStatus, (newStatus) => {
  ownStatus.value = newStatus;
});

watch(() => presenceStore.state.ownCustomMessage, (newMessage) => {
  customMessage.value = newMessage;
});
</script>

<style scoped>
.presence-container {
  background: var(--bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.presence-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid var(--border-color, #e0e0e0);
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.online {
  background: #4caf50;
  animation: pulse-green 2s infinite;
}

.status-indicator.away {
  background: #ff9800;
}

.status-indicator.busy {
  background: #f44336;
}

.status-indicator.offline {
  background: #9e9e9e;
}

.status-selector {
  padding: 4px 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  background: white;
  font-size: 14px;
}

.status-message {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.online-users h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: white;
  border: 1px solid var(--border-color, #f0f0f0);
}

.user-avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-color, #2196f3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.status-dot.online {
  background: #4caf50;
}

.status-dot.away {
  background: #ff9800;
}

.status-dot.busy {
  background: #f44336;
}

.status-dot.offline {
  background: #9e9e9e;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.username {
  display: block;
  font-weight: 500;
  font-size: 14px;
  color: var(--text-primary, #333);
}

.custom-message {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-text {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #666);
  text-transform: capitalize;
}

.typing-indicators {
  padding: 8px 12px;
  background: var(--bg-tertiary, #f0f0f0);
  border-radius: 6px;
  margin-top: 8px;
}

.typing-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary, #666);
  font-style: italic;
}

.typing-dots {
  display: flex;
  gap: 2px;
}

.typing-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-secondary, #666);
  animation: typing-bounce 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes pulse-green {
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .presence-container {
    padding: 12px;
  }
  
  .presence-status {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .status-message {
    margin-top: 4px;
  }
  
  .user-list {
    max-height: 150px;
  }
}
</style>
