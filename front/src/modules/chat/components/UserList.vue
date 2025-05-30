<template>
  <div class="user-list">
    <div class="user-list-header">
      <h3>Users ({{ onlineUsers.length }}/{{ users.length }})</h3>
    </div>
    
    <div class="users-container">
      <div class="online-users">
        <h4 v-if="onlineUsers.length > 0">Online</h4>
        <div 
          v-for="user in onlineUsers" 
          :key="user.id"
          class="user-item online"
          @click="$emit('user-click', user)"
        >
          <div class="user-avatar" :style="{ backgroundColor: user.textColor }">
            {{ user.username.charAt(0).toUpperCase() }}
          </div>
          <div class="user-info">
            <div class="username">{{ user.username }}</div>
            <div class="user-status">Online</div>
          </div>
          <button 
            @click.stop="$emit('user-mention', user)"
            class="mention-btn"
            title="Mention user"
          >
            @
          </button>
        </div>
      </div>
      
      <div class="offline-users" v-if="offlineUsers.length > 0">
        <h4>Offline</h4>
        <div 
          v-for="user in offlineUsers" 
          :key="user.id"
          class="user-item offline"
          @click="$emit('user-click', user)"
        >
          <div class="user-avatar offline" :style="{ backgroundColor: user.textColor }">
            {{ user.username.charAt(0).toUpperCase() }}
          </div>
          <div class="user-info">
            <div class="username">{{ user.username }}</div>
            <div class="user-status">Offline</div>
          </div>
          <button 
            @click.stop="$emit('user-mention', user)"
            class="mention-btn"
            title="Mention user"
          >
            @
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatUser } from '../types/chat-module.types'

interface Props {
  users: ChatUser[]
  onlineUsers: ChatUser[]
}

interface Emits {
  (e: 'user-click', user: ChatUser): void
  (e: 'user-mention', user: ChatUser): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const offlineUsers = computed(() => {
  return props.users.filter(user => !props.onlineUsers.find(ou => ou.id === user.id))
})
</script>

<style scoped>
.user-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.user-list-header {
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: white;
}

.user-list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.users-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.online-users,
.offline-users {
  margin-bottom: 16px;
}

.online-users h4,
.offline-users h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.user-item:hover {
  background: rgba(0, 123, 255, 0.1);
}

.user-item.offline {
  opacity: 0.6;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
  position: relative;
}

.user-avatar.offline {
  filter: grayscale(1);
}

.user-avatar::after {
  content: '';
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.user-item.online .user-avatar::after {
  background: #4caf50;
}

.user-item.offline .user-avatar::after {
  background: #999;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.username {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  font-size: 12px;
  color: #666;
}

.mention-btn {
  background: rgba(0, 123, 255, 0.1);
  border: none;
  color: #007bff;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.2s;
}

.user-item:hover .mention-btn {
  opacity: 1;
}

.mention-btn:hover {
  background: rgba(0, 123, 255, 0.2);
}

/* Scrollbar styling */
.users-container::-webkit-scrollbar {
  width: 6px;
}

.users-container::-webkit-scrollbar-track {
  background: transparent;
}

.users-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.users-container::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
