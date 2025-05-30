import { Page, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';

export interface WebSocketEvent {
  event: string;
  data?: any;
  timestamp?: Date;
}

export interface MessageData {
  content: string;
  roomId?: string;
  messageType?: 'TEXT' | 'IMAGE' | 'FILE';
}

/**
 * WebSocket Helper for E2E Tests
 * Handles WebSocket connections, message sending, and real-time event verification
 */
export class WebSocketHelper {
  private page: Page;
  private socket: Socket | null = null;
  private events: WebSocketEvent[] = [];
  private readonly socketUrl: string;

  // Selectors for WebSocket-related UI elements
  private readonly selectors = {
    messageInput: '[data-testid="message-input"]',
    sendButton: '[data-testid="send-button"]',
    messagesList: '[data-testid="messages-list"]',
    messageItem: '[data-testid="message-item"]',
    typingIndicator: '[data-testid="typing-indicator"]',
    connectionStatus: '[data-testid="connection-status"]',
    onlineUsers: '[data-testid="online-users"]',
    roomSelector: '[data-testid="room-selector"]'
  };

  constructor(page: Page) {
    this.page = page;
    this.socketUrl = process.env.TEST_SOCKET_URL || 'http://localhost:3001';
  }

  /**
   * Connect to WebSocket server with authentication
   */
  async connect(authToken?: string): Promise<void> {
    const token = authToken || await this.getAuthTokenFromPage();
    
    this.socket = io(this.socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    // Setup event listeners
    this.setupEventListeners();

    // Wait for connection
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('Socket not initialized'));

      this.socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        reject(error);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('✅ WebSocket disconnected');
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(roomId: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('joinRoom', { roomId });

      // Wait for join confirmation
      this.socket!.once('joinedRoom', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to join room'));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 5000);
    });
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId: string): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('leaveRoom', { roomId });

      // Wait for leave confirmation
      this.socket!.once('leftRoom', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to leave room'));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Leave room timeout'));
      }, 5000);
    });
  }

  /**
   * Send a message via WebSocket
   */
  async sendMessage(messageData: MessageData): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      this.socket!.emit('sendMessage', messageData);

      // Wait for send confirmation
      this.socket!.once('messageSent', (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error('Failed to send message'));
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Send message timeout'));
      }, 5000);
    });
  }

  /**
   * Send a message via UI (for testing form interaction)
   */
  async sendMessageViaUI(content: string): Promise<void> {
    await this.page.locator(this.selectors.messageInput).fill(content);
    await this.page.locator(this.selectors.sendButton).click();
    
    // Wait for message to appear in UI
    await this.page.waitForFunction(
      (content) => {
        const messages = document.querySelectorAll('[data-testid="message-item"]');
        return Array.from(messages).some(msg => msg.textContent?.includes(content));
      },
      content,
      { timeout: 10000 }
    );
  }

  /**
   * Send typing indicator
   */
  async sendTyping(roomId: string, isTyping: boolean): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    this.socket.emit('typing', { roomId, isTyping });
  }

  /**
   * Wait for a specific WebSocket event
   */
  async waitForEvent(eventName: string, timeout: number = 10000): Promise<WebSocketEvent> {
    return new Promise((resolve, reject) => {
      // Check if event already received
      const existingEvent = this.events.find(e => e.event === eventName);
      if (existingEvent) {
        return resolve(existingEvent);
      }

      // Set up listener for new event
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventName}`));
      }, timeout);

      const checkForEvent = () => {
        const event = this.events.find(e => e.event === eventName);
        if (event) {
          clearTimeout(timeoutId);
          resolve(event);
        } else {
          setTimeout(checkForEvent, 100);
        }
      };

      checkForEvent();
    });
  }

  /**
   * Wait for message to be received
   */
  async waitForMessage(content: string, timeout: number = 10000): Promise<WebSocketEvent> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message: ${content}`));
      }, timeout);

      const checkForMessage = () => {
        const messageEvent = this.events.find(e => 
          e.event === 'receiveMessage' && 
          e.data?.content?.includes(content)
        );
        
        if (messageEvent) {
          clearTimeout(timeoutId);
          resolve(messageEvent);
        } else {
          setTimeout(checkForMessage, 100);
        }
      };

      checkForMessage();
    });
  }

  /**
   * Verify typing indicator appears in UI
   */
  async verifyTypingIndicator(shouldBeVisible: boolean): Promise<void> {
    if (shouldBeVisible) {
      await expect(this.page.locator(this.selectors.typingIndicator)).toBeVisible();
    } else {
      await expect(this.page.locator(this.selectors.typingIndicator)).not.toBeVisible();
    }
  }

  /**
   * Verify connection status in UI
   */
  async verifyConnectionStatus(status: 'connected' | 'disconnected' | 'connecting'): Promise<void> {
    await expect(this.page.locator(this.selectors.connectionStatus)).toContainText(status);
  }

  /**
   * Get all received events
   */
  getEvents(): WebSocketEvent[] {
    return [...this.events];
  }

  /**
   * Clear event history
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Get message count from UI
   */
  async getMessageCount(): Promise<number> {
    const messages = await this.page.locator(this.selectors.messageItem).count();
    return messages;
  }

  /**
   * Get last message content from UI
   */
  async getLastMessageContent(): Promise<string> {
    const messages = this.page.locator(this.selectors.messageItem);
    const count = await messages.count();
    if (count === 0) return '';
    
    const lastMessage = messages.nth(count - 1);
    return await lastMessage.textContent() || '';
  }

  /**
   * Setup WebSocket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Listen to all events and store them
    const originalEmit = this.socket.emit;
    const originalOn = this.socket.on;

    // Override emit to log outgoing events
    this.socket.emit = (event: string, ...args: any[]) => {
      this.events.push({
        event: `sent:${event}`,
        data: args[0],
        timestamp: new Date()
      });
      return originalEmit.call(this.socket, event, ...args);
    };

    // Common event listeners
    const eventNames = [
      'receiveMessage',
      'userJoined',
      'userLeft',
      'typing',
      'messageSent',
      'joinedRoom',
      'leftRoom',
      'error',
      'disconnect',
      'heartbeatResponse'
    ];

    eventNames.forEach(eventName => {
      this.socket!.on(eventName, (data) => {
        this.events.push({
          event: eventName,
          data,
          timestamp: new Date()
        });
      });
    });
  }

  /**
   * Get auth token from page
   */
  private async getAuthTokenFromPage(): Promise<string> {
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('authToken') || localStorage.getItem('accessToken');
    });

    if (!token) {
      throw new Error('No auth token found in page storage');
    }

    return token;
  }
}
