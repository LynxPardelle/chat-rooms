/**
 * Search Service - Frontend API Client for Message Search
 * 
 * This service handles all API communications related to message search functionality.
 * It provides methods for advanced search, suggestions, and result caching.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 */

import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { SearchSortOrder } from '../types/chat-module.types';
import type { 
  AdvancedSearchRequest, 
  SearchResults, 
  SearchSuggestions
} from '../types/chat-module.types';

// =============================================================================
// TYPES
// =============================================================================

interface SearchServiceConfig {
  readonly baseURL: string;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly retryDelay: number;
}

interface CacheEntry<T> {
  readonly data: T;
  readonly timestamp: number;
  readonly ttl: number;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: SearchServiceConfig = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  timeout: 10000, // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const SEARCH_CACHE_SIZE = 50; // Maximum cached searches

// =============================================================================
// SEARCH SERVICE CLASS
// =============================================================================

export class SearchService {
  private readonly config: SearchServiceConfig;
  private readonly cache = new Map<string, CacheEntry<SearchResults>>();
  private readonly suggestionCache = new Map<string, CacheEntry<SearchSuggestions>>();
  private abortController: AbortController | null = null;

  constructor(config: Partial<SearchServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  /**
   * Perform advanced message search with filters and pagination
   */
  async searchMessages(request: AdvancedSearchRequest): Promise<SearchResults> {
    // Cancel any ongoing search
    this.cancelCurrentSearch();

    const cacheKey = this.generateCacheKey(request);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Create new abort controller for this search
    this.abortController = new AbortController();

    try {
      const response = await this.makeRequest<SearchResults>('/messages/search/advanced', {
        method: 'POST',
        data: request,
        signal: this.abortController.signal
      });

      // Cache the result
      this.setCache(cacheKey, response.data);

      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) {
        throw new Error('Search was cancelled');
      }
      throw this.handleError(error, 'Failed to search messages');
    }
  }

  /**
   * Get search suggestions for autocomplete
   */
  async getSuggestions(query: string): Promise<SearchSuggestions> {
    if (!query.trim()) {
      return {
        suggestions: [],
        hashtagSuggestions: [],
        mentionSuggestions: [],
        historySuggestions: []
      };
    }

    const cacheKey = `suggestions:${query.toLowerCase()}`;
    const cached = this.getSuggestionFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<SearchSuggestions>('/messages/search/suggestions', {
        method: 'GET',
        params: { query }
      });

      // Cache suggestions for a shorter time
      this.setSuggestionCache(cacheKey, response.data);

      return response.data;
    } catch (error) {
      console.warn('Failed to get search suggestions:', error);
      // Return empty suggestions on error to not break UX
      return {
        suggestions: [],
        hashtagSuggestions: [],
        mentionSuggestions: [],
        historySuggestions: []
      };
    }
  }

  /**
   * Cancel the current search request
   */
  cancelCurrentSearch(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Clear all cached search results
   */
  clearCache(): void {
    this.cache.clear();
    this.suggestionCache.clear();
  }

  /**
   * Clean expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    
    // Clean search cache
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }

    // Clean suggestion cache
    for (const [key, entry] of this.suggestionCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.suggestionCache.delete(key);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private async makeRequest<T>(url: string, config: any): Promise<AxiosResponse<T>> {
    const fullConfig = {
      ...config,
      url: `${this.config.baseURL}${url}`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      }
    };

    // Add authorization header if available
    const token = localStorage.getItem('authToken');
    if (token) {
      fullConfig.headers.Authorization = `Bearer ${token}`;
    }

    return await this.makeRequestWithRetry<T>(fullConfig);
  }

  private async makeRequestWithRetry<T>(config: any, attempt = 1): Promise<AxiosResponse<T>> {
    try {
      return await axios(config);
    } catch (error) {
      if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
        await this.delay(this.config.retryDelay * attempt);
        return this.makeRequestWithRetry<T>(config, attempt + 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx server errors
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateCacheKey(request: AdvancedSearchRequest): string {
    // Create a consistent cache key from search parameters
    const key = JSON.stringify({
      query: request.query,
      page: request.page || 1,
      limit: request.limit || 20,
      sortBy: request.sortBy || SearchSortOrder.RELEVANCE,
      userId: request.userId,
      roomId: request.roomId,
      startDate: request.startDate,
      endDate: request.endDate,
      hashtags: request.hashtags?.sort(),
      mentions: request.mentions?.sort(),
      hasAttachments: request.hasAttachments,
      includeDeleted: request.includeDeleted,
      includeEdited: request.includeEdited
    });
    
    return `search:${btoa(key)}`;
  }

  private getFromCache(key: string): SearchResults | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }
  private setCache(key: string, data: SearchResults): void {
    // Implement LRU cache by removing oldest entries when at capacity
    if (this.cache.size >= SEARCH_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    });
  }

  private getSuggestionFromCache(key: string): SearchSuggestions | null {
    const entry = this.suggestionCache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.suggestionCache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setSuggestionCache(key: string, data: SearchSuggestions): void {
    // Shorter TTL for suggestions (2 minutes)
    const suggestionTTL = 2 * 60 * 1000;
    
    this.suggestionCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: suggestionTTL
    });
  }

  private handleError(error: any, defaultMessage: string): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error(defaultMessage);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

export const searchService = new SearchService();
export default searchService;
