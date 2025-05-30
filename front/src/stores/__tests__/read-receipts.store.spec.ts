import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReadReceiptsStore } from '../read-receipts'
import { useAuthStore } from '../auth'

// Mock SocketService - inline all in the mock function to avoid hoisting issues
vi.mock('@/core/services/SocketService', () => {
  const mockSocketInstance = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true)
  }

  return {
    SocketService: {
      getInstance: vi.fn(() => mockSocketInstance)
    }
  }
})

// Mock browser APIs
class MockNotification {
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))
  
  title: string
  options?: NotificationOptions
  
  constructor(title: string, options?: NotificationOptions) {
    this.title = title
    this.options = options
  }
  
  close = vi.fn()
  onclick: ((this: Notification, ev: Event) => any) | null = null
}

global.Notification = MockNotification as any

global.Audio = class MockAudio {
  volume = 1
  play = vi.fn(() => Promise.resolve())
  src?: string
  constructor(src?: string) {
    this.src = src
  }
} as any

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage })

describe('Read Receipts Store', () => {
  let store: ReturnType<typeof useReadReceiptsStore>
  let authStore: ReturnType<typeof useAuthStore>
  let mockSocketInstance: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    
    // Get mock socket instance from the mock
    const { SocketService } = await import('@/core/services/SocketService')
    mockSocketInstance = SocketService.getInstance()
    
    // Reset notification permission
    Object.defineProperty(MockNotification, 'permission', {
      value: 'default',
      writable: true,
      configurable: true
    })
      // Setup stores
    authStore = useAuthStore()
    // Mock the user data using vi.mocked
    Object.defineProperty(authStore, 'user', {
      value: {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        avatar: '',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      writable: true,
      configurable: true
    })
    
    store = useReadReceiptsStore()
    vi.clearAllMocks()
  })

  describe('State Management', () => {
    it('should initialize with default state', () => {
      expect(store.state.messageReadStatus).toBeInstanceOf(Map)
      expect(store.state.readReceipts).toBeInstanceOf(Map)
      expect(store.state.notifications).toBeInstanceOf(Map)
      expect(store.state.unreadNotifications).toBeInstanceOf(Set)
      expect(store.state.showReadReceipts).toBe(true)
      expect(store.state.notificationSettings.soundEnabled).toBe(true)
      expect(store.state.notificationSettings.desktopEnabled).toBe(true)
    })

    it('should have correct computed properties', () => {
      expect(store.unreadNotificationCount).toBe(0)
      expect(store.hasUnreadNotifications).toBe(false)
      expect(store.recentNotifications).toEqual([])
    })
  })

  describe('Read Receipts Management', () => {
    it('should mark message as read', async () => {
      const messageId = 'msg-123'
      const roomId = 'room-456'
      
      await store.markMessageAsRead(messageId, roomId)
        expect(mockSocketInstance.emit).toHaveBeenCalledWith(
        'messageRead',
        {
          messageId,
          roomId,
          userId: 'user-123'
        }
      )
    })

    it('should handle read receipt updates', () => {
      const receiptData = {
        messageId: 'msg-123',
        roomId: 'room-456',
        userId: 'user-2',
        username: 'testuser2',
        readAt: '2024-01-01T10:05:00Z'
      }
      
      store.handleReadReceiptUpdate(receiptData)
      
      const receipts = store.state.readReceipts.get('msg-123')
      expect(receipts).toHaveLength(1)
      expect(receipts?.[0]).toEqual(receiptData)
    })

    it('should get message read status', () => {
      const messageId = 'msg-123'
      const getter = store.getMessageReadStatus(messageId)
      
      expect(getter.value).toBeUndefined()
    })
  })

  describe('Notifications Management', () => {
    it('should handle notification received', () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-123',
        type: 'message' as const,
        title: 'New Message',
        body: 'You have a new message',
        createdAt: '2024-01-01T10:00:00Z'
      }
      
      store.handleNotificationReceived(notification)
      
      expect(store.state.notifications.has('notif-1')).toBe(true)
      expect(store.state.unreadNotifications.has('notif-1')).toBe(true)
      expect(store.unreadNotificationCount).toBe(1)
    })

    it('should mark notification as read', () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-123',
        type: 'message' as const,
        title: 'New Message',
        body: 'You have a new message',
        createdAt: '2024-01-01T10:00:00Z'
      }
      
      store.handleNotificationReceived(notification)
      store.markNotificationAsRead('notif-1')
      
      expect(store.state.unreadNotifications.has('notif-1')).toBe(false)
      const stored = store.state.notifications.get('notif-1')
      expect(stored?.read).toBe(true)
    })

    it('should mark notification as dismissed', () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-123',
        type: 'message' as const,
        title: 'New Message',
        body: 'You have a new message',
        createdAt: '2024-01-01T10:00:00Z'
      }
      
      store.handleNotificationReceived(notification)
      store.markNotificationAsDismissed('notif-1')
      
      expect(store.state.unreadNotifications.has('notif-1')).toBe(false)
      const stored = store.state.notifications.get('notif-1')
      expect(stored?.dismissed).toBe(true)
    })

    it('should handle notification priority levels', () => {
      store.handleNotificationReceived({
        id: 'notif-urgent',
        userId: 'user-123',
        type: 'mention',
        title: 'Urgent',
        body: 'Urgent message',
        createdAt: '2024-01-01T10:00:00Z'
      })
      
      store.handleNotificationReceived({
        id: 'notif-normal',
        userId: 'user-123',
        type: 'message',
        title: 'Normal',
        body: 'Normal message',
        createdAt: '2024-01-01T09:00:00Z'
      })
      
      expect(store.recentNotifications).toHaveLength(2)
      expect(store.recentNotifications[0].id).toBe('notif-urgent')
    })

    it('should clear all notifications', () => {
      store.handleNotificationReceived({
        id: 'notif-1',
        userId: 'user-123',
        type: 'message',
        title: 'Test',
        body: 'Test message',
        createdAt: '2024-01-01T10:00:00Z'
      })
      
      store.handleNotificationReceived({
        id: 'notif-2',
        userId: 'user-123',
        type: 'mention',
        title: 'Test 2',
        body: 'Test message 2',
        createdAt: '2024-01-01T11:00:00Z'
      })
      
      store.clearNotifications()
      
      expect(store.state.notifications.size).toBe(0)
      expect(store.unreadNotificationCount).toBe(0)
    })

    it('should mark all notifications as read', () => {
      store.handleNotificationReceived({
        id: 'notif-1',
        userId: 'user-123',
        type: 'message',
        title: 'Test',
        body: 'Test message',
        createdAt: '2024-01-01T10:00:00Z'
      })
      
      store.handleNotificationReceived({
        id: 'notif-2',
        userId: 'user-123',
        type: 'mention',
        title: 'Test 2',
        body: 'Test message 2',
        createdAt: '2024-01-01T11:00:00Z'
      })
      
      store.markAllNotificationsAsRead()
      
      expect(store.unreadNotificationCount).toBe(0)
      expect(store.state.notifications.get('notif-1')?.read).toBe(true)
      expect(store.state.notifications.get('notif-2')?.read).toBe(true)
    })
  })

  describe('Notification Settings', () => {
    it('should update notification settings', () => {
      const newSettings = {
        soundEnabled: false,
        desktopEnabled: false,
        quietHoursEnabled: true
      }
      
      store.updateNotificationSettings(newSettings)
      
      expect(store.state.notificationSettings.soundEnabled).toBe(false)
      expect(store.state.notificationSettings.desktopEnabled).toBe(false)
      expect(store.state.notificationSettings.quietHoursEnabled).toBe(true)
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'notificationSettings',
        expect.stringContaining('"soundEnabled":false')
      )
    })
  })

  describe('Desktop Notifications', () => {
    it('should request notification permission', async () => {
      const permission = await store.requestNotificationPermission()
      
      expect(MockNotification.requestPermission).toHaveBeenCalled()
      expect(permission).toBe('granted')
    })
  })

  describe('Lifecycle Management', () => {
    it('should initialize correctly', async () => {      await store.initialize()
        expect(mockSocketInstance.on).toHaveBeenCalledWith('readReceiptUpdated', expect.any(Function))
      expect(mockSocketInstance.on).toHaveBeenCalledWith('notificationReceived', expect.any(Function))
    })

    it('should cleanup resources on destroy', () => {
      store.handleNotificationReceived({
        id: 'notif-1',
        userId: 'user-123',
        type: 'message',
        title: 'Test',
        body: 'Test message',
        createdAt: '2024-01-01T10:00:00Z'
      })
      
      store.destroy()
        expect(store.state.notifications.size).toBe(0)
      expect(mockSocketInstance.off).toHaveBeenCalledWith('readReceiptUpdated', expect.any(Function))
      expect(mockSocketInstance.off).toHaveBeenCalledWith('notificationReceived', expect.any(Function))
    })
  })
})
