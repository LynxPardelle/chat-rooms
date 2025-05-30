import { vi } from 'vitest'
import type { MockedFunction } from 'vitest'

export interface MockWebSocket {
  send: MockedFunction<any>
  close: MockedFunction<any>
  addEventListener: MockedFunction<any>
  removeEventListener: MockedFunction<any>
  readyState: number
  CONNECTING: number
  OPEN: number
  CLOSING: number
  CLOSED: number
  url: string
  protocol: string
  onopen: ((event: Event) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onmessage: ((event: MessageEvent) => void) | null
  onerror: ((event: Event) => void) | null
}

export class MockWebSocketServer {
  private connections: MockWebSocket[] = []
  private eventListeners: { [key: string]: Function[] } = {}

  constructor() {
    this.setupWebSocketMock()
  }  private setupWebSocketMock() {
    const MockWebSocketClass = vi.fn().mockImplementation((url: string, protocol?: string) => {
      const mockSocket: MockWebSocket = {
        send: vi.fn((data: string) => {
          // Simulate server echo or response
          setTimeout(() => {
            if (mockSocket.onmessage) {
              const response = this.generateResponse(data)
              mockSocket.onmessage(new MessageEvent('message', { data: response }))
            }
          }, 10)
        }),
        close: vi.fn((code?: number, reason?: string) => {
          mockSocket.readyState = mockSocket.CLOSED
          if (mockSocket.onclose) {
            mockSocket.onclose(new CloseEvent('close', { code, reason }))
          }
        }),
        addEventListener: vi.fn((type: string, listener: Function) => {
          if (!this.eventListeners[type]) {
            this.eventListeners[type] = []
          }
          this.eventListeners[type].push(listener)
        }),
        removeEventListener: vi.fn((type: string, listener: Function) => {
          if (this.eventListeners[type]) {
            const index = this.eventListeners[type].indexOf(listener)
            if (index > -1) {
              this.eventListeners[type].splice(index, 1)
            }
          }
        }),
        readyState: 1, // OPEN
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        url: url,
        protocol: protocol || '',
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
      }

      this.connections.push(mockSocket)

      // Simulate connection opening
      setTimeout(() => {
        if (mockSocket.onopen) {
          mockSocket.onopen(new Event('open'))
        }
      }, 10)

      return mockSocket
    })    // Add static properties to match WebSocket constructor
    ;(MockWebSocketClass as any).CONNECTING = 0
    ;(MockWebSocketClass as any).OPEN = 1
    ;(MockWebSocketClass as any).CLOSING = 2
    ;(MockWebSocketClass as any).CLOSED = 3

    global.WebSocket = MockWebSocketClass as any
  }

  private generateResponse(data: string): string {
    try {
      const parsed = JSON.parse(data)
      
      // Mock different socket events
      switch (parsed.event) {
        case 'joinRoom':
          return JSON.stringify({
            event: 'joinedRoom',
            data: {
              roomId: parsed.data.roomId,
              success: true,
              message: 'Successfully joined room'
            }
          })
        
        case 'sendMessage':
          return JSON.stringify({
            event: 'receiveMessage',
            data: {
              id: 'msg-' + Date.now(),
              content: parsed.data.content,
              userId: 'user-1',
              roomId: parsed.data.roomId || 'general',
              messageType: parsed.data.messageType || 'TEXT',
              createdAt: new Date().toISOString(),
              user: {
                id: 'user-1',
                username: 'TestUser',
                textColor: '#000000',
                backgroundColor: '#ffffff'
              }
            }
          })
        
        case 'typing':
          return JSON.stringify({
            event: 'userTyping',
            data: {
              userId: 'user-2',
              roomId: parsed.data.roomId,
              isTyping: parsed.data.isTyping,
              username: 'OtherUser'
            }
          })
        
        case 'heartbeat':
          return JSON.stringify({
            event: 'heartbeatResponse',
            data: {
              timestamp: new Date().toISOString(),
              success: true
            }
          })
        
        default:
          return JSON.stringify({
            event: 'error',
            data: {
              message: 'Unknown event type',
              code: 'UNKNOWN_EVENT'
            }
          })
      }
    } catch (error) {
      return JSON.stringify({
        event: 'error',
        data: {
          message: 'Invalid message format',
          code: 'INVALID_FORMAT'
        }
      })
    }
  }

  // Utility methods for testing
  simulateMessage(data: any) {
    this.connections.forEach(connection => {
      if (connection.onmessage) {
        connection.onmessage(new MessageEvent('message', { 
          data: JSON.stringify(data) 
        }))
      }
    })
  }

  simulateDisconnection() {
    this.connections.forEach(connection => {
      connection.readyState = connection.CLOSED
      if (connection.onclose) {
        connection.onclose(new CloseEvent('close', { 
          code: 1000, 
          reason: 'Normal closure' 
        }))
      }
    })
  }
  simulateError() {
    this.connections.forEach(connection => {
      if (connection.onerror) {
        connection.onerror(new Event('error'))
      }
    })
  }

  getLastConnection(): MockWebSocket | undefined {
    return this.connections[this.connections.length - 1]
  }

  getAllConnections(): MockWebSocket[] {
    return [...this.connections]
  }

  clearConnections() {
    this.connections = []
    this.eventListeners = {}
  }

  destroy() {
    this.clearConnections()
    vi.restoreAllMocks()
  }
}

// Factory function to create mock socket server
export const createMockSocketServer = () => {
  return new MockWebSocketServer()
}

// Mock socket events for testing
export const mockSocketEvents = {
  joinRoom: (roomId: string) => ({
    event: 'joinRoom',
    data: { roomId }
  }),
  
  sendMessage: (content: string, roomId = 'general', messageType = 'TEXT') => ({
    event: 'sendMessage',
    data: { content, roomId, messageType }
  }),
  
  typing: (roomId: string, isTyping: boolean) => ({
    event: 'typing',
    data: { roomId, isTyping }
  }),
  
  leaveRoom: (roomId: string) => ({
    event: 'leaveRoom',
    data: { roomId }
  }),
  
  heartbeat: () => ({
    event: 'heartbeat',
    data: {}
  })
}

// Helper to wait for WebSocket events in tests
export const waitForSocketEvent = (socket: MockWebSocket, eventType: string, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for ${eventType} event`))
    }, timeout)

    const originalAddEventListener = socket.addEventListener
    socket.addEventListener = vi.fn((type: string, listener: Function) => {
      if (type === eventType) {
        clearTimeout(timer)
        resolve(listener)
      }
      return originalAddEventListener.call(socket, type, listener)
    })
  })
}
