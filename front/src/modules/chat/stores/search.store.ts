/**
 * Search Store - Pinia Store for Message Search State Management
 * 
 * This store manages all search-related state including queries, filters, results,
 * and search history. It provides reactive state management for search components.
 * 
 * @version 1.0.0
 * @created 2024-12-19
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { searchService } from '../services/search.service';
import type {
  SearchResults,
  SearchSuggestions,
  SearchFilters,
  AdvancedSearchRequest,
  SearchHistoryItem
} from '../types/chat-module.types';
import { SearchSortOrder } from '../types/chat-module.types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_FILTERS: SearchFilters = {
  dateRange: {
    start: null,
    end: null
  },
  selectedUsers: [],
  selectedRooms: [],
  messageTypes: [],
  hasAttachments: null,
  includeDeleted: false,
  includeEdited: true
};

const MAX_RECENT_SEARCHES = 20;
const DEBOUNCE_DELAY = 300; // ms

// =============================================================================
// SEARCH STORE
// =============================================================================

export const useSearchStore = defineStore('search', () => {
  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const isSearching = ref(false);
  const query = ref('');
  const filters = ref<SearchFilters>({ ...DEFAULT_FILTERS });
  const results = ref<SearchResults | null>(null);
  const suggestions = ref<SearchSuggestions | null>(null);
  const recentSearches = ref<string[]>([]);
  const searchHistory = ref<SearchHistoryItem[]>([]);
  const error = ref<string | null>(null);
  const sortBy = ref<SearchSortOrder>(SearchSortOrder.RELEVANCE);
  const currentPage = ref(1);
  const isAdvancedMode = ref(false);
  const isLoadingSuggestions = ref(false);

  // Debounce timer for search queries
  let searchTimeout: NodeJS.Timeout | null = null;
  let suggestionTimeout: NodeJS.Timeout | null = null;

  // ---------------------------------------------------------------------------
  // COMPUTED
  // ---------------------------------------------------------------------------

  const hasResults = computed(() => results.value && results.value.results.length > 0);
  
  const hasActiveFilters = computed(() => {
    const f = filters.value;
    return (
      f.dateRange.start !== null ||
      f.dateRange.end !== null ||
      f.selectedUsers.length > 0 ||
      f.selectedRooms.length > 0 ||
      f.messageTypes.length > 0 ||
      f.hasAttachments !== null ||
      f.includeDeleted ||
      !f.includeEdited
    );
  });

  const totalResults = computed(() => results.value?.totalMatches || 0);
  
  const hasNextPage = computed(() => results.value?.pagination.hasNext || false);
  
  const hasPrevPage = computed(() => results.value?.pagination.hasPrev || false);

  const isSearchActive = computed(() => query.value.trim().length > 0);

  const canSearch = computed(() => query.value.trim().length >= 2);

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  /**
   * Set the search query and trigger debounced search
   */
  function setQuery(newQuery: string): void {
    query.value = newQuery;
    error.value = null;

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Don't search for very short queries
    if (newQuery.trim().length < 2) {
      results.value = null;
      return;
    }

    // Debounced search
    searchTimeout = setTimeout(() => {
      performSearch();
    }, DEBOUNCE_DELAY);
  }

  /**
   * Set search filters
   */
  function setFilters(newFilters: Partial<SearchFilters>): void {
    filters.value = { ...filters.value, ...newFilters };
    currentPage.value = 1; // Reset to first page when filters change
    
    if (canSearch.value) {
      performSearch();
    }
  }

  /**
   * Set sort order
   */
  function setSortBy(newSortBy: SearchSortOrder): void {
    sortBy.value = newSortBy;
    currentPage.value = 1; // Reset to first page when sort changes
    
    if (canSearch.value) {
      performSearch();
    }
  }

  /**
   * Go to specific page
   */
  function goToPage(page: number): void {
    if (page < 1) return;
    
    currentPage.value = page;
    performSearch();
  }

  /**
   * Go to next page
   */
  function nextPage(): void {
    if (hasNextPage.value) {
      goToPage(currentPage.value + 1);
    }
  }

  /**
   * Go to previous page
   */
  function prevPage(): void {
    if (hasPrevPage.value) {
      goToPage(currentPage.value - 1);
    }
  }

  /**
   * Perform the actual search
   */
  async function performSearch(): Promise<void> {
    if (!canSearch.value || isSearching.value) {
      return;
    }

    isSearching.value = true;
    error.value = null;

    try {
      const searchRequest: AdvancedSearchRequest = {
        query: query.value.trim(),
        page: currentPage.value,
        limit: 20,
        sortBy: sortBy.value,
        userId: filters.value.selectedUsers.length > 0 ? filters.value.selectedUsers[0] : undefined,
        roomId: filters.value.selectedRooms.length > 0 ? filters.value.selectedRooms[0] : undefined,
        startDate: filters.value.dateRange.start?.toISOString(),
        endDate: filters.value.dateRange.end?.toISOString(),
        hashtags: extractHashtags(query.value),
        mentions: extractMentions(query.value),
        hasAttachments: filters.value.hasAttachments || undefined,
        includeDeleted: filters.value.includeDeleted,
        includeEdited: filters.value.includeEdited
      };

      const result = await searchService.searchMessages(searchRequest);
      results.value = result;

      // Add to search history if it's a new search (page 1)
      if (currentPage.value === 1) {
        addToSearchHistory(query.value, filters.value, result.totalMatches);
        addToRecentSearches(query.value);
      }

    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
      results.value = null;
    } finally {
      isSearching.value = false;
    }
  }

  /**
   * Load search suggestions for autocomplete
   */
  async function loadSuggestions(queryText: string): Promise<void> {
    if (queryText.trim().length < 1) {
      suggestions.value = null;
      return;
    }

    // Clear existing timeout
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }

    suggestionTimeout = setTimeout(async () => {
      isLoadingSuggestions.value = true;
      
      try {
        const result = await searchService.getSuggestions(queryText);
        suggestions.value = result;
      } catch (err) {
        console.warn('Failed to load suggestions:', err);
        suggestions.value = null;
      } finally {
        isLoadingSuggestions.value = false;
      }
    }, 200); // Shorter delay for suggestions
  }

  /**
   * Clear all search data
   */
  function clearSearch(): void {
    query.value = '';
    results.value = null;
    suggestions.value = null;
    error.value = null;
    currentPage.value = 1;
    
    // Cancel any pending searches
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }
    
    searchService.cancelCurrentSearch();
  }

  /**
   * Reset filters to default
   */
  function resetFilters(): void {
    filters.value = { ...DEFAULT_FILTERS };
    currentPage.value = 1;
    
    if (canSearch.value) {
      performSearch();
    }
  }

  /**
   * Toggle advanced search mode
   */
  function toggleAdvancedMode(): void {
    isAdvancedMode.value = !isAdvancedMode.value;
  }

  /**
   * Use a recent search query
   */
  function useRecentSearch(searchQuery: string): void {
    setQuery(searchQuery);
  }

  /**
   * Clear search history
   */
  function clearSearchHistory(): void {
    recentSearches.value = [];
    searchHistory.value = [];
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  function addToRecentSearches(searchQuery: string): void {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // Remove existing occurrence
    const filtered = recentSearches.value.filter(q => q !== trimmed);
    
    // Add to beginning
    recentSearches.value = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  }

  function addToSearchHistory(searchQuery: string, searchFilters: SearchFilters, resultCount: number): void {
    const historyItem: SearchHistoryItem = {
      query: searchQuery.trim(),
      filters: { ...searchFilters },
      timestamp: new Date(),
      resultCount
    };

    searchHistory.value = [historyItem, ...searchHistory.value].slice(0, MAX_RECENT_SEARCHES);
  }

  function extractHashtags(text: string): string[] {
    const hashtagRegex = /#([a-zA-Z0-9_]+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  function extractMentions(text: string): string[] {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(match => match.substring(1)) : [];
  }

  // ---------------------------------------------------------------------------
  // WATCHERS
  // ---------------------------------------------------------------------------

  // Watch for query changes to load suggestions
  watch(query, (newQuery) => {
    if (newQuery.trim().length > 0) {
      loadSuggestions(newQuery);
    } else {
      suggestions.value = null;
    }
  });

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  // Load recent searches from localStorage on store creation
  function loadPersistedData(): void {
    try {
      const stored = localStorage.getItem('chat-recent-searches');
      if (stored) {
        recentSearches.value = JSON.parse(stored);
      }
    } catch (err) {
      console.warn('Failed to load recent searches from localStorage:', err);
    }
  }

  // Save recent searches to localStorage
  watch(recentSearches, (newSearches) => {
    try {
      localStorage.setItem('chat-recent-searches', JSON.stringify(newSearches));
    } catch (err) {
      console.warn('Failed to save recent searches to localStorage:', err);
    }
  }, { deep: true });

  // Initialize persisted data
  loadPersistedData();

  // ---------------------------------------------------------------------------
  // RETURN STORE API
  // ---------------------------------------------------------------------------

  return {
    // State
    isSearching,
    query,
    filters,
    results,
    suggestions,
    recentSearches,
    searchHistory,
    error,
    sortBy,
    currentPage,
    isAdvancedMode,
    isLoadingSuggestions,

    // Computed
    hasResults,
    hasActiveFilters,
    totalResults,
    hasNextPage,
    hasPrevPage,
    isSearchActive,
    canSearch,

    // Actions
    setQuery,
    setFilters,
    setSortBy,
    goToPage,
    nextPage,
    prevPage,
    performSearch,
    loadSuggestions,
    clearSearch,
    resetFilters,
    toggleAdvancedMode,
    useRecentSearch,
    clearSearchHistory
  };
});

export default useSearchStore;
