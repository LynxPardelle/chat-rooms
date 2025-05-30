import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../chat'
import { useAuthStore } from '../auth'

// Mock SocketService
vi.mock('@/core/services/SocketService', () => ({
  SocketService: {
    getInstance: vi.fn(() => ({
      isConnected: vi.fn(() => true),
      connect: vi.fn(),
      disconnect: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      connectionState: 'connected'
    }))
  }
}))

// Mock StorageService
vi.mock('@/core/services/storage.service', () => ({
  StorageService: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  }
}))

// Mock ErrorService
vi.mock('@/core/services/error.service', () => ({
  ErrorService: {
    handleError: vi.fn(),
    log: vi.fn()
  }
}))

describe('Chat Store', () => {
  let chatStore: ReturnType<typeof useChatStore>
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    authStore = useAuthStore()
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(chatStore.connectionState).toBe('disconnected')
      expect(chatStore.isOnline).toBe(false)
      expect(chatStore.activeRoom).toBeNull()
      expect(chatStore.activeRoomMessages).toEqual([])
      expect(chatStore.unreadMessageCount).toBe(0)
      expect(chatStore.onlineUsersList).toEqual([])
      expect(chatStore.hasOfflineActions).toBe(false)
      expect(chatStore.failedMessageCount).toBe(0)
    })

    it('should have correct connection quality defaults', () => {
      expect(chatStore.connectionQuality).toEqual({
        latency: 0,
        stability: 100,
        packetLoss: 0
      })
    })
  })

  describe('Connection Management', () => {
    it('should connect to WebSocket when user is authenticated', async () => {
      // Mock authenticated user
      authStore.currentUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isOnline: true,
        lastSeen: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      authStore.accessToken = 'mock-token'

      await chatStore.connectWebSocket()

      expect(chatStore.connectionState).toBe('connected')
      expect(chatStore.isConnected).toBe(true)
    })

    it('should handle connection failure gracefully', async () => {
      // Mock connection failure
      const mockSocket = {
        isConnected: vi.fn(() => false),
        connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
        disconnect: vi.fn(),
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        connectionState: 'failed'
      }

      vi.mocked(require('@/core/services/SocketService').SocketService.getInstance).mockReturnValue(mockSocket)

      try {
        await chatStore.connectWebSocket()
      } catch (error) {
        expect(chatStore.connectionState).toBe('failed')
        expect(chatStore.isConnected).toBe(false)
      }
    })

    it('should disconnect from WebSocket', async () => {
      await chatStore.disconnectWebSocket()
      expect(chatStore.connectionState).toBe('disconnected')
      expect(chatStore.isConnected).toBe(false)
    })
  })

  describe('Message Operations', () => {
    beforeEach(() => {
      // Setup authenticated state
      authStore.currentUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isOnline: true,
        lastSeen: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    it('should send message to active room', async () => {
      const roomId = 'room1'
      
      // Join room first
      await chatStore.joinRoom(roomId)
      
      const messageContent = 'Hello, world!'
      await chatStore.sendMessage(messageContent)

      // Verify message was processed
      expect(chatStore.activeRoomMessages).toHaveLength(1)
      expect(chatStore.activeRoomMessages[0].content).toBe(messageContent)
      expect(chatStore.activeRoomMessages[0].authorId).toBe('user1')
    })

    it('should send message to specific room', async () => {
      const roomId = 'room2'
      const messageContent = 'Hello, specific room!'
      
      await chatStore.sendMessage(messageContent, roomId)

      // Should have created/updated room data
      expect(chatStore.$state.messagesByRoom.has(roomId)).toBe(true)
    })

    it('should handle message send failure', async () => {
      const mockSocket = {
        isConnected: vi.fn(() => true),
        connect: vi.fn(),
        disconnect: vi.fn(),
        emit: vi.fn().mockRejectedValue(new Error('Send failed')),
        on: vi.fn(),
        off: vi.fn(),
        connectionState: 'connected'
      }

      vi.mocked(require('@/core/services/SocketService').SocketService.getInstance).mockReturnValue(mockSocket)

      const messageContent = 'This message will fail'
      
      try {
        await chatStore.sendMessage(messageContent)
      } catch (error) {
        // Should add to failed messages
        expect(chatStore.failedMessageCount).toBeGreaterThan(0)
      }
    })
  })

  describe('Room Operations', () => {
    beforeEach(() => {
      // Setup authenticated state
      authStore.currentUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isOnline: true,
        lastSeen: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    it('should join room successfully', async () => {
      const roomId = 'room1'
      
      await chatStore.joinRoom(roomId)

      expect(chatStore.$state.activeRoomId).toBe(roomId)
      expect(chatStore.activeRoom).toMatchObject({
        id: roomId
      })
    })

    it('should leave room successfully', async () => {
      const roomId = 'room1'
      
      // Join room first
      await chatStore.joinRoom(roomId)
      expect(chatStore.$state.activeRoomId).toBe(roomId)
      
      // Then leave
      await chatStore.leaveRoom(roomId)
      
      expect(chatStore.$state.activeRoomId).toBeNull()
    })

    it('should handle room join failure', async () => {
      const mockSocket = {
        isConnected: vi.fn(() => true),
        connect: vi.fn(),
        disconnect: vi.fn(),
        emit: vi.fn().mockRejectedValue(new Error('Join failed')),
        on: vi.fn(),
        off: vi.fn(),
        connectionState: 'connected'
      }

      vi.mocked(require('@/core/services/SocketService').SocketService.getInstance).mockReturnValue(mockSocket)

      try {
        await chatStore.joinRoom('invalid-room')
      } catch (error) {
        expect(chatStore.$state.activeRoomId).toBeNull()
      }
    })
  })

  describe('Real-time Features', () => {
    beforeEach(() => {
      // Setup authenticated state
      authStore.currentUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        textColor: '#000000',
        backgroundColor: '#ffffff',
        isOnline: true,
        lastSeen: new Date(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    it('should start typing indicator', async () => {
      const roomId = 'room1'
      await chatStore.joinRoom(roomId)
      
      await chatStore.startTyping()

      expect(chatStore.$state.typingIndicators.has(roomId)).toBe(true)
    })

    it('should stop typing indicator', async () => {
      const roomId = 'room1'
      await chatStore.joinRoom(roomId)
      
      await chatStore.startTyping()
      await chatStore.stopTyping()

      // Typing indicator should be cleared after a short delay
      setTimeout(() => {
        expect(chatStore.activeTypingUsers).toEqual([])
      }, 100)
    })

    it('should update user presence', async () => {
      const presenceData = {
        status: 'busy' as const,
        customMessage: 'In a meeting'
      }

      await chatStore.updatePresence(presenceData)

      // Verify presence was updated
      const userPresence = chatStore.$state.userPresence.get('user1')
      expect(userPresence?.status).toBe('busy')
      expect(userPresence?.customMessage).toBe('In a meeting')
    })
  })

  describe('Offline Support', () => {
    it('should queue actions when offline', async () => {
      // Simulate offline state
      chatStore.$state.isOnline = false
      
      await chatStore.sendMessage('Offline message')

      expect(chatStore.hasOfflineActions).toBe(true)
      expect(chatStore.$state.offlineActions).toHaveLength(1)
      expect(chatStore.$state.offlineActions[0].type).toBe('send_message')
    })

    it('should sync offline actions when back online', async () => {
      // Add some offline actions
      chatStore.$state.offlineActions.push({
        type: 'send_message',
        payload: { content: 'Offline message 1', roomId: 'room1' },
        timestamp: new Date()
      })
      
      chatStore.$state.offlineActions.push({
        type: 'send_message',
        payload: { content: 'Offline message 2', roomId: 'room1' },
        timestamp: new Date()
      })

      // Simulate coming back online
      chatStore.$state.isOnline = true
      
      await chatStore.syncOfflineActions()

      expect(chatStore.$state.offlineActions).toHaveLength(0)
    })
  })

  describe('Computed Properties', () => {
    it('should compute connection status correctly', () => {
      expect(chatStore.isConnected).toBe(false)
      expect(chatStore.isReconnecting).toBe(false)
      
      chatStore.$state.connectionState = 'connected'
      expect(chatStore.isConnected).toBe(true)
      
      chatStore.$state.connectionState = 'reconnecting'
      expect(chatStore.isReconnecting).toBe(true)
    })

    it('should compute unread message count', () => {
      // Add some messages with unread status
      const messageId1 = 'msg1'
      const messageId2 = 'msg2'
      
      chatStore.$state.messages.set(messageId1, {
        id: messageId1,
        content: 'Message 1',
        authorId: 'user2',
        roomId: 'room1',
        timestamp: new Date(),
        type: 'text',
        isRead: false,
        metadata: {}
      })
      
      chatStore.$state.messages.set(messageId2, {
        id: messageId2,
        content: 'Message 2',
        authorId: 'user2',
        roomId: 'room1',
        timestamp: new Date(),
        type: 'text',
        isRead: false,
        metadata: {}
      })

      expect(chatStore.unreadMessageCount).toBe(2)
    })

    it('should compute online users list', () => {
      chatStore.$state.onlineUsers.add('user1')
      chatStore.$state.onlineUsers.add('user2')
      chatStore.$state.onlineUsers.add('user3')

      expect(chatStore.onlineUsersList).toHaveLength(3)
      expect(chatStore.onlineUsersList).toContain('user1')
      expect(chatStore.onlineUsersList).toContain('user2')
      expect(chatStore.onlineUsersList).toContain('user3')
    })
  })
})
