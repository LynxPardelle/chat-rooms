/**
 * Chat Store Composable
 * Provides reactive chat state and actions with TypeScript support
 */

import { computed, readonly } from 'vue';
import { useChatStore } from '@/stores/chat';

export function useChat() {
  const chatStore = useChatStore();
  
  // Reactive state - map to actual store properties
  const connectionState = computed(() => chatStore.connectionState);
  const connectionQuality = computed(() => chatStore.connectionQuality);
  const isOnline = computed(() => chatStore.isOnline);
  const isConnected = computed(() => chatStore.isConnected);
  const isReconnecting = computed(() => chatStore.isReconnecting);
  const hasOfflineActions = computed(() => chatStore.hasOfflineActions);
  const failedMessageCount = computed(() => chatStore.failedMessageCount);
  
  // Data properties
  const activeRoom = computed(() => chatStore.activeRoom);
  const activeRoomMessages = computed(() => chatStore.activeRoomMessages);
  const unreadMessageCount = computed(() => chatStore.unreadMessageCount);
  const activeTypingUsers = computed(() => chatStore.activeTypingUsers);
  const onlineUsersList = computed(() => chatStore.onlineUsersList);
  
  // Connection management
  const connect = async () => {
    return await chatStore.connectWebSocket();
  };
  
  const disconnect = () => {
    chatStore.disconnectWebSocket();
  };
  
  // Message operations
  const sendMessage = async (content: string, roomId?: string) => {
    return await chatStore.sendMessage(content, roomId);
  };
  
  // Room operations
  const joinRoom = async (roomId: string) => {
    return await chatStore.joinRoom(roomId);
  };
  
  const leaveRoom = async (roomId: string) => {
    return await chatStore.leaveRoom(roomId);
  };
  
  // Real-time features
  const startTyping = (roomId?: string) => {
    chatStore.startTyping(roomId);
  };
  
  const stopTyping = () => {
    chatStore.stopTyping();
  };
  
  const updatePresence = (status: any, customMessage?: string) => {
    chatStore.updatePresence(status, customMessage);
  };
  
  // Utility
  const syncOfflineActions = async () => {
    return await chatStore.syncOfflineActions();
  };
  
  // Computed helpers for better UX
  const canSendMessage = computed(() => {
    return isConnected.value && activeRoom.value;
  });
  
  const hasUnreadMessages = computed(() => {
    return unreadMessageCount.value > 0;
  });
  
  const connectionStatus = computed(() => {
    if (isReconnecting.value) return 'reconnecting';
    if (isConnected.value) return 'connected';
    if (isOnline.value) return 'online';
    return 'disconnected';
  });
  
  return {
    // State (readonly)
    connectionState: readonly(connectionState),
    connectionQuality: readonly(connectionQuality),
    isOnline: readonly(isOnline),
    isConnected: readonly(isConnected),
    isReconnecting: readonly(isReconnecting),
    hasOfflineActions: readonly(hasOfflineActions),
    failedMessageCount: readonly(failedMessageCount),
    
    // Data
    activeRoom: readonly(activeRoom),
    activeRoomMessages: readonly(activeRoomMessages),
    unreadMessageCount: readonly(unreadMessageCount),
    activeTypingUsers: readonly(activeTypingUsers),
    onlineUsersList: readonly(onlineUsersList),
    
    // Connection management
    connect,
    disconnect,
    
    // Message operations
    sendMessage,
    
    // Room operations
    joinRoom,
    leaveRoom,
    
    // Real-time features
    startTyping,
    stopTyping,
    updatePresence,
    
    // Utility
    syncOfflineActions,
    
    // Computed helpers
    canSendMessage: readonly(canSendMessage),
    hasUnreadMessages: readonly(hasUnreadMessages),
    connectionStatus: readonly(connectionStatus)
  };
}

export type UseChatReturn = ReturnType<typeof useChat>;
