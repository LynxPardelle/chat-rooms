import { render, type RenderOptions } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'
import { vi } from 'vitest'

// Create test router
export const createTestRouter = () => {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: { template: '<div>Home</div>' } },
      { path: '/login', component: { template: '<div>Login</div>' } },
      { path: '/chat', component: { template: '<div>Chat</div>' } },
      { path: '/profile', component: { template: '<div>Profile</div>' } },
    ],
  })
}

// Enhanced render function with Pinia and router
export const renderWithProviders = (
  component: Component,
  options: RenderOptions<any> & {
    piniaOptions?: any
    routerOptions?: any
    initialRoute?: string
  } = {}
) => {
  const { piniaOptions, routerOptions, initialRoute, ...renderOptions } = options

  const router = createTestRouter()
  if (initialRoute) {
    router.push(initialRoute)
  }

  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    ...piniaOptions,
  })

  return render(component, {
    global: {
      plugins: [pinia, router],
      ...renderOptions.global,
    },
    ...renderOptions,
  })
}

// Mock user data factory
export const createMockUser = (overrides = {}) => ({
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  avatar: null,
  avatarUrl: null,
  textColor: '#000000',
  backgroundColor: '#ffffff',
  isOnline: true,
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

// Mock message data factory
export const createMockMessage = (overrides = {}) => ({
  id: '1',
  content: 'Test message',
  userId: '1',
  roomId: 'general',
  messageType: 'TEXT' as const,
  user: createMockUser(),
  attachments: [],
  reactions: [],
  isEdited: false,
  editedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

// Mock room data factory
export const createMockRoom = (overrides = {}) => ({
  id: 'general',
  name: 'General',
  description: 'General chat room',
  isPrivate: false,
  maxUsers: 100,
  createdBy: '1',
  createdAt: new Date().toISOString(),
  ...overrides,
})

// Utility to wait for next tick
export const waitForNextTick = () => {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

// Utility to simulate typing delay
export const simulateTyping = (element: HTMLElement, text: string, delay = 10) => {
  return new Promise<void>((resolve) => {
    let i = 0
    const type = () => {
      if (i < text.length) {
        element.focus()
        const event = new Event('input', { bubbles: true })
        ;(element as HTMLInputElement).value += text[i]
        element.dispatchEvent(event)
        i++
        setTimeout(type, delay)
      } else {
        resolve()
      }
    }
    type()
  })
}

// Mock API responses
export const mockApiResponse = {
  success: (data: any) => ({
    data,
    status: 200,
    statusText: 'OK',
  }),
  error: (message: string, status = 400) => ({
    response: {
      data: { message },
      status,
      statusText: status === 400 ? 'Bad Request' : 'Server Error',
    },
  }),
}

// Custom matchers for testing
export const customMatchers = {
  toBeInDocument: (element: HTMLElement) => ({
    pass: document.body.contains(element),
    message: () => `Expected element to be in document`,
  }),
  toHaveAccessibleName: (element: HTMLElement, name: string) => ({
    pass: element.getAttribute('aria-label') === name || element.textContent === name,
    message: () => `Expected element to have accessible name "${name}"`,
  }),
}
