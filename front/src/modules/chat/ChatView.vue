<template>
  <div class="chat-container">
    <div class="chat-header bg-primary text-white p-3">
      <h2>Chat Rooms</h2>
      <div class="header-actions d-flex align-items-center gap-2">
        <button 
          class="btn btn-light btn-sm"
          @click="openSearch"
          title="Search messages (Ctrl+F)"
        >
          <i class="bi bi-search me-1"></i>
          Search
        </button>
        <button class="btn btn-light btn-sm" @click="navigateToProfile">
          <i class="bi bi-person me-1"></i>
          Profile
        </button>
        <button class="btn btn-danger btn-sm" @click="handleLogout">
          <i class="bi bi-box-arrow-right me-1"></i>
          Logout
        </button>
      </div>
    </div>

    <!-- Connection Status Banner -->
    <div v-if="!connectionManager.isConnected.value" class="connection-banner">
      <ConnectionStatus 
        :show-details="true" 
        :show-actions="true"
        :auto-hide="true"
      />
    </div>

    <!-- Search Modal -->
    <div 
      v-if="showSearch"
      class="search-modal-overlay"
      @click="closeSearchModal"
    >
      <div 
        class="search-modal"
        @click.stop
      >
        <MessageSearch
          :auto-focus="true"
          @close="closeSearch"
          @message-click="handleMessageClick"
        />
      </div>
    </div>

    <div class="chat-content">
      <!-- Room Selection -->
      <div v-if="!currentRoom" class="room-selection p-3">
        <h4>Select a Chat Room</h4>
        <div v-if="loadingRooms" class="text-center">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading rooms...</span>
          </div>
        </div>
        <div v-else-if="roomsError" class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ roomsError }}
          <button @click="loadRooms" class="btn btn-sm btn-outline-danger ms-2">
            <i class="bi bi-arrow-clockwise me-1"></i>
            Retry
          </button>
        </div>
        <div v-else class="rooms-list">
          <div
            v-for="room in availableRooms"
            :key="room.id"
            @click="joinRoom(room)"
            class="room-item card mb-2 cursor-pointer"
            :class="{ 'border-primary': room.id === selectedRoomId }"
          >
            <div class="card-body p-3">
              <h6 class="card-title mb-1">{{ room.name }}</h6>
              <p class="card-text text-muted small mb-1">{{ room.description }}</p>
              <div class="d-flex justify-content-between align-items-center">
                <small class="text-muted">
                  <i class="bi bi-people me-1"></i>
                  {{ room.userCount || 0 }} participants
                </small>
                <small class="text-muted">
                  {{ room.isPrivate ? 'Private' : 'Public' }}
                </small>
              </div>
            </div>
          </div>
          
          <!-- Create New Room Button -->
          <button 
            @click="showCreateRoom = true"
            class="btn btn-outline-primary w-100 mt-2"
          >
            <i class="bi bi-plus-circle me-2"></i>
            Create New Room
          </button>
        </div>
      </div>

      <!-- Chat Messages -->
      <div v-else class="chat-messages p-3" ref="messagesContainer">
        <!-- Room Header -->
        <div class="room-header mb-3 pb-2 border-bottom">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h5 class="mb-1">{{ currentRoom.name }}</h5>
              <small class="text-muted">{{ currentRoom.description }}</small>
            </div>
            <div class="room-actions">
              <button 
                @click="leaveCurrentRoom"
                class="btn btn-sm btn-outline-secondary"
                title="Leave room"
              >
                <i class="bi bi-box-arrow-left"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- Messages Loading -->
        <div v-if="loadingMessages" class="text-center py-4">
          <div class="spinner-border" role="status">
            <span class="visually-hidden">Loading messages...</span>
          </div>
        </div>

        <!-- Messages Error -->
        <div v-else-if="messagesError" class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ messagesError }}
          <button @click="loadMessages" class="btn btn-sm btn-outline-warning ms-2">
            <i class="bi bi-arrow-clockwise me-1"></i>
            Retry
          </button>
        </div>

        <!-- Messages List -->
        <div v-else-if="messages.length === 0" class="text-center text-muted py-4">
          <i class="bi bi-chat-dots-fill fs-1 mb-3 d-block"></i>
          <p>No messages yet. Start the conversation!</p>
        </div>
        <div v-else class="messages-list">
          <div
            v-for="message in messages"
            :key="message.id"
            class="message-item mb-3"
            :class="{ 'own-message': message.userId === authStore.currentUser?.id }"
          >
            <div class="message-content">
              <div class="message-header d-flex justify-content-between align-items-start mb-1">
                <div class="sender-info">
                  <strong class="sender-name">{{ message.senderName || 'Unknown' }}</strong>
                  <small class="timestamp text-muted ms-2">
                    {{ formatMessageTime(message.createdAt) }}
                  </small>
                </div>
                <div v-if="message.userId === authStore.currentUser?.id" class="message-actions">
                  <button 
                    @click="editMessage(message)"
                    class="btn btn-sm btn-link p-0 me-1"
                    title="Edit message"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button 
                    @click="deleteMessage(message)"
                    class="btn btn-sm btn-link p-0 text-danger"
                    title="Delete message"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
              <div class="message-text">{{ message.content }}</div>
              <div v-if="message.editedAt" class="message-edited">
                <small class="text-muted">
                  <i class="bi bi-pencil me-1"></i>
                  Edited {{ formatMessageTime(message.editedAt) }}
                </small>
              </div>
            </div>
          </div>
        </div>

        <!-- Typing Indicators -->
        <div v-if="typingUsers.length > 0" class="typing-indicators mb-2">
          <div class="typing-indicator">
            <span class="typing-text">
              <span v-if="typingUsers.length === 1">
                {{ typingUsers[0].username }} is typing
              </span>
              <span v-else-if="typingUsers.length === 2">
                {{ typingUsers[0].username }} and {{ typingUsers[1].username }} are typing
              </span>
              <span v-else>
                {{ typingUsers[0].username }} and {{ typingUsers.length - 1 }} others are typing
              </span>
            </span>
            <span class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <div v-if="currentRoom" class="chat-input bg-light border-top p-3">
        <div v-if="editingMessage" class="editing-banner mb-2">
          <div class="alert alert-info d-flex justify-content-between align-items-center py-2 mb-0">
            <span>
              <i class="bi bi-pencil me-2"></i>
              Editing message
            </span>
            <button @click="cancelEdit" class="btn btn-sm btn-outline-info">
              Cancel
            </button>
          </div>
        </div>
        
        <form @submit.prevent="sendMessage" class="d-flex">
          <input
            ref="messageInput"
            type="text"
            class="form-control me-2"
            :placeholder="editingMessage ? 'Edit your message...' : 'Type a message...'"
            v-model="newMessage"
            @input="handleTyping"
            :disabled="!connectionManager.isConnected.value || sendingMessage"
          />
          <button 
            type="submit" 
            class="btn btn-primary"
            :disabled="!newMessage.trim() || !connectionManager.isConnected.value || sendingMessage"
          >
            <span v-if="sendingMessage" class="spinner-border spinner-border-sm me-2" role="status"></span>
            <i v-else class="bi bi-send me-1"></i>
            {{ editingMessage ? 'Update' : 'Send' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Create Room Modal -->
    <div v-if="showCreateRoom" class="modal-overlay" @click="showCreateRoom = false">
      <div class="modal-dialog" @click.stop>
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Create New Room</h5>
            <button @click="showCreateRoom = false" class="btn-close"></button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="createRoom">
              <div class="mb-3">
                <label for="roomName" class="form-label">Room Name</label>
                <input
                  id="roomName"
                  v-model="newRoomData.name"
                  type="text"
                  class="form-control"
                  placeholder="Enter room name"
                  required
                />
              </div>
              <div class="mb-3">
                <label for="roomDescription" class="form-label">Description</label>
                <textarea
                  id="roomDescription"
                  v-model="newRoomData.description"
                  class="form-control"
                  rows="3"
                  placeholder="Enter room description"
                ></textarea>
              </div>
              <div class="mb-3 form-check">
                <input
                  id="roomPrivate"
                  v-model="newRoomData.isPrivate"
                  type="checkbox"
                  class="form-check-input"
                />
                <label for="roomPrivate" class="form-check-label">
                  Private room
                </label>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button @click="showCreateRoom = false" class="btn btn-secondary">
              Cancel
            </button>
            <button @click="createRoom" class="btn btn-primary" :disabled="!newRoomData.name.trim()">
              Create Room
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { useChatService } from './services/chat.service';
import { useSocketService } from './services/socket.service';
import { useConnectionManager } from '../../core/services/connection-manager.service';
import ConnectionStatus from '../../core/components/ConnectionStatus.vue';
import MessageSearch from './components/MessageSearch.vue';
import { format, isToday, isYesterday } from 'date-fns';
import type { 
  ChatRoom, 
  ChatMessage, 
  CreateRoomDto
} from './types/chat-module.types';

interface TypingUser {
  userId: string;
  username: string;
  timestamp: number;
}

export default defineComponent({
  name: 'ChatView',
  components: {
    MessageSearch,
    ConnectionStatus
  },
  setup() {
    const router = useRouter();
    const authStore = useAuthStore();
    const uiStore = useUIStore();
    
    const chatService = useChatService();
    const socketService = useSocketService();
    const connectionManager = useConnectionManager();
    
    // Reactive data
    const newMessage = ref('');
    const messagesContainer = ref<HTMLElement | null>(null);
    const messageInput = ref<HTMLInputElement | null>(null);
    const showSearch = ref(false);
    const showCreateRoom = ref(false);
    
    // Chat data
    const currentRoom = ref<ChatRoom | null>(null);
    const selectedRoomId = ref<string | null>(null);
    const availableRooms = ref<ChatRoom[]>([]);
    const messages = ref<ChatMessage[]>([]);
    const typingUsers = ref<TypingUser[]>([]);
    
    // Loading states
    const loadingRooms = ref(false);
    const loadingMessages = ref(false);
    const sendingMessage = ref(false);
    
    // Error states
    const roomsError = ref<string | null>(null);
    const messagesError = ref<string | null>(null);
    
    // Message editing
    const editingMessage = ref<ChatMessage | null>(null);
    
    // Room creation
    const newRoomData = ref<CreateRoomDto>({
      name: '',
      description: '',
      type: 'public',
      isPrivate: false
    });
    
    // Typing indicator
    const typingTimer = ref<number | null>(null);
    const isTyping = ref(false);
    
    // Initialize connection when component mounts
    onMounted(async () => {
      document.addEventListener('keydown', handleKeydown);
      messageInput.value?.focus();
      
      // Initialize connection
      await connectionManager.connect();
      
      // Load rooms if connected
      if (connectionManager.isConnected.value) {
        await loadRooms();
      }
      
      // Setup WebSocket event handlers
      setupWebSocketHandlers();
    });

    onUnmounted(() => {
      document.removeEventListener('keydown', handleKeydown);
      clearTypingTimer();
      
      // Clean up WebSocket handlers
      if (currentRoom.value) {
        socketService.off('receiveMessage');
        socketService.off('typing');
        socketService.off('userJoined');
        socketService.off('userLeft');
      }
    });
    
    // Watch for connection changes
    watch(() => connectionManager.isConnected.value, async (isConnected) => {
      if (isConnected && availableRooms.value.length === 0) {
        await loadRooms();
      }
    });
    
    // Methods
    const navigateToProfile = () => {
      router.push('/profile');
    };
    
    const handleLogout = async () => {
      try {
        await connectionManager.disconnect();
        await authStore.logout();
        router.push('/login');
      } catch (error) {
        console.error('Logout error:', error);
        // Force logout even if there's an error
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        router.push('/login');
      }
    };
    
    const loadRooms = async () => {
      if (!connectionManager.isConnected.value) {
        roomsError.value = 'Not connected to server';
        return;
      }
      
      loadingRooms.value = true;
      roomsError.value = null;
      
      try {
        const response = await chatService.getRooms({ page: 1, limit: 50 });
        availableRooms.value = response.rooms || [];
      } catch (error) {
        console.error('Failed to load rooms:', error);
        roomsError.value = error instanceof Error ? error.message : 'Failed to load rooms';
      } finally {
        loadingRooms.value = false;
      }
    };
    
    const joinRoom = async (room: ChatRoom) => {
      if (!connectionManager.isConnected.value) {
        return;
      }
      
      try {
        selectedRoomId.value = room.id;
        
        // Leave current room if any
        if (currentRoom.value) {
          await socketService.leaveRoom(currentRoom.value.id);
        }
        
        // Join new room via WebSocket
        await socketService.joinRoom({
          roomId: room.id,
          userId: authStore.currentUser?.id || ''
        });
        
        currentRoom.value = room;
        messages.value = [];
        
        // Load messages for the room
        await loadMessages();
        
        // Focus on message input
        await nextTick();
        messageInput.value?.focus();
        
      } catch (error) {
        console.error('Failed to join room:', error);
        selectedRoomId.value = null;
        messagesError.value = error instanceof Error ? error.message : 'Failed to join room';
      }
    };
    
    const leaveCurrentRoom = async () => {
      if (!currentRoom.value) return;
      
      try {
        await socketService.leaveRoom(currentRoom.value.id);
        currentRoom.value = null;
        selectedRoomId.value = null;
        messages.value = [];
        typingUsers.value = [];
        clearTypingTimer();
      } catch (error) {
        console.error('Failed to leave room:', error);
      }
    };
    
    const loadMessages = async () => {
      if (!currentRoom.value || !connectionManager.isConnected.value) {
        return;
      }
      
      loadingMessages.value = true;
      messagesError.value = null;
      
      try {
        const response = await chatService.getMessages(currentRoom.value.id, { page: 1, limit: 100 });
        messages.value = response.messages || [];
        
        // Scroll to bottom after loading messages
        await nextTick();
        scrollToBottom();
        
      } catch (error) {
        console.error('Failed to load messages:', error);
        messagesError.value = error instanceof Error ? error.message : 'Failed to load messages';
      } finally {
        loadingMessages.value = false;
      }
    };
    
    const sendMessage = async () => {
      if (!newMessage.value.trim() || !currentRoom.value || !connectionManager.isConnected.value) {
        return;
      }
      
      const messageContent = newMessage.value.trim();
      sendingMessage.value = true;
      
      try {
        if (editingMessage.value) {
          // Update existing message
          await chatService.updateMessage(
            currentRoom.value.id,
            editingMessage.value.id,
            messageContent
          );
          
          // Update message in local array
          const messageIndex = messages.value.findIndex(m => m.id === editingMessage.value!.id);
          if (messageIndex !== -1) {
            messages.value[messageIndex].content = messageContent;
            messages.value[messageIndex].editedAt = new Date().toISOString();
          }
          
          cancelEdit();
        } else {
          // Send new message via WebSocket
          await socketService.sendMessage({
            roomId: currentRoom.value.id,
            content: messageContent,
            type: 'text'
          });
        }
        
        // Clear input and stop typing indicator
        newMessage.value = '';
        handleTyping();
        
        // Scroll to bottom
        await nextTick();
        scrollToBottom();
        
      } catch (error) {
        console.error('Failed to send message:', error);
        // TODO: Show error toast
      } finally {
        sendingMessage.value = false;
      }
    };
    
    const editMessage = (message: ChatMessage) => {
      editingMessage.value = message;
      newMessage.value = message.content;
      messageInput.value?.focus();
    };
    
    const cancelEdit = () => {
      editingMessage.value = null;
      newMessage.value = '';
      messageInput.value?.focus();
    };
    
    const deleteMessage = async (message: ChatMessage) => {
      if (!currentRoom.value || !confirm('Are you sure you want to delete this message?')) {
        return;
      }
      
      try {
        await chatService.deleteMessage(currentRoom.value.id, message.id);
        
        // Remove message from local array
        const messageIndex = messages.value.findIndex(m => m.id === message.id);
        if (messageIndex !== -1) {
          messages.value.splice(messageIndex, 1);
        }
        
      } catch (error) {
        console.error('Failed to delete message:', error);
        // TODO: Show error toast
      }
    };
    
    const createRoom = async () => {
      if (!newRoomData.value.name.trim() || !connectionManager.isConnected.value) {
        return;
      }
      
      try {
        const room = await chatService.createRoom(newRoomData.value);
        availableRooms.value.unshift(room);
        
        // Reset form and close modal
        newRoomData.value = {
          name: '',
          description: '',
          isPrivate: false
        };
        showCreateRoom.value = false;
        
        // Join the newly created room
        await joinRoom(room);
        
      } catch (error) {
        console.error('Failed to create room:', error);
        // TODO: Show error toast
      }
    };
    
    const handleTyping = () => {
      if (!currentRoom.value || !connectionManager.isConnected.value) {
        return;
      }
      
      const isCurrentlyTyping = newMessage.value.trim().length > 0;
      
      // Send typing indicator if status changed
      if (isCurrentlyTyping !== isTyping.value) {
        isTyping.value = isCurrentlyTyping;
        
        socketService.sendTyping({
          roomId: currentRoom.value.id,
          isTyping: isCurrentlyTyping
        }).catch(error => {
          console.error('Failed to send typing indicator:', error);
        });
      }
      
      // Clear existing timer
      clearTypingTimer();
      
      // Set timer to stop typing indicator
      if (isCurrentlyTyping) {
        typingTimer.value = window.setTimeout(() => {
          if (isTyping.value) {
            isTyping.value = false;
            socketService.sendTyping({
              roomId: currentRoom.value!.id,
              isTyping: false
            }).catch(error => {
              console.error('Failed to stop typing indicator:', error);
            });
          }
        }, 3000);
      }
    };
    
    const clearTypingTimer = () => {
      if (typingTimer.value) {
        clearTimeout(typingTimer.value);
        typingTimer.value = null;
      }
    };
    
    const scrollToBottom = () => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    };
    
    const formatMessageTime = (timestamp: string): string => {
      const date = new Date(timestamp);
      
      if (isToday(date)) {
        return format(date, 'HH:mm');
      } else if (isYesterday(date)) {
        return `Yesterday ${format(date, 'HH:mm')}`;
      } else {
        return format(date, 'MMM d, HH:mm');
      }
    };
    
    const setupWebSocketHandlers = () => {
      // Handle incoming messages
      socketService.on('message_received', (message: ChatMessage) => {
        if (currentRoom.value && message.roomId === currentRoom.value.id) {
          messages.value.push(message);
          nextTick(() => scrollToBottom());
        }
      });
      
      // Handle typing indicators
      socketService.on('typing_indicator', (data: { userId: string; username: string; isTyping: boolean; roomId: string }) => {
        if (currentRoom.value && data.roomId === currentRoom.value.id) {
          const existingIndex = typingUsers.value.findIndex(u => u.userId === data.userId);
          
          if (data.isTyping) {
            const typingUser: TypingUser = {
              userId: data.userId,
              username: data.username,
              timestamp: Date.now()
            };
            
            if (existingIndex >= 0) {
              typingUsers.value[existingIndex] = typingUser;
            } else {
              typingUsers.value.push(typingUser);
            }
          } else {
            if (existingIndex >= 0) {
              typingUsers.value.splice(existingIndex, 1);
            }
          }
        }
      });
      
      // Handle user join/leave events
      socketService.on('user_joined_room', (data: { userId: string; username: string; roomId: string }) => {
        if (currentRoom.value && data.roomId === currentRoom.value.id) {
          // TODO: Show user joined notification
          console.log(`${data.username} joined the room`);
        }
      });
      
      socketService.on('user_left_room', (data: { userId: string; username: string; roomId: string }) => {
        if (currentRoom.value && data.roomId === currentRoom.value.id) {
          // TODO: Show user left notification
          console.log(`${data.username} left the room`);
          
          // Remove from typing users
          const typingIndex = typingUsers.value.findIndex(u => u.userId === data.userId);
          if (typingIndex >= 0) {
            typingUsers.value.splice(typingIndex, 1);
          }
        }
      });
    };
    
    // Search functionality
    const openSearch = () => {
      showSearch.value = true;
    };

    const closeSearch = () => {
      showSearch.value = false;
      // Refocus on message input after closing search
      setTimeout(() => {
        messageInput.value?.focus();
      }, 100);
    };

    const closeSearchModal = () => {
      closeSearch();
    };

    const handleMessageClick = (messageId: string, roomId: string) => {
      console.log('Navigate to message:', messageId, 'in room:', roomId);
      // TODO: Implement navigation to specific message
      // This could scroll to the message in the current view
      // or switch to the specific room and highlight the message
      closeSearch();
    };

    // Keyboard shortcuts
    const handleKeydown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + F to open search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        if (!showSearch.value) {
          openSearch();
        }
      }
      
      // Escape to close search or cancel edit
      if (event.key === 'Escape') {
        if (showSearch.value) {
          closeSearch();
        } else if (editingMessage.value) {
          cancelEdit();
        }
      }
    };

    return {
      // Reactive data
      newMessage,
      messagesContainer,
      messageInput,
      showSearch,
      showCreateRoom,
      currentRoom,
      selectedRoomId,
      availableRooms,
      messages,
      typingUsers,
      loadingRooms,
      loadingMessages,
      sendingMessage,
      roomsError,
      messagesError,
      editingMessage,
      newRoomData,
      
      // Services
      authStore,
      connectionManager,
      
      // Methods
      navigateToProfile,
      handleLogout,
      loadRooms,
      joinRoom,
      leaveCurrentRoom,
      loadMessages,
      sendMessage,
      editMessage,
      cancelEdit,
      deleteMessage,
      createRoom,
      handleTyping,
      formatMessageTime,
      openSearch,
      closeSearch,
      closeSearchModal,
      handleMessageClick
    };
  }
});
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.chat-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  background-color: #f9f9f9;
}

.chat-input {
  padding: 10px;
}

/* Search Modal Styles */
.search-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 20px;
}

.search-modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
}

@media (max-width: 768px) {
  .search-modal-overlay {
    padding: 10px;
  }
  
  .search-modal {
    max-width: 100%;
    max-height: 95vh;
  }
}
</style>
