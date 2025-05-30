import { io, type Socket } from 'socket.io-client';
import { appConfig } from '../config/app.config';
import { StorageService } from './storage.service';
import { ErrorService } from './error.service';
import {
  WebSocketEvent,
  type SocketResponse,
  type JoinRoomPayload,
  type LeaveRoomPayload,
  type SendMessagePayload,
  type TypingPayload,
  type GetRoomStatsPayload
} from '../types/enhanced-api.types';

/**
 * Enterprise-grade WebSocket service with robust connection management,
 * automatic reconnection, and integration with backend WebSocket API
 */
export class SocketService {
  private static _instance: SocketService;
  private _socket: Socket | null = null;
  private _storageService: StorageService;
  private _errorService: ErrorService;  private _connectionAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _eventQueue: Array<{ event: string; data: any }> = [];
  private _isConnecting = false;
  private _connectionPromise: Promise<Socket> | null = null;

  // Connection states
  private _connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  
  // Event listeners registry
  private _eventListeners = new Map<string, Set<(...args: any[]) => void>>();

  private constructor() {
    this._storageService = StorageService.getInstance();
    this._errorService = ErrorService.getInstance();
  }

  public static getInstance(): SocketService {
    if (!SocketService._instance) {
      SocketService._instance = new SocketService();
    }
    return SocketService._instance;
  }

  /**
   * Initialize WebSocket connection with authentication
   */
  public async connect(): Promise<Socket> {
    if (this._socket?.connected) {
      return this._socket;
    }

    if (this._isConnecting && this._connectionPromise) {
      return this._connectionPromise;
    }

    this._isConnecting = true;
    this._connectionState = 'connecting';

    this._connectionPromise = this._createConnection();
    
    try {
      const socket = await this._connectionPromise;
      this._isConnecting = false;
      return socket;
    } catch (error) {
      this._isConnecting = false;
      this._connectionPromise = null;
      throw error;
    }
  }

  /**
   * Create and configure WebSocket connection
   */
  private async _createConnection(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const token = this._storageService.getSecure('accessToken');
      
      if (!token) {
        const error = new Error('No authentication token available');
        this._errorService.handleError(error);
        reject(error);
        return;
      }

      // Create socket with enhanced configuration
      this._socket = io(appConfig.websocket.url, {
        auth: { token },
        autoConnect: true,
        reconnection: false, // We handle reconnection manually
        timeout: 10000,
        forceNew: true,
        transports: ['websocket', 'polling'],
        upgrade: true,
      });

      this._setupEventHandlers(resolve, reject);
    });
  }

  /**
   * Setup socket event handlers
   */
  private _setupEventHandlers(
    resolve: (socket: Socket) => void,
    reject: (error: Error) => void
  ): void {
    if (!this._socket) return;

    // Connection successful
    this._socket.on('connect', () => {
      this._connectionState = 'connected';
      this._connectionAttempts = 0;
      
      if (appConfig.features.enableLogging) {
        console.log('[WebSocket] Connected successfully');
      }

      // Process queued events
      this._processEventQueue();
      
      // Start heartbeat
      this._startHeartbeat();
      
      resolve(this._socket!);
    });

    // Connection error
    this._socket.on('connect_error', (error) => {
      this._errorService.handleWebSocketError(error, 'Connection failed');
      
      if (this._connectionAttempts === 0) {
        reject(error);
      } else {
        this._handleReconnection();
      }
    });

    // Disconnection
    this._socket.on('disconnect', (reason) => {
      this._connectionState = 'disconnected';
      this._stopHeartbeat();
      
      if (appConfig.features.enableLogging) {
        console.log('[WebSocket] Disconnected:', reason);
      }

      // Auto-reconnect unless manually disconnected
      if (reason !== 'io client disconnect') {
        this._handleReconnection();
      }
    });

    // Authentication error
    this._socket.on('error', (error) => {
      this._errorService.handleWebSocketError(error, 'Socket error');
      
      if (error.message?.includes('Authentication')) {
        // Token might be invalid, try to refresh
        this._handleAuthenticationError();
      }
    });

    // Heartbeat response
    this._socket.on(WebSocketEvent.HEARTBEAT_RESPONSE, () => {
      if (appConfig.features.enableLogging) {
        console.log('[WebSocket] Heartbeat received');
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  private _handleReconnection(): void {
    if (this._connectionState === 'reconnecting') return;
    
    this._connectionState = 'reconnecting';
    this._connectionAttempts++;

    if (this._connectionAttempts > appConfig.websocket.reconnectAttempts) {
      this._errorService.handleError(
        new Error('Maximum reconnection attempts exceeded')
      );
      this._connectionState = 'disconnected';
      return;
    }

    const delay = Math.min(
      appConfig.websocket.reconnectDelay * Math.pow(2, this._connectionAttempts - 1),
      30000 // Max 30 seconds
    );

    if (appConfig.features.enableLogging) {
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this._connectionAttempts})`);
    }

    this._reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this._errorService.handleError(error);
        this._handleReconnection();
      });
    }, delay);
  }

  /**
   * Handle authentication errors
   */
  private _handleAuthenticationError(): void {
    // Clear stored tokens and emit auth failure event
    this._storageService.removeSecure('accessToken');
    this._storageService.removeSecure('refreshToken');
    
    window.dispatchEvent(new CustomEvent('auth:websocket-failure'));
    
    this.disconnect();
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private _startHeartbeat(): void {
    this._heartbeatTimer = setInterval(() => {
      if (this._socket?.connected) {
        this.emit(WebSocketEvent.HEARTBEAT, {});
      }
    }, appConfig.websocket.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private _stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * Process queued events after connection
   */
  private _processEventQueue(): void {
    while (this._eventQueue.length > 0 && this._socket?.connected) {
      const { event, data } = this._eventQueue.shift()!;
      this._socket.emit(event, data);
    }
  }

  /**
   * Emit event with auto-queueing when disconnected
   */
  public emit(event: string, data: any): void {
    if (this._socket?.connected) {
      this._socket.emit(event, data);
    } else {
      // Queue event for when connection is restored
      this._eventQueue.push({ event, data });
      
      // Attempt to reconnect if not connected
      if (this._connectionState === 'disconnected') {
        this.connect().catch((error) => {
          this._errorService.handleError(error);
        });
      }
    }
  }

  /**
   * Listen to event with automatic cleanup tracking
   */
  public on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    
    this._eventListeners.get(event)!.add(callback);
    
    if (this._socket) {
      this._socket.on(event, callback);
    }
  }

  /**
   * Remove event listener
   */
  public off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this._eventListeners.get(event)?.delete(callback);
      this._socket?.off(event, callback);
    } else {
      this._eventListeners.delete(event);
      this._socket?.off(event);
    }
  }

  /**
   * Listen to event once
   */
  public once<T = any>(event: string, callback: (data: T) => void): void {
    const onceCallback = (data: T) => {
      callback(data);
      this.off(event, onceCallback);
    };
    
    this.on(event, onceCallback);
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    this._connectionState = 'disconnected';
    
    // Clear timers
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._stopHeartbeat();
    
    // Clear event queue
    this._eventQueue = [];
    
    // Disconnect socket
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
    
    // Reset connection state
    this._connectionAttempts = 0;
    this._isConnecting = false;
    this._connectionPromise = null;
  }

  // =====================================
  // High-level API methods for chat functionality
  // =====================================

  /**
   * Join a chat room
   */
  public joinRoom(roomId: string): Promise<SocketResponse> {
    return this._emitWithResponse(WebSocketEvent.JOIN_ROOM, { roomId } as JoinRoomPayload);
  }

  /**
   * Leave a chat room
   */
  public leaveRoom(roomId: string): Promise<SocketResponse> {
    return this._emitWithResponse(WebSocketEvent.LEAVE_ROOM, { roomId } as LeaveRoomPayload);
  }

  /**
   * Send a message
   */
  public sendMessage(content: string, messageType: string = 'TEXT'): Promise<SocketResponse> {
    return this._emitWithResponse(WebSocketEvent.SEND_MESSAGE, {
      content,
      messageType
    } as SendMessagePayload);
  }

  /**
   * Send typing indicator
   */
  public sendTyping(roomId: string, isTyping: boolean): void {
    this.emit(WebSocketEvent.TYPING, { roomId, isTyping } as TypingPayload);
  }

  /**
   * Get room statistics
   */
  public getRoomStats(roomId: string): Promise<SocketResponse> {
    return this._emitWithResponse(WebSocketEvent.GET_ROOM_STATS, { roomId } as GetRoomStatsPayload);
  }

  /**
   * Emit event and wait for response
   */
  private _emitWithResponse(event: string, data: any): Promise<SocketResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${event}`));
      }, 10000);

      // Listen for response once
      const responseEvent = `${event}Response`;
      this.once(responseEvent, (response: SocketResponse) => {
        clearTimeout(timeout);
        
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error?.message || 'Socket operation failed'));
        }
      });

      // Emit the event
      this.emit(event, data);
    });
  }

  // =====================================
  // Getters and utilities
  // =====================================

  /**
   * Get current connection state
   */
  public get connectionState(): string {
    return this._connectionState;
  }

  /**
   * Check if socket is connected
   */
  public get isConnected(): boolean {
    return this._socket?.connected ?? false;
  }

  /**
   * Get socket instance (for advanced usage)
   */
  public get socket(): Socket | null {
    return this._socket;
  }

  /**
   * Get connection ID
   */
  public get connectionId(): string | null {
    return this._socket?.id ?? null;
  }

  /**
   * Get number of reconnection attempts
   */
  public get reconnectionAttempts(): number {
    return this._connectionAttempts;
  }

  /**
   * Get queued events count
   */
  public get queuedEventsCount(): number {
    return this._eventQueue.length;
  }
}

// Export singleton instance
export default SocketService.getInstance();
