/**
 * Chat Service - HTTP API Communication for Chat Module
 * 
 * This service handles HTTP requests to the chat API endpoints.
 * It provides methods for fetching rooms, messages, users, and other
 * chat-related data that doesn't require real-time updates.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 */

import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type {
  MessagesResponse,
  RoomsResponse,
  RoomUsersResponse,
  ChatRoom,
  CreateRoomDto,
  MessageSearchFilters
} from '../types/chat-module.types';

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 10000;

/**
 * Request configuration type
 */
type RequestConfig = AxiosRequestConfig & {
  requiresAuth?: boolean;
};

/**
 * Pagination parameters
 */
type PaginationParams = {
  page?: number;
  limit?: number;
};

/**
 * Chat service class for API communication
 */
class ChatService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Setup request interceptor for authentication
    this.api.interceptors.request.use((config) => {
      const token = this.getAuthToken();
      if (token && config.url !== '/auth/login' && config.url !== '/auth/register') {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Setup response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          this.handleUnauthorized();
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    try {
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  /**
   * Handle unauthorized responses
   */
  private handleUnauthorized(): void {
    // Clear auth data and redirect to login
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/auth/login';
  }

  /**
   * Make HTTP request with error handling
   */
  private async request<T>(config: RequestConfig): Promise<T> {
    try {
      const response = await this.api.request<T>(config);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(message);
      }
      throw error;
    }
  }

  // =============================================================================
  // ROOM METHODS
  // =============================================================================

  /**
   * Get list of available rooms
   */
  async getRooms(params: PaginationParams = {}): Promise<RoomsResponse> {
    return this.request<RoomsResponse>({
      method: 'GET',
      url: '/api/chat/rooms',
      params: {
        page: params.page || 1,
        limit: params.limit || 20
      }
    });
  }

  /**
   * Get room details by ID
   */
  async getRoom(roomId: string): Promise<ChatRoom> {
    return this.request<ChatRoom>({
      method: 'GET',
      url: `/api/chat/rooms/${roomId}`
    });
  }

  /**
   * Create a new room
   */
  async createRoom(data: CreateRoomDto): Promise<ChatRoom> {
    return this.request<ChatRoom>({
      method: 'POST',
      url: '/api/chat/rooms',
      data
    });
  }

  /**
   * Update room details
   */
  async updateRoom(roomId: string, data: Partial<CreateRoomDto>): Promise<ChatRoom> {
    return this.request<ChatRoom>({
      method: 'PATCH',
      url: `/api/chat/rooms/${roomId}`,
      data
    });
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/api/chat/rooms/${roomId}`
    });
  }

  // =============================================================================
  // MESSAGE METHODS
  // =============================================================================

  /**
   * Get messages for a room
   */
  async getMessages(
    roomId: string, 
    params: PaginationParams = {}
  ): Promise<MessagesResponse> {
    return this.request<MessagesResponse>({
      method: 'GET',
      url: `/api/chat/rooms/${roomId}/messages`,
      params: {
        page: params.page || 1,
        limit: params.limit || 50
      }
    });
  }

  /**
   * Search messages
   */
  async searchMessages(
    roomId: string,
    filters: MessageSearchFilters,
    params: PaginationParams = {}
  ): Promise<MessagesResponse> {
    return this.request<MessagesResponse>({
      method: 'POST',
      url: `/api/chat/rooms/${roomId}/messages/search`,
      data: filters,
      params: {
        page: params.page || 1,
        limit: params.limit || 50
      }
    });
  }

  /**
   * Update a message
   */
  async updateMessage(roomId: string, messageId: string, content: string): Promise<void> {
    return this.request<void>({
      method: 'PATCH',
      url: `/api/chat/rooms/${roomId}/messages/${messageId}`,
      data: { content }
    });
  }

  /**
   * Delete a message
   */
  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/api/chat/rooms/${roomId}/messages/${messageId}`
    });
  }

  // =============================================================================
  // USER METHODS
  // =============================================================================

  /**
   * Get users in a room
   */
  async getRoomUsers(roomId: string): Promise<RoomUsersResponse> {
    return this.request<RoomUsersResponse>({
      method: 'GET',
      url: `/api/chat/rooms/${roomId}/users`
    });
  }

  /**
   * Get online users across all rooms
   */
  async getOnlineUsers(): Promise<{ users: any[] }> {
    return this.request<{ users: any[] }>({
      method: 'GET',
      url: '/api/chat/users/online'
    });
  }

  // =============================================================================
  // FILE UPLOAD METHODS
  // =============================================================================

  /**
   * Upload file for chat
   */
  async uploadFile(
    file: File,
    roomId: string,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    return this.request<{ url: string; filename: string }>({
      method: 'POST',
      url: '/api/chat/upload',
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress(progress);
        }
      }
    });
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(filename: string): Promise<void> {
    return this.request<void>({
      method: 'DELETE',
      url: `/api/chat/upload/${encodeURIComponent(filename)}`
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Get API health status
   */
  async getHealthStatus(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>({
      method: 'GET',
      url: '/health/security'
    });
  }

  /**
   * Test connection to API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getHealthStatus();
      return true;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
const chatService = new ChatService();

/**
 * Composable hook for using the chat service
 */
export function useChatService() {
  return chatService;
}

export { ChatService };
