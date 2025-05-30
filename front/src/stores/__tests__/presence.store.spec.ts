import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePresenceStore } from '../presence'

// Mock auth store
vi.mock('../auth', () => ({
  useAuthStore: vi.fn(() => ({
    user: {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      avatar: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    isAuthenticated: true,
    currentUser: {
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      avatar: undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }))
}))

// Create mock socket instance
const mockSocketInstance = {
  emit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
}

// Mock SocketService
vi.mock('@/core/services/SocketService', () => {
  const mockSocketService = {
    getInstance: vi.fn(() => mockSocketInstance),
  }
  return { SocketService: mockSocketService }
})

// Mock WebSocket events
vi.mock('@/core/types/enhanced-api.types', () => ({
  WebSocketEvent: {
    USER_PRESENCE_UPDATE: 'userPresenceUpdate',
    USER_START_TYPING: 'userStartTyping', 
    USER_STOP_TYPING: 'userStopTyping',
    PRESENCE_UPDATED: 'presenceUpdated',
    TYPING_INDICATOR_UPDATED: 'typingIndicatorUpdated',
  }
}))

describe('Presence Store', () => {
  let mockSocket: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()    // Use the mock socket instance
    mockSocket = mockSocketInstance
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = usePresenceStore()
      
      expect(store.state.ownStatus).toBe('online')
      expect(store.state.ownCustomMessage).toBe('')
      expect(store.state.autoAwayEnabled).toBe(true)
      expect(store.state.autoAwayDelay).toBe(300000) // 5 minutes
      expect(store.isOnline).toBe(true)
      expect(store.onlineUsersCount).toBe(0)
    })
  })

  describe('Presence Management', () => {    it('should update own presence status', async () => {
      const store = usePresenceStore()
      
      await store.updateOwnPresence('busy', 'In a meeting')
      
      expect(store.state.ownStatus).toBe('busy')
      expect(store.state.ownCustomMessage).toBe('In a meeting')
      expect(store.isBusy).toBe(true)
      expect(store.isOnline).toBe(false)
      expect(mockSocket.emit).toHaveBeenCalledWith('userPresenceUpdate', {
        status: 'busy',
        customMessage: 'In a meeting'
      })
    })

    it('should provide convenience methods for status changes', async () => {
      const store = usePresenceStore()
      
      await store.setAway('Be right back')
      expect(store.state.ownStatus).toBe('away')
      expect(store.isAway).toBe(true)
      
      await store.setBusy('Do not disturb')
      expect(store.state.ownStatus).toBe('busy')
      expect(store.isBusy).toBe(true)
      
      await store.setOffline()
      expect(store.state.ownStatus).toBe('offline')
      expect(store.isOffline).toBe(true)
      
      await store.setOnline()
      expect(store.state.ownStatus).toBe('online')
      expect(store.isOnline).toBe(true)
    })

    it('should handle presence updates from other users', () => {
      const store = usePresenceStore()
      
      const presenceData = {
        userId: 'user-456',
        username: 'otheruser',
        status: 'online' as const,
        lastSeen: '2024-01-01T10:00:00Z',
        customMessage: 'Available'
      }
      
      store.handlePresenceUpdate(presenceData)
      
      const userPresence = store.getUserPresence('user-456').value
      expect(userPresence?.status).toBe('online')
      expect(userPresence?.username).toBe('otheruser')
      expect(userPresence?.customMessage).toBe('Available')
      expect(store.state.onlineUsers.has('user-456')).toBe(true)
    })

    it('should remove user from online set when they go offline', () => {
      const store = usePresenceStore()
      
      // User comes online
      store.handlePresenceUpdate({
        userId: 'user-456',
        username: 'otheruser',
        status: 'online',
        lastSeen: '2024-01-01T10:00:00Z'
      })
      
      expect(store.state.onlineUsers.has('user-456')).toBe(true)
      
      // User goes offline
      store.handlePresenceUpdate({
        userId: 'user-456',
        username: 'otheruser',
        status: 'offline',
        lastSeen: '2024-01-01T10:05:00Z'
      })
      
      expect(store.state.onlineUsers.has('user-456')).toBe(false)
    })
  })

  describe('Typing Indicators', () => {
    it('should start and stop typing', async () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      await store.startTyping(roomId)
        expect(mockSocket.emit).toHaveBeenCalledWith('userStartTyping', {
        roomId,
        userId: 'user-123'
      })
    })

    it('should auto-stop typing after timeout', async () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      await store.startTyping(roomId)
      
      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000)
        expect(mockSocket.emit).toHaveBeenCalledWith('userStopTyping', {
        roomId,
        userId: 'user-123'
      })
    })

    it('should handle typing indicators from other users', () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      const typingData = {
        roomId,
        userId: 'user-456',
        username: 'otheruser',
        isTyping: true,
        timestamp: Date.now()
      }
      
      store.handleTypingIndicator(typingData)
      
      const typingUsers = store.getTypingIndicatorsForRoom(roomId).value
      expect(typingUsers).toHaveLength(1)
      expect(typingUsers[0].userId).toBe('user-456')
      expect(typingUsers[0].username).toBe('otheruser')
    })

    it('should remove typing indicator when user stops typing', () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      // User starts typing
      store.handleTypingIndicator({
        roomId,
        userId: 'user-456',
        username: 'otheruser',
        isTyping: true,
        timestamp: Date.now()
      })
      
      expect(store.getTypingIndicatorsForRoom(roomId).value).toHaveLength(1)
      
      // User stops typing
      store.handleTypingIndicator({
        roomId,
        userId: 'user-456',
        username: 'otheruser',
        isTyping: false,
        timestamp: Date.now()
      })
      
      expect(store.getTypingIndicatorsForRoom(roomId).value).toHaveLength(0)
    })

    it('should filter out expired typing indicators', () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      // Add typing indicator with old timestamp
      store.handleTypingIndicator({
        roomId,
        userId: 'user-456',
        username: 'otheruser',
        isTyping: true,
        timestamp: Date.now() - 10000 // 10 seconds ago
      })
      
      // Should be filtered out as expired (> 5 seconds)
      expect(store.getTypingIndicatorsForRoom(roomId).value).toHaveLength(0)
    })

    it('should filter out own typing indicators', () => {
      const store = usePresenceStore()
      const roomId = 'room-123'
      
      // Add own typing indicator
      store.handleTypingIndicator({
        roomId,
        userId: 'user-123', // Same as auth store user
        username: 'testuser',
        isTyping: true,
        timestamp: Date.now()
      })
      
      // Should be filtered out as it's own typing
      expect(store.getTypingIndicatorsForRoom(roomId).value).toHaveLength(0)
    })
  })

  describe('Activity Tracking', () => {
    it('should update activity timestamp', () => {
      const store = usePresenceStore()
      const initialTime = store.state.lastActivityTime
      
      vi.advanceTimersByTime(1000)
      store.updateActivity()
      
      expect(store.state.lastActivityTime).toBeGreaterThan(initialTime)
    })

    it('should set back to online when activity detected while away', async () => {
      const store = usePresenceStore()
      
      // Set to away
      await store.setAway('Away due to inactivity')
      expect(store.state.ownStatus).toBe('away')
      
      // Simulate activity
      store.updateActivity()
      
      // Should be set back to online
      expect(store.state.ownStatus).toBe('online')
    })

    it('should automatically set to away after inactivity', async () => {
      const store = usePresenceStore()
      
      // Start activity tracking
      store.startActivityTracking()      
      // Fast-forward past auto-away delay (5 minutes)
      vi.advanceTimersByTime(300000 + 60000) // 5 minutes + 1 minute check interval
      
      expect(store.state.ownStatus).toBe('away')
      expect(mockSocket.emit).toHaveBeenCalledWith('userPresenceUpdate', {
        status: 'away',
        customMessage: 'Away due to inactivity'
      })
      
      store.stopActivityTracking()
    })
  })

  describe('Online Users', () => {
    it('should track online users list', () => {
      const store = usePresenceStore()
      
      // Add multiple users
      store.handlePresenceUpdate({
        userId: 'user-1',
        username: 'user1',
        status: 'online',
        lastSeen: '2024-01-01T10:00:00Z'
      })
      
      store.handlePresenceUpdate({
        userId: 'user-2',
        username: 'user2',
        status: 'online',
        lastSeen: '2024-01-01T10:00:00Z'
      })
      
      store.handlePresenceUpdate({
        userId: 'user-3',
        username: 'user3',
        status: 'away',
        lastSeen: '2024-01-01T10:00:00Z'
      })
      
      expect(store.onlineUsersCount).toBe(2)
      expect(store.onlineUsersList).toHaveLength(2)
      expect(store.onlineUsersList.map(u => u?.username)).toEqual(['user1', 'user2'])
    })
  })

  describe('Lifecycle Management', () => {
    it('should initialize properly', () => {
      const store = usePresenceStore()
      
      store.initialize()
        expect(mockSocket.on).toHaveBeenCalledWith('presenceUpdated', expect.any(Function))
      expect(mockSocket.on).toHaveBeenCalledWith('typingIndicatorUpdated', expect.any(Function))
      expect(mockSocket.emit).toHaveBeenCalledWith('userPresenceUpdate', {
        status: 'online'
      })
    })

    it('should cleanup properly', () => {
      const store = usePresenceStore()
      
      // Add some state
      store.handlePresenceUpdate({
        userId: 'user-1',
        username: 'user1',
        status: 'online',
        lastSeen: '2024-01-01T10:00:00Z'
      })
      
      store.handleTypingIndicator({
        roomId: 'room-1',
        userId: 'user-1',
        username: 'user1',
        isTyping: true,
        timestamp: Date.now()
      })
      
      store.cleanup()
      
      expect(store.state.userPresence.size).toBe(0)
      expect(store.state.typingIndicators.size).toBe(0)
      expect(store.state.onlineUsers.size).toBe(0)
    })

    it('should destroy properly', () => {
      const store = usePresenceStore()
      
      store.destroy()
      
      expect(mockSocket.off).toHaveBeenCalledWith('presenceUpdated', expect.any(Function))
      expect(mockSocket.off).toHaveBeenCalledWith('typingIndicatorUpdated', expect.any(Function))
    })
  })
})
