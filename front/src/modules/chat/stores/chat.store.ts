/**
 * Chat Store - Pinia State Management for Chat Module
 * 
 * This store manages all chat-related state including messages, rooms, users,
 * connection status, and UI state. It provides a centralized way to handle
 * real-time chat functionality with proper type safety and reactive updates.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 * @updated 2024-12-27
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import type { User } from '@/types';

// Types
import type {
  ChatRoom,
  ChatMessage,
  ChatUser,
  MessageInputState,
  ChatErrorState,
  ConnectionState,
  ChatLoadingState,
  ChatUIConfig,
  NotificationPreferences,
} from '../types/chat-module.types';

// Services
import { SocketService } from '../services/socket.service';
import { ChatService } from '../services/chat.service';

export const useChatStore = defineStore('chat', () => {
  // =============================================================================
  // SERVICES
  // =============================================================================
  
  const authStore = useAuthStore();
  const socketService = new SocketService();
  const chatService = new ChatService();

  // =============================================================================
  // STATE
  // =============================================================================

  // Connection State
  const isConnected = ref(false);
  const isConnecting = ref(false);
  const isReconnecting = ref(false);
  const lastConnected = ref<Date | null>(null);
  const reconnectAttempts = ref(0);

  // Data State
  const currentRoomId = ref<string | null>(null);
  const rooms = ref<ChatRoom[]>([]);
  const messages = ref<ChatMessage[]>([]);
  const tempMessages = ref<ChatMessage[]>([]);
  const users = ref<ChatUser[]>([]);
  const typingUsers = ref<Set<string>>(new Set());

  // Loading States
  const isLoadingRooms = ref(false);
  const isLoadingMessages = ref(false);
  const isSendingMessage = ref(false);
  const isJoiningRoom = ref(false);
  const isLoadingUsers = ref(false);

  // Error States
  const connectionError = ref<string | null>(null);
  const roomsError = ref<string | null>(null);
  const messagesError = ref<string | null>(null);
  const sendMessageError = ref<string | null>(null);
  const joinRoomError = ref<string | null>(null);
  const usersError = ref<string | null>(null);  // Additional loading states
  const isUploadingFile = ref(false);
  
  // Additional error states  
  const fileUploadError = ref<string | null>(null);
  
  // Connection latency
  const latency = ref<number | null>(null);

  // UI State - mutable version for store
  const messageInputData = ref({
    content: '',
    isTyping: false,
    attachments: [] as File[],
    replyTo: null as ChatMessage | null,
    mentions: [] as ChatUser[],
    uploadProgress: {} as Record<string, number>
  });

  // Pagination
  const roomsPagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  });

  const messagesPagination = ref({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  });

  // UI Configuration - mutable version
  const uiConfigData = ref({
    theme: 'light' as const,
    showTimestamps: true,
    showUserAvatars: true,
    enableSounds: true,
    enableNotifications: true,
    messageGroupingTimeout: 5,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFileTypes: ['image/*', 'text/*', 'application/pdf'],
    messagesPerPage: 50
  });

  // Notification Preferences - mutable version
  const notificationData = ref({
    enabled: true,
    sound: true,
    desktop: true,
    mentions: true,
    directMessages: true,
    keywords: [] as string[]
  });

  // =============================================================================
  // COMPUTED PROPERTIES
  // =============================================================================

  const currentRoom = computed((): ChatRoom | null => {
    return currentRoomId.value 
      ? rooms.value.find(room => room.id === currentRoomId.value) || null
      : null;
  });

  const sortedMessages = computed((): ChatMessage[] => {
    return [...messages.value].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  const allMessages = computed((): ChatMessage[] => {
    return [...sortedMessages.value, ...tempMessages.value];
  });

  const onlineUsers = computed((): ChatUser[] => {
    return users.value.filter(user => user.isOnline);
  });
  const connectionState = computed((): ConnectionState => ({
    isConnected: isConnected.value,
    isConnecting: isConnecting.value,
    isReconnecting: isReconnecting.value,
    lastConnected: lastConnected.value,
    reconnectAttempts: reconnectAttempts.value,
    latency: latency.value
  }));

  const loadingState = computed((): ChatLoadingState => ({
    rooms: isLoadingRooms.value,
    messages: isLoadingMessages.value,
    sendingMessage: isSendingMessage.value,
    joiningRoom: isJoiningRoom.value,
    users: isLoadingUsers.value,
    uploadingFile: isUploadingFile.value
  }));

  const errorState = computed((): ChatErrorState => ({
    connection: connectionError.value,
    rooms: roomsError.value,
    messages: messagesError.value,
    sendMessage: sendMessageError.value,
    joinRoom: joinRoomError.value,
    users: usersError.value,
    fileUpload: fileUploadError.value
  }));
  const metrics = computed(() => ({
    totalRooms: rooms.value.length,
    totalMessages: messages.value.length,
    onlineUsers: onlineUsers.value.length,
    unreadMessages: 0 // Simplified since ChatMessage doesn't have isRead property
  }));

  const messageInput = computed(() => messageInputData.value);
  const uiConfig = computed(() => uiConfigData.value);
  const notificationPreferences = computed(() => notificationData.value);

  // =============================================================================
  // ACTIONS
  // =============================================================================

  /**
   * Initialize WebSocket connection
   */
  const connect = async (): Promise<void> => {
    try {
      isConnecting.value = true;
      connectionError.value = null;

      await socketService.connect();

      isConnected.value = true;
      lastConnected.value = new Date();
      reconnectAttempts.value = 0;
      isConnecting.value = false;

      setupSocketListeners();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      connectionError.value = message;
      console.error('Failed to connect to chat:', error);
    } finally {
      isConnecting.value = false;
    }
  };

  /**
   * Disconnect from WebSocket
   */
  const disconnect = (): void => {
    socketService.disconnect();
    isConnected.value = false;
    isReconnecting.value = false;
  };

  /**
   * Handle WebSocket reconnection
   */
  const handleReconnection = (): void => {
    if (isConnected.value) {
      isConnected.value = true;
      isReconnecting.value = false;
      connectionError.value = null;
    } else {
      isConnected.value = false;
      if (reconnectAttempts.value < 5) {
        isReconnecting.value = true;
        reconnectAttempts.value++;
        // Reconnection logic handled by socket service
      }
    }
  };

  /**
   * Setup WebSocket event listeners
   */
  const setupSocketListeners = (): void => {
    socketService.on('message', (message: ChatMessage) => {
      addMessage(message);
    });

    socketService.on('userJoined', (user: ChatUser) => {
      if (!users.value.find(u => u.id === user.id)) {
        users.value.push(user);
      }
    });

    socketService.on('userLeft', (userId: string) => {
      users.value = users.value.filter(u => u.id !== userId);
    });

    socketService.on('typing', (data: { userId: string; isTyping: boolean }) => {
      if (data.isTyping) {
        typingUsers.value.add(data.userId);
      } else {
        typingUsers.value.delete(data.userId);
      }
    });
  };

  /**
   * Load available chat rooms
   */
  const loadRooms = async (): Promise<void> => {
    try {
      isLoadingRooms.value = true;
      roomsError.value = null;

      const response = await chatService.getRooms({
        page: roomsPagination.value.page,
        limit: roomsPagination.value.limit
      });      if (response.rooms) {
        rooms.value = response.rooms;
        if (response.pagination) {
          roomsPagination.value = {
            page: response.pagination.page,
            limit: response.pagination.limit,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load rooms';
      roomsError.value = message;
      console.error('Failed to load rooms:', error);
    } finally {
      isLoadingRooms.value = false;
    }
  };

  /**
   * Join a chat room
   */
  const joinRoom = async (roomId: string): Promise<void> => {
    try {
      isJoiningRoom.value = true;
      joinRoomError.value = null;

      await socketService.joinRoom({ roomId });
      currentRoomId.value = roomId;

      // Load room messages and users
      await Promise.all([
        loadMessages(roomId),
        loadUsers(roomId)
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join room';
      joinRoomError.value = message;
      console.error('Failed to join room:', error);
    } finally {
      isJoiningRoom.value = false;
    }
  };

  /**
   * Leave current room
   */
  const leaveRoom = async (): Promise<void> => {
    if (currentRoomId.value) {
      await socketService.leaveRoom(currentRoomId.value);
      currentRoomId.value = null;
      messages.value = [];
      users.value = [];
      tempMessages.value = [];
    }
  };

  /**
   * Load messages for a room
   */
  const loadMessages = async (roomId: string, options?: { page?: number; limit?: number }): Promise<void> => {
    try {
      isLoadingMessages.value = true;
      messagesError.value = null;

      const response = await chatService.getMessages(roomId, {
        page: options?.page || messagesPagination.value.page,
        limit: options?.limit || messagesPagination.value.limit
      });      if (response.messages) {
        if (options?.page === 1) {
          messages.value = response.messages;
        } else {
          messages.value = [...messages.value, ...response.messages];
        }

        if (response.pagination) {
          messagesPagination.value = {
            page: response.pagination.page,
            limit: response.pagination.limit,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load messages';
      messagesError.value = message;
      console.error('Failed to load messages:', error);
    } finally {
      isLoadingMessages.value = false;
    }
  };

  /**
   * Send a message
   */
  const sendMessage = async (content: string, roomId?: string): Promise<void> => {
    const targetRoomId = roomId || currentRoomId.value;
    if (!targetRoomId || !content.trim()) return;

    try {
      isSendingMessage.value = true;
      sendMessageError.value = null;      // Create temporary message for optimistic UI
      const tempId = `temp_${Date.now()}`;
      const tempMessage: ChatMessage = {
        id: tempId,
        content: content.trim(),        userId: (authStore.user as User | null)?.id || '',
        username: (authStore.user as User | null)?.username || 'Unknown',
        roomId: targetRoomId,
        messageType: 'text',
        status: 'sending',
        attachments: [],
        userColors: {
          textColor: '#000000',
          backgroundColor: '#f0f0f0'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        isOwn: true,
        metadata: {
          edited: false,
          replyTo: messageInput.value.replyTo?.id,
          mentions: messageInput.value.mentions?.map(user => user.id) || [],
          reactions: [],
          readBy: [],
          deliveredTo: []
        }
      };

      tempMessages.value.push(tempMessage);      // Send message via socket
      await socketService.sendMessage({
        content: content.trim(),
        roomId: targetRoomId,
        messageType: 'text',
        attachments: [], // Convert File[] if needed
        replyTo: messageInput.value.replyTo?.id,
        mentions: messageInput.value.mentions?.map(user => user.id) || []
      });

      // Clear input
      messageInput.value.content = '';
      messageInput.value.attachments = [];
      messageInput.value.replyTo = null;
      messageInput.value.mentions = [];

      // Remove temp message on success (real message will come via socket)
      tempMessages.value = tempMessages.value.filter(msg => msg.id !== tempId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      sendMessageError.value = message;
      console.error('Failed to send message:', error);

      // Remove temp message on error
      if (tempMessages.value.length > 0) {
        const lastTempId = tempMessages.value[tempMessages.value.length - 1].id;
        tempMessages.value = tempMessages.value.filter(msg => msg.id !== lastTempId);
      }
    } finally {
      isSendingMessage.value = false;
    }
  };

  /**
   * Load users in current room
   */
  const loadUsers = async (roomId?: string): Promise<void> => {
    const targetRoomId = roomId || currentRoomId.value;
    if (!targetRoomId) return;

    try {
      isLoadingUsers.value = true;
      usersError.value = null;

      users.value = (await chatService.getRoomUsers(targetRoomId)).users;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      usersError.value = message;
      console.error('Failed to load users:', error);
    } finally {
      isLoadingUsers.value = false;
    }
  };

  /**
   * Add a message to the store
   */
  const addMessage = (message: ChatMessage): void => {
    // Remove any temp message that might correspond to this real message
    tempMessages.value = tempMessages.value.filter(temp => 
      temp.content !== message.content || 
      temp.userId !== message.userId
    );

    // Add the real message
    if (!messages.value.find(m => m.id === message.id)) {
      messages.value.push(message);
    }
  };

  /**
   * Update message input state
   */
  const updateMessageInput = (updates: Partial<MessageInputState>): void => {
    Object.assign(messageInput.value, updates);
  };

  /**
   * Set typing indicator
   */
  const setTyping = async (isTyping: boolean): Promise<void> => {
    if (!currentRoomId.value) return;

    messageInput.value.isTyping = isTyping;    try {
      await socketService.sendTyping({
        roomId: currentRoomId.value!,
        isTyping
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  };

  /**
   * Update UI configuration
   */
  const updateUIConfig = (updates: Partial<ChatUIConfig>): void => {
    Object.assign(uiConfig.value, updates);
  };

  /**
   * Update notification preferences
   */
  const updateNotificationPreferences = (updates: Partial<NotificationPreferences>): void => {
    Object.assign(notificationPreferences.value, updates);
  };

  /**
   * Clear all chat data
   */
  const clearChatData = (): void => {
    currentRoomId.value = null;
    rooms.value = [];
    messages.value = [];
    tempMessages.value = [];
    users.value = [];
    typingUsers.value.clear();
    
    // Reset pagination
    roomsPagination.value = { page: 1, limit: 20, total: 0, hasMore: false };
    messagesPagination.value = { page: 1, limit: 50, total: 0, hasMore: false };
    
    // Clear errors
    connectionError.value = null;
    roomsError.value = null;
    messagesError.value = null;
    sendMessageError.value = null;
    joinRoomError.value = null;
    usersError.value = null;
  };

  /**
   * Reset store to initial state
   */
  const reset = (): void => {
    disconnect();
    clearChatData();    // Reset input
    messageInputData.value = {
      content: '',
      isTyping: false,
      attachments: [],
      replyTo: null,
      mentions: [],
      uploadProgress: {}
    };
  };

  // =============================================================================
  // RETURN STORE INTERFACE
  // =============================================================================

  return {
    // State
    isConnected,
    isConnecting,
    isReconnecting,
    lastConnected,
    reconnectAttempts,
    currentRoomId,
    rooms,
    messages,
    tempMessages,
    users,
    typingUsers,
    messageInput,
    roomsPagination,
    messagesPagination,
    uiConfig,
    notificationPreferences,
    
    // Computed
    currentRoom,
    sortedMessages,
    allMessages,
    onlineUsers,
    connectionState,
    loadingState,
    errorState,
    metrics,
    
    // Actions
    connect,
    disconnect,
    handleReconnection,
    setupSocketListeners,
    loadRooms,
    joinRoom,
    leaveRoom,
    loadMessages,
    sendMessage,
    loadUsers,
    addMessage,
    updateMessageInput,
    setTyping,
    updateUIConfig,
    updateNotificationPreferences,
    clearChatData,
    reset
  };
});
