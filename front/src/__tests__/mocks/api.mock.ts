import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createMockUser, createMockMessage, createMockRoom } from '../utils/render-helpers'

// Mock data
const mockUsers = [
  createMockUser({ id: '1', username: 'testuser', email: 'test@example.com' }),
  createMockUser({ id: '2', username: 'otheruser', email: 'other@example.com' }),
]

const mockMessages = [
  createMockMessage({ 
    id: '1', 
    content: 'Hello world!', 
    userId: '1',
    user: mockUsers[0]
  }),
  createMockMessage({ 
    id: '2', 
    content: 'Hi there!', 
    userId: '2',
    user: mockUsers[1]
  }),
]

const mockRooms = [
  createMockRoom({ id: 'general', name: 'General' }),
  createMockRoom({ id: 'random', name: 'Random' }),
]

// Auth token for mocking
const MOCK_TOKEN = 'mock-jwt-token'
const MOCK_REFRESH_TOKEN = 'mock-refresh-token'

// Request handlers
export const handlers = [  // Auth endpoints
  http.post('http://localhost:3001/auth/register', async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.username || !body.email || !body.password) {
      return HttpResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    const newUser = createMockUser({
      id: String(Date.now()),
      username: body.username,
      email: body.email,
    })

    return HttpResponse.json({
      user: newUser,
      accessToken: MOCK_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
    })
  }),

  http.post('http://localhost:3001/auth/login', async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { message: 'Missing email or password' },
        { status: 400 }
      )
    }

    // Simulate invalid credentials
    if (body.email === 'invalid@example.com') {
      return HttpResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }

    const user = mockUsers.find(u => u.email === body.email) || mockUsers[0]

    return HttpResponse.json({
      user,
      accessToken: MOCK_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
    })
  }),

  http.post('http://localhost:3001/auth/refresh', async ({ request }) => {
    const body = await request.json() as any
    
    if (!body.refreshToken) {
      return HttpResponse.json(
        { message: 'Refresh token required' },
        { status: 400 }
      )
    }

    if (body.refreshToken === 'invalid-refresh-token') {
      return HttpResponse.json(
        { message: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    return HttpResponse.json({
      accessToken: MOCK_TOKEN,
      refreshToken: MOCK_REFRESH_TOKEN,
    })
  }),

  http.post('http://localhost:3001/auth/logout', () => {
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  // User endpoints
  http.get('/api/users/me', ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    return HttpResponse.json({ user: mockUsers[0] })
  }),

  http.put('/api/users/me', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as any
    const updatedUser = { ...mockUsers[0], ...body }
    
    return HttpResponse.json({ user: updatedUser })
  }),

  // Message endpoints
  http.get('/api/messages', ({ request }) => {
    const url = new URL(request.url)
    const roomId = url.searchParams.get('roomId') || 'general'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')

    // Filter messages by room
    const roomMessages = mockMessages.filter(m => m.roomId === roomId)
    
    // Pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedMessages = roomMessages.slice(startIndex, endIndex)

    return HttpResponse.json({
      messages: paginatedMessages,
      pagination: {
        page,
        limit,
        total: roomMessages.length,
        totalPages: Math.ceil(roomMessages.length / limit),
      },
    })
  }),

  http.post('/api/messages', async ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as any
    
    if (!body.content || body.content.trim().length === 0) {
      return HttpResponse.json(
        { message: 'Message content is required' },
        { status: 400 }
      )
    }

    if (body.content.length > 2000) {
      return HttpResponse.json(
        { message: 'Message too long' },
        { status: 400 }
      )
    }

    const newMessage = createMockMessage({
      id: String(Date.now()),
      content: body.content,
      roomId: body.roomId || 'general',
      messageType: body.messageType || 'TEXT',
      userId: '1',
      user: mockUsers[0],
    })

    return HttpResponse.json({ message: newMessage }, { status: 201 })
  }),

  // Room endpoints
  http.get('/api/rooms', () => {
    return HttpResponse.json({ rooms: mockRooms })
  }),

  http.get('/api/rooms/:id', ({ params }) => {
    const room = mockRooms.find(r => r.id === params.id)
    
    if (!room) {
      return HttpResponse.json(
        { message: 'Room not found' },
        { status: 404 }
      )
    }

    return HttpResponse.json({ room })
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  }),

  // WebSocket health endpoints
  http.get('/api/websocket/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      connections: 0,
      timestamp: new Date().toISOString(),
    })
  }),

  http.get('/api/websocket/stats', () => {
    return HttpResponse.json({
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      rooms: mockRooms.length,
      rateLimitViolations: 0,
      uptime: 3600000, // 1 hour in ms
      timestamp: new Date().toISOString(),
    })
  }),

  // Error simulation endpoints
  http.get('/api/error/500', () => {
    return HttpResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }),

  http.get('/api/error/404', () => {
    return HttpResponse.json(
      { message: 'Not found' },
      { status: 404 }
    )
  }),

  // Network error simulation
  http.get('/api/error/network', () => {
    return HttpResponse.error()
  }),
]

// Create the server instance
export const server = setupServer(...handlers)

// Helper functions for tests
export const mockApiHelpers = {
  // Add a new message to mock data
  addMessage: (message: any) => {
    mockMessages.push(createMockMessage(message))
  },

  // Clear all messages
  clearMessages: () => {
    mockMessages.length = 0
  },

  // Add a new user to mock data
  addUser: (user: any) => {
    mockUsers.push(createMockUser(user))
  },

  // Clear all users except the first one
  clearUsers: () => {
    mockUsers.splice(1)
  },

  // Reset all mock data
  resetMockData: () => {
    mockMessages.length = 0
    mockUsers.splice(1)
    mockMessages.push(
      createMockMessage({ 
        id: '1', 
        content: 'Hello world!', 
        userId: '1',
        user: mockUsers[0]
      }),
      createMockMessage({ 
        id: '2', 
        content: 'Hi there!', 
        userId: '2',
        user: mockUsers[1] || createMockUser({ id: '2', username: 'otheruser' })
      })
    )
  },

  // Get current mock data
  getMockData: () => ({
    users: [...mockUsers],
    messages: [...mockMessages],
    rooms: [...mockRooms],
  }),
}

// Server setup helpers for tests
export const setupMockServer = () => {
  // Start server before all tests - use 'warn' instead of 'error' to avoid test failures
  server.listen({ onUnhandledRequest: 'warn' })
}

export const cleanupMockServer = () => {
  // Reset handlers after each test
  server.resetHandlers()
  mockApiHelpers.resetMockData()
}

export const teardownMockServer = () => {
  // Clean up after all tests
  server.close()
}
