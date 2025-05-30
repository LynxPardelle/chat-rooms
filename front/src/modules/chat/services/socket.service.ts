/**
 * Socket Service - WebSocket Communication for Chat Module
 * 
 * This service provides a wrapper around Socket.IO client for type-safe
 * real-time communication with the chat backend. It handles connection
 * management, authentication, and event handling.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 */

import { io, Socket } from 'socket.io-client';
import type { 
  JoinRoomDto,
  SendMessageDto
} from '../types/chat-module.types';

// Environment configuration
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CONNECTION_TIMEOUT = 10000;
const RECONNECTION_ATTEMPTS = 5;

/**
 * Socket service class for managing WebSocket connections
 */
class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private eventListeners = new Map<string, Function[]>();

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.socket?.connected || this.isConnecting) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.isConnecting = true;

      this.socket = io(SOCKET_URL, {
        timeout: CONNECTION_TIMEOUT,
        reconnection: true,
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        autoConnect: false,
        transports: ['websocket', 'polling']
      });

      // Setup connection event handlers
      this.socket.on('connect', () => {
        this.isConnecting = false;
        console.log('Socket connected:', this.socket?.id);
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.isConnecting = false;
        console.error('Socket connection error:', error);
        reject(new Error(`Connection failed: ${error.message}`));
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Socket reconnection failed after maximum attempts');
      });

      // Start connection
      this.socket.connect();
    });
  }

  /**
   * Authenticate with the server using JWT token
   */
  async authenticate(token: string): Promise<void> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.socket!.once('authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('authentication_error', (data: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(data.message));
      });

      this.socket!.emit('authenticate', { token });
    });
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.eventListeners.clear();
  }

  /**
   * Check if socket is connected
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket ID
   */
  get socketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get connection latency
   */
  async getLatency(): Promise<number> {
    if (!this.socket?.connected) {
      return -1;
    }

    return new Promise((resolve) => {
      const start = Date.now();
      this.socket!.emit('heartbeat', { timestamp: start }, () => {
        const latency = Date.now() - start;
        resolve(latency);
      });
    });
  }
  /**
   * Generic event listener with simplified typing
   */
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.socket) return;

    this.socket.on(event, handler);

    // Store handler for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  /**
   * Remove event listener with simplified typing
   */
  off(event: string, handler?: (...args: any[]) => void): void {
    if (!this.socket) return;

    if (handler) {
      this.socket.off(event, handler);

      // Remove from stored handlers
      const handlers = this.eventListeners.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      this.socket.off(event);
      this.eventListeners.delete(event);
    }
  }

  /**
   * Generic event emitter with simplified typing
   */
  emit(event: string, data?: any, callback?: (response?: any) => void): void {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    if (callback) {
      this.socket.emit(event, data, callback);
    } else if (data !== undefined) {
      this.socket.emit(event, data);
    } else {
      this.socket.emit(event);
    }
  }

  /**
   * Join a chat room
   */
  async joinRoom(data: JoinRoomDto): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Join room timeout'));
      }, 5000);

      this.socket!.once('room_joined', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('room_error', (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('join_room', data);
    });
  }

  /**
   * Leave a chat room
   */
  async leaveRoom(roomId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Leave room timeout'));
      }, 5000);

      this.socket!.once('room_left', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('room_error', (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('leave_room', { roomId });
    });
  }

  /**
   * Send a message
   */
  async sendMessage(data: SendMessageDto): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Send message timeout'));
      }, 10000);

      this.socket!.once('message_sent', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('message_error', (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('send_message', data);
    });
  }

  /**
   * Send typing indicator
   */
  async sendTyping(data: { roomId: string; isTyping: boolean }): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Typing indicator send timeout'));
      }, 5000);

      this.socket!.once('typing_sent', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('typing_error', (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.emit('typing_indicator', data);
    });
  }
}

// Create singleton instance
const socketService = new SocketService();

/**
 * Composable hook for using the socket service
 */
export function useSocketService() {
  return socketService;
}

export { SocketService };
