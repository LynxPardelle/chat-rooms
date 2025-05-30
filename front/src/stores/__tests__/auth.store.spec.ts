import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

// Mock AuthService
vi.mock('@/core/services/auth.service', () => ({
  AuthService: {
    getInstance: vi.fn(() => ({
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshTokens: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      authState: {
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
      },
    })),
  },
}))

// Mock storage functionality
const storageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', { value: storageMock })
Object.defineProperty(window, 'sessionStorage', { value: storageMock })

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStore = useAuthStore()
    vi.clearAllMocks()
    storageMock.clear()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.currentUser).toBeNull()
      expect(authStore.isLoading).toBe(false)
      expect(authStore.authError).toBeNull()
      expect(authStore.accessToken).toBeNull()
    })
  })

  describe('Authentication', () => {
    it('should handle successful login', async () => {
      const mockUser = {
        id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
      }

      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.login.mockResolvedValue(mockUser)

      await authStore.login({ email: 'test@example.com', password: 'password123' })

      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.currentUser).toEqual(mockUser)
      expect(authStore.accessToken).toBe('mock-access-token')
    })

    it('should handle login failure', async () => {
      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'))

      const result = await authStore.login({ email: 'test@example.com', password: 'wrong' })

      expect(result).toBe(false)
      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.authError).toBe('Invalid credentials')
    })

    it('should handle logout', async () => {
      // Setup authenticated state first
      const mockUser = { id: 'user1', username: 'testuser' }
      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.login.mockResolvedValue(mockUser)

      await authStore.login({ email: 'test@example.com', password: 'password123' })
      expect(authStore.isAuthenticated).toBe(true)

      await authStore.logout()

      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.currentUser).toBeNull()
      expect(authStore.accessToken).toBeNull()
    })
  })

  describe('Registration', () => {
    it('should handle successful registration', async () => {
      const mockUser = {
        id: 'user1',
        username: 'newuser',
        email: 'newuser@example.com',
      }

      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.register.mockResolvedValue(mockUser)

      const result = await authStore.register({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      })

      expect(result).toBe(true)
      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.currentUser).toEqual(mockUser)
    })
  })

  describe('Profile Management', () => {
    it('should update user profile', async () => {
      // Setup authenticated state first
      const mockUser = { id: 'user1', username: 'testuser', email: 'test@example.com' }
      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.login.mockResolvedValue(mockUser)

      await authStore.login({ email: 'test@example.com', password: 'password123' })

      const profileUpdates = { username: 'updateduser' }
      const updatedUser = { ...mockUser, ...profileUpdates }

      mockAuthService.updateProfile.mockResolvedValue(updatedUser)

      const result = await authStore.updateProfile(profileUpdates)

      expect(result).toBe(true)
      expect(authStore.currentUser).toEqual(updatedUser)
    })
  })

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      // Setup authenticated state with tokens
      authStore.$state.tokens = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
      }
      authStore.$state.isAuthenticated = true

      const mockAuthService = require('@/core/services/auth.service').AuthService.getInstance()
      mockAuthService.refreshTokens.mockResolvedValue('new-access-token')

      const result = await authStore.refreshTokens()

      expect(result.success).toBe(true)
      expect(authStore.accessToken).toBe('mock-access-token')
    })
  })
})
