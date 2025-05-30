import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUIStore } from '../ui'

// Mock DOM methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
})

describe('UI Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useUIStore()
      
      expect(store.sidebarCollapsed).toBe(false)
      expect(store.theme.mode).toBe('auto')
      expect(store.notifications).toEqual([])
      expect(store.modals).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.globalLoading).toBe(false)
      expect(store.isMobile).toBe(false)
      expect(store.isTablet).toBe(false)
      expect(store.isDesktop).toBe(true)
    })
  })

  describe('Sidebar Management', () => {
    it('should toggle sidebar', () => {
      const store = useUIStore()
      
      expect(store.sidebarCollapsed).toBe(false)
      store.toggleSidebar()
      expect(store.sidebarCollapsed).toBe(true)
      
      store.toggleSidebar()
      expect(store.sidebarCollapsed).toBe(false)
    })

    it('should set sidebar collapsed state', () => {
      const store = useUIStore()
      
      store.setSidebarCollapsed(true)
      expect(store.sidebarCollapsed).toBe(true)
      
      store.setSidebarCollapsed(false)
      expect(store.sidebarCollapsed).toBe(false)
    })
  })

  describe('Theme Management', () => {
    it('should have default theme', () => {
      const store = useUIStore()
      
      expect(store.theme.mode).toBe('auto')
      expect(store.theme.primaryColor).toBe('#007bff')
      expect(store.theme.animations).toBe(true)
    })

    it('should toggle dark mode', () => {
      const store = useUIStore()
      
      store.toggleDarkMode()
      expect(store.theme.mode).toBe('dark')
      
      store.toggleDarkMode()
      expect(store.theme.mode).toBe('light')
    })

    it('should update theme configuration', () => {
      const store = useUIStore()
      
      store.updateTheme({ primaryColor: '#ff5722', fontSize: 'lg' })
      expect(store.theme.primaryColor).toBe('#ff5722')
      expect(store.theme.fontSize).toBe('lg')
    })

    it('should reset theme to defaults', () => {
      const store = useUIStore()
      
      store.updateTheme({ primaryColor: '#custom', mode: 'dark' })
      store.resetTheme()
      
      expect(store.theme.mode).toBe('auto')
      expect(store.theme.primaryColor).toBe('#007bff')
    })
  })

  describe('Notifications', () => {
    it('should show and manage notifications', () => {
      const store = useUIStore()
      
      const notificationId = store.showNotification('Test', 'Test message')
      expect(store.notifications.length).toBe(1)
      expect(store.notifications[0].title).toBe('Test')
      expect(store.notifications[0].message).toBe('Test message')
      expect(store.notifications[0].id).toBe(notificationId)
    })

    it('should show different types of notifications', () => {
      const store = useUIStore()
      
      store.showSuccess('Success message')
      store.showError('Error message')
      store.showWarning('Warning message')
      store.showInfo('Info message')
      
      expect(store.notifications.length).toBe(4)
      expect(store.notifications[0].type).toBe('success')
      expect(store.notifications[1].type).toBe('error')
      expect(store.notifications[2].type).toBe('warning')
      expect(store.notifications[3].type).toBe('info')
    })

    it('should remove specific notification', () => {
      const store = useUIStore()
      
      const id1 = store.showNotification('Test 1')
      const id2 = store.showNotification('Test 2')
      
      expect(store.notifications.length).toBe(2)
      
      store.removeNotification(id1)
      expect(store.notifications.length).toBe(1)
      expect(store.notifications[0].id).toBe(id2)
    })

    it('should clear all notifications', () => {
      const store = useUIStore()
      
      store.showNotification('Test 1')
      store.showNotification('Test 2')
      expect(store.notifications.length).toBe(2)
      
      store.clearNotifications()
      expect(store.notifications.length).toBe(0)
    })

    it('should auto-dismiss notifications with duration', { timeout: 1000 }, () => {
      return new Promise<void>((resolve) => {
        const store = useUIStore()
        
        store.showSuccess('Auto dismiss message', 'Will disappear', 100)
        expect(store.notifications.length).toBe(1)
        
        setTimeout(() => {
          expect(store.notifications.length).toBe(0)
          resolve()
        }, 150)
      })
    })
  })

  describe('Modals', () => {
    it('should open and close modals', () => {
      const store = useUIStore()
      
      const modalId = store.openModal({ component: 'TestModal' })
      expect(store.modals.length).toBe(1)
      expect(store.hasModals).toBe(true)
      expect(store.currentModal?.id).toBe(modalId)
      
      store.closeModal(modalId)
      expect(store.modals.length).toBe(0)
      expect(store.hasModals).toBe(false)
    })

    it('should handle multiple modals', () => {
      const store = useUIStore()
      
      store.openModal({ component: 'Modal1' })
      const modal2Id = store.openModal({ component: 'Modal2' })
      
      expect(store.modals.length).toBe(2)
      expect(store.currentModal?.id).toBe(modal2Id) // Latest modal is current
    })

    it('should close top modal', () => {
      const store = useUIStore()
      
      store.openModal({ component: 'Modal1' })
      store.openModal({ component: 'Modal2' })
      
      store.closeTopModal()
      expect(store.modals.length).toBe(1)
    })

    it('should close all modals', () => {
      const store = useUIStore()
      
      store.openModal({ component: 'Modal1' })
      store.openModal({ component: 'Modal2' })
      
      store.closeAllModals()
      expect(store.modals.length).toBe(0)
    })
  })

  describe('Loading States', () => {
    it('should manage global loading', () => {
      const store = useUIStore()
      
      expect(store.globalLoading).toBe(false)
      expect(store.isLoading).toBe(false)
      
      store.setGlobalLoading(true, 'Loading...')
      expect(store.globalLoading).toBe(true)
      expect(store.isLoading).toBe(true)
      
      store.setGlobalLoading(false)
      expect(store.globalLoading).toBe(false)
    })

    it('should manage specific loading states', () => {
      const store = useUIStore()
      
      store.startLoading('messages', 'Loading messages...')
      expect(store.isLoading).toBe(true)
      expect(store.activeLoadingStates.length).toBe(1)
      
      store.stopLoading('messages')
      expect(store.isLoading).toBe(false)
      expect(store.activeLoadingStates.length).toBe(0)
    })

    it('should update loading progress', () => {
      const store = useUIStore()
      
      store.startLoading('upload', 'Uploading...', { progress: 0 })
      store.updateLoadingProgress('upload', 50, 'Half way...')
      
      const loadingState = store.activeLoadingStates[0]
      expect(loadingState.progress).toBe(50)
      expect(loadingState.message).toBe('Half way...')
    })

    it('should stop all loading states', () => {
      const store = useUIStore()
      
      store.startLoading('task1', 'Task 1')
      store.startLoading('task2', 'Task 2')
      store.setGlobalLoading(true)
      
      store.stopAllLoading()
      expect(store.isLoading).toBe(false)
      expect(store.globalLoading).toBe(false)
      expect(store.activeLoadingStates.length).toBe(0)
    })
  })

  describe('Layout Management', () => {
    it('should update screen size and device type', () => {
      const store = useUIStore()
      
      // Mobile
      store.updateScreenSize(600, 800)
      expect(store.isMobile).toBe(true)
      expect(store.isTablet).toBe(false)
      expect(store.isDesktop).toBe(false)
      expect(store.deviceType).toBe('mobile')
      
      // Tablet
      store.updateScreenSize(900, 600)
      expect(store.isMobile).toBe(false)
      expect(store.isTablet).toBe(true)
      expect(store.isDesktop).toBe(false)
      expect(store.deviceType).toBe('tablet')
      
      // Desktop
      store.updateScreenSize(1200, 800)
      expect(store.isMobile).toBe(false)
      expect(store.isTablet).toBe(false)
      expect(store.isDesktop).toBe(true)
      expect(store.deviceType).toBe('desktop')
    })

    it('should manage page title', () => {
      const store = useUIStore()
      
      store.setPageTitle('Chat Room')
      expect(store.pageTitle).toBe('Chat Room')
    })

    it('should manage breadcrumbs', () => {
      const store = useUIStore()
      
      const breadcrumbs = [
        { label: 'Home', path: '/' },
        { label: 'Chat', path: '/chat' },
        { label: 'Room 1' }
      ]
      
      store.setBreadcrumbs(breadcrumbs)
      expect(store.breadcrumbs).toEqual(breadcrumbs)
    })
  })

  describe('Utility Functions', () => {
    it('should track activity and manage idle state', () => {
      const store = useUIStore()
      
      expect(store.isIdle).toBe(false)
      
      store.trackActivity()
      // Can't access lastActivity directly as it's not exposed in the API
      expect(store.isIdle).toBe(false)
    })

    it('should manage online status', () => {
      const store = useUIStore()
      
      expect(store.isOnline).toBe(true)
      
      store.setOnlineStatus(false)
      expect(store.isOnline).toBe(false)
      
      store.setOnlineStatus(true)
      expect(store.isOnline).toBe(true)
    })

    it('should handle global errors', () => {
      const store = useUIStore()
      
      const error = new Error('Test error')
      store.handleGlobalError(error)
      
      expect(store.globalError).toBe(error)
      
      store.clearGlobalError()
      expect(store.globalError).toBe(null)
    })
  })

  describe('Store Cleanup', () => {
    it('should cleanup all state', () => {
      const store = useUIStore()
      
      // Set up some state
      store.showNotification('Test')
      store.openModal({ component: 'TestModal' })
      store.startLoading('test', 'Loading...')
      store.handleGlobalError(new Error('Test'))
      
      // Cleanup
      store.cleanup()
      
      expect(store.notifications.length).toBe(0)
      expect(store.modals.length).toBe(0)
      expect(store.isLoading).toBe(false)
      expect(store.globalError).toBe(null)
    })
  })
})
