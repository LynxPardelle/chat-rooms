/**
 * Connection Manager Service
 * 
 * Manages the connection state between frontend and backend,
 * handles reconnection logic, and provides status monitoring.
 */

import { ref, computed, watch } from 'vue';
import { useChatService } from '../../modules/chat/services/chat.service';
import { useSocketService } from '../../modules/chat/services/socket.service';
import { useAuthStore } from '../../stores/auth';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

interface ConnectionState {
  api: {
    status: ConnectionStatus;
    lastCheck: Date | null;
    error: string | null;
  };
  websocket: {
    status: ConnectionStatus;
    lastCheck: Date | null;
    error: string | null;
  };
  overall: ConnectionStatus;
}

interface ConnectionManagerOptions {
  maxRetries?: number;
  retryDelay?: number;
  healthCheckInterval?: number;
  autoReconnect?: boolean;
}

class ConnectionManager {
  private static _instance: ConnectionManager;
  
  private chatService = useChatService();
  private socketService = useSocketService();
  private authStore = useAuthStore();
  
  private retryCount = 0;
  private healthCheckTimer: number | null = null;
  private reconnectTimer: number | null = null;
  
  private options: Required<ConnectionManagerOptions> = {
    maxRetries: 5,
    retryDelay: 2000,
    healthCheckInterval: 30000, // 30 seconds
    autoReconnect: true
  };
  
  // Reactive state
  private state = ref<ConnectionState>({
    api: {
      status: 'disconnected',
      lastCheck: null,
      error: null
    },
    websocket: {
      status: 'disconnected',
      lastCheck: null,
      error: null
    },
    overall: 'disconnected'
  });
  
  // Event listeners
  private listeners = new Set<(state: ConnectionState) => void>();
  
  constructor(options?: ConnectionManagerOptions) {
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Watch for auth changes to reconnect
    watch(
      () => this.authStore.isAuthenticated,
      (isAuthenticated) => {
        if (isAuthenticated) {
          this.connect();
        } else {
          this.disconnect();
        }
      }
    );
  }
  
  public static getInstance(options?: ConnectionManagerOptions): ConnectionManager {
    if (!ConnectionManager._instance) {
      ConnectionManager._instance = new ConnectionManager(options);
    }
    return ConnectionManager._instance;
  }
  
  // Computed properties
  public get connectionState() {
    return computed(() => this.state.value);
  }
  
  public get isConnected() {
    return computed(() => this.state.value.overall === 'connected');
  }
  
  public get isConnecting() {
    return computed(() => 
      this.state.value.overall === 'connecting' || 
      this.state.value.overall === 'reconnecting'
    );
  }
  
  public get hasError() {
    return computed(() => this.state.value.overall === 'error');
  }
  
  public get apiStatus() {
    return computed(() => this.state.value.api.status);
  }
  
  public get websocketStatus() {
    return computed(() => this.state.value.websocket.status);
  }
  
  /**
   * Initialize and connect to both API and WebSocket
   */
  public async connect(): Promise<boolean> {
    console.log('ConnectionManager: Starting connection...');
    
    this.updateOverallStatus('connecting');
    this.retryCount = 0;
    
    try {
      // Test API connection first
      const apiConnected = await this.connectToAPI();
      
      if (apiConnected && this.authStore.isAuthenticated) {
        // If API is connected and user is authenticated, connect WebSocket
        const wsConnected = await this.connectToWebSocket();
        
        if (apiConnected && wsConnected) {
          this.updateOverallStatus('connected');
          this.startHealthCheck();
          this.notifyListeners();
          return true;
        }
      } else if (apiConnected) {
        // API connected but not authenticated - this is still a valid state
        this.updateOverallStatus('connected');
        this.startHealthCheck();
        this.notifyListeners();
        return true;
      }
      
      throw new Error('Failed to establish connections');
      
    } catch (error) {
      console.error('ConnectionManager: Connection failed:', error);
      this.updateOverallStatus('error');
      
      if (this.options.autoReconnect && this.retryCount < this.options.maxRetries) {
        this.scheduleReconnect();
      }
      
      this.notifyListeners();
      return false;
    }
  }
  
  /**
   * Test and establish API connection
   */
  private async connectToAPI(): Promise<boolean> {
    this.state.value.api.status = 'connecting';
    this.state.value.api.error = null;
    
    try {
      const isHealthy = await this.chatService.testConnection();
      
      if (isHealthy) {
        this.state.value.api.status = 'connected';
        this.state.value.api.lastCheck = new Date();
        console.log('ConnectionManager: API connection established');
        return true;
      } else {
        throw new Error('API health check failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
      this.state.value.api.status = 'error';
      this.state.value.api.error = errorMessage;
      console.error('ConnectionManager: API connection failed:', errorMessage);
      return false;
    }
  }
  
  /**
   * Establish WebSocket connection
   */
  private async connectToWebSocket(): Promise<boolean> {
    if (!this.authStore.isAuthenticated || !this.authStore.accessToken) {
      console.log('ConnectionManager: Skipping WebSocket connection - not authenticated');
      return false;
    }
    
    this.state.value.websocket.status = 'connecting';
    this.state.value.websocket.error = null;
    
    try {
      await this.socketService.connect();
      await this.socketService.authenticate(this.authStore.accessToken);
      
      this.state.value.websocket.status = 'connected';
      this.state.value.websocket.lastCheck = new Date();
      console.log('ConnectionManager: WebSocket connection established');
      
      // Setup WebSocket event handlers
      this.setupWebSocketHandlers();
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
      this.state.value.websocket.status = 'error';
      this.state.value.websocket.error = errorMessage;
      console.error('ConnectionManager: WebSocket connection failed:', errorMessage);
      return false;
    }
  }
  
  /**
   * Setup WebSocket event handlers for connection monitoring
   */
  private setupWebSocketHandlers(): void {
    this.socketService.on('disconnect', (reason: string) => {
      console.log('ConnectionManager: WebSocket disconnected:', reason);
      this.state.value.websocket.status = 'disconnected';
      this.updateOverallStatus();
      
      if (this.options.autoReconnect) {
        this.scheduleReconnect();
      }
      
      this.notifyListeners();
    });
    
    this.socketService.on('connect_error', (error: Error) => {
      console.error('ConnectionManager: WebSocket connection error:', error);
      this.state.value.websocket.status = 'error';
      this.state.value.websocket.error = error.message;
      this.updateOverallStatus();
      this.notifyListeners();
    });
    
    this.socketService.on('reconnect', () => {
      console.log('ConnectionManager: WebSocket reconnected');
      this.state.value.websocket.status = 'connected';
      this.state.value.websocket.lastCheck = new Date();
      this.updateOverallStatus();
      this.notifyListeners();
    });
  }
  
  /**
   * Disconnect from all services
   */
  public async disconnect(): Promise<void> {
    console.log('ConnectionManager: Disconnecting...');
    
    this.stopHealthCheck();
    this.stopReconnectTimer();
    
    // Disconnect WebSocket
    if (this.socketService.isConnected) {
      await this.socketService.disconnect();
    }
    
    this.state.value.api.status = 'disconnected';
    this.state.value.websocket.status = 'disconnected';
    this.updateOverallStatus('disconnected');
    this.notifyListeners();
  }
  
  /**
   * Reconnect to all services
   */
  public async reconnect(): Promise<boolean> {
    console.log('ConnectionManager: Manual reconnect requested');
    this.retryCount = 0;
    return this.connect();
  }
  
  /**
   * Start periodic health checks
   */
  private startHealthCheck(): void {
    this.stopHealthCheck();
    
    this.healthCheckTimer = window.setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }
  
  /**
   * Stop health checks
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  /**
   * Perform health check on all connections
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check API health
      const apiHealthy = await this.chatService.testConnection();
      
      if (!apiHealthy && this.state.value.api.status === 'connected') {
        this.state.value.api.status = 'error';
        this.state.value.api.error = 'Health check failed';
        this.updateOverallStatus();
      } else if (apiHealthy && this.state.value.api.status !== 'connected') {
        this.state.value.api.status = 'connected';
        this.state.value.api.error = null;
        this.updateOverallStatus();
      }
      
      this.state.value.api.lastCheck = new Date();
      
      // Check WebSocket health
      if (this.authStore.isAuthenticated) {
        if (this.socketService.isConnected) {
          try {
            const latency = await this.socketService.getLatency();
            if (latency > 0) {
              this.state.value.websocket.status = 'connected';
              this.state.value.websocket.lastCheck = new Date();
            }
          } catch (error) {
            if (this.state.value.websocket.status === 'connected') {
              this.state.value.websocket.status = 'error';
              this.state.value.websocket.error = 'Latency check failed';
              this.updateOverallStatus();
            }
          }
        } else if (this.state.value.websocket.status === 'connected') {
          this.state.value.websocket.status = 'disconnected';
          this.updateOverallStatus();
        }
      }
      
      this.notifyListeners();
      
    } catch (error) {
      console.error('ConnectionManager: Health check error:', error);
    }
  }
  
  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.retryCount >= this.options.maxRetries) {
      console.log('ConnectionManager: Max retries reached');
      return;
    }
    
    this.retryCount++;
    const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff
    
    console.log(`ConnectionManager: Scheduling reconnect attempt ${this.retryCount} in ${delay}ms`);
    
    this.updateOverallStatus('reconnecting');
    this.notifyListeners();
    
    this.reconnectTimer = window.setTimeout(async () => {
      await this.connect();
    }, delay);
  }
  
  /**
   * Stop reconnect timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Update overall connection status based on individual statuses
   */
  private updateOverallStatus(forceStatus?: ConnectionStatus): void {
    if (forceStatus) {
      this.state.value.overall = forceStatus;
      return;
    }
    
    const { api, websocket } = this.state.value;
    
    // If both have errors, overall is error
    if (api.status === 'error' && websocket.status === 'error') {
      this.state.value.overall = 'error';
    }
    // If any is connecting, overall is connecting
    else if (api.status === 'connecting' || websocket.status === 'connecting') {
      this.state.value.overall = 'connecting';
    }
    // If any is reconnecting, overall is reconnecting
    else if (api.status === 'reconnecting' || websocket.status === 'reconnecting') {
      this.state.value.overall = 'reconnecting';
    }
    // If API is connected (WebSocket is optional based on auth)
    else if (api.status === 'connected') {
      if (!this.authStore.isAuthenticated || websocket.status === 'connected') {
        this.state.value.overall = 'connected';
      } else if (websocket.status === 'error') {
        this.state.value.overall = 'error';
      } else {
        this.state.value.overall = 'connecting';
      }
    }
    // If API has error, overall has error
    else if (api.status === 'error') {
      this.state.value.overall = 'error';
    }
    // Default to disconnected
    else {
      this.state.value.overall = 'disconnected';
    }
  }
  
  /**
   * Add event listener for connection state changes
   */
  public onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }
  
  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => {
      try {
        callback(this.state.value);
      } catch (error) {
        console.error('ConnectionManager: Error in state change listener:', error);
      }
    });
  }
  
  /**
   * Get current connection statistics
   */
  public getConnectionStats() {
    return {
      api: {
        status: this.state.value.api.status,
        lastCheck: this.state.value.api.lastCheck,
        error: this.state.value.api.error
      },
      websocket: {
        status: this.state.value.websocket.status,
        lastCheck: this.state.value.websocket.lastCheck,
        error: this.state.value.websocket.error,
        socketId: this.socketService.socketId,
        isConnected: this.socketService.isConnected
      },
      overall: this.state.value.overall,
      retryCount: this.retryCount,
      maxRetries: this.options.maxRetries
    };
  }
}

// Composable hook for using the connection manager
export function useConnectionManager(options?: ConnectionManagerOptions) {
  const manager = ConnectionManager.getInstance(options);
  
  return {
    connectionState: manager.connectionState,
    isConnected: manager.isConnected,
    isConnecting: manager.isConnecting,
    hasError: manager.hasError,
    apiStatus: manager.apiStatus,
    websocketStatus: manager.websocketStatus,
    connect: () => manager.connect(),
    disconnect: () => manager.disconnect(),
    reconnect: () => manager.reconnect(),
    onStateChange: (callback: (state: ConnectionState) => void) => manager.onStateChange(callback),
    getStats: () => manager.getConnectionStats()
  };
}

export { ConnectionManager };
export type { ConnectionState, ConnectionManagerOptions };
