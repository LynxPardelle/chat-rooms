<template>
  <div class="message-search">
    <!-- Search Header -->
    <div class="search-header p-3 border-bottom">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h5 class="mb-0">
          <i class="bi bi-search me-2"></i>
          Search Messages
        </h5>
        <div class="d-flex gap-2">
          <button 
            class="btn btn-outline-secondary btn-sm"
            @click="toggleAdvancedMode"
            :class="{ active: searchStore.isAdvancedMode }"
          >
            <i class="bi bi-sliders me-1"></i>
            Advanced
          </button>
          <button 
            class="btn btn-outline-secondary btn-sm"
            @click="clearSearch"
            :disabled="!searchStore.isSearchActive"
          >
            <i class="bi bi-x-circle me-1"></i>
            Clear
          </button>
          <button 
            class="btn btn-outline-secondary btn-sm"
            @click="closeSearch"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="search-input-container position-relative">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            class="form-control"
            placeholder="Search messages... (use #hashtag or @mention for specific searches)"
            :disabled="searchStore.isSearching"
            @keydown.escape="clearSearch"
            @keydown.enter.prevent="performSearch"
          />
          <button 
            v-if="searchStore.isSearching"
            class="btn btn-outline-secondary"
            @click="cancelSearch"
            type="button"
          >
            <div class="spinner-border spinner-border-sm me-1" role="status">
              <span class="visually-hidden">Searching...</span>
            </div>
            Cancel
          </button>
          <button 
            v-else
            class="btn btn-primary"
            @click="performSearch"
            :disabled="!searchStore.canSearch"
            type="button"
          >
            Search
          </button>
        </div>

        <!-- Search Suggestions Dropdown -->
        <SearchSuggestions
          v-if="showSuggestions"
          :suggestions="searchStore.suggestions"
          :is-loading="searchStore.isLoadingSuggestions"
          :recent-searches="searchStore.recentSearches"
          @select-suggestion="selectSuggestion"
          @select-recent="selectRecentSearch"
          @close="closeSuggestions"
        />
      </div>

      <!-- Advanced Filters -->
      <SearchFilters
        v-if="searchStore.isAdvancedMode"
        :filters="searchStore.filters"
        :sort-by="searchStore.sortBy"
        @update-filters="updateFilters"
        @update-sort="updateSort"
        @reset-filters="resetFilters"
      />

      <!-- Search Stats -->
      <div v-if="searchStore.hasResults" class="search-stats mt-2 text-muted small">
        <i class="bi bi-info-circle me-1"></i>
        Found {{ searchStore.totalResults.toLocaleString() }} results
        <span v-if="searchStore.results?.searchTime">
          in {{ searchStore.results.searchTime }}ms
        </span>
        <span v-if="searchStore.hasActiveFilters" class="ms-2">
          <i class="bi bi-funnel me-1"></i>
          Filters active
        </span>
      </div>

      <!-- Error Display -->
      <div v-if="searchStore.error" class="alert alert-danger mt-2 mb-0" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>
        {{ searchStore.error }}
        <button 
          class="btn btn-link btn-sm p-0 ms-2"
          @click="retrySearch"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Search Results -->
    <div class="search-results flex-1">
      <SearchResults
        v-if="searchStore.hasResults"
        :results="searchStore.results"
        :current-page="searchStore.currentPage"
        :is-loading="searchStore.isSearching"
        @go-to-page="goToPage"
        @next-page="nextPage"
        @prev-page="prevPage"
        @message-click="handleMessageClick"
      />

      <!-- Empty State -->
      <div 
        v-else-if="!searchStore.isSearching && searchStore.isSearchActive && !searchStore.hasResults"
        class="empty-state text-center p-5"
      >
        <i class="bi bi-search display-1 text-muted mb-3"></i>
        <h5 class="text-muted">No messages found</h5>
        <p class="text-muted mb-3">
          Try adjusting your search terms or filters
        </p>
        <button 
          class="btn btn-outline-primary"
          @click="resetFilters"
          v-if="searchStore.hasActiveFilters"
        >
          <i class="bi bi-funnel-fill me-1"></i>
          Clear Filters
        </button>
      </div>

      <!-- Initial State -->
      <div 
        v-else-if="!searchStore.isSearchActive"
        class="initial-state text-center p-5"
      >
        <i class="bi bi-chat-text display-1 text-muted mb-3"></i>
        <h5 class="text-muted">Search Messages</h5>
        <p class="text-muted mb-3">
          Find specific messages, hashtags, or mentions
        </p>
        
        <!-- Recent Searches -->
        <div v-if="searchStore.recentSearches.length > 0" class="recent-searches">
          <h6 class="text-muted mb-2">Recent Searches</h6>
          <div class="d-flex flex-wrap gap-2 justify-content-center">
            <button
              v-for="recent in searchStore.recentSearches.slice(0, 5)"
              :key="recent"
              class="btn btn-outline-secondary btn-sm"
              @click="selectRecentSearch(recent)"
            >
              {{ recent }}
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div 
        v-else-if="searchStore.isSearching"
        class="loading-state text-center p-5"
      >
        <div class="spinner-border text-primary mb-3" role="status">
          <span class="visually-hidden">Searching...</span>
        </div>
        <h5 class="text-muted">Searching messages...</h5>
        <p class="text-muted">
          Looking for "{{ searchStore.query }}"
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useSearchStore } from '../stores/search.store';
import SearchSuggestions from './SearchSuggestions.vue';
import SearchFilters from './SearchFilters.vue';
import SearchResults from './SearchResults.vue';
import type { SearchFilters as SearchFiltersType } from '../types/chat-module.types';
import { SearchSortOrder } from '../types/chat-module.types';

// =============================================================================
// PROPS & EMITS
// =============================================================================

interface Props {
  autoFocus?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoFocus: true
});

const emit = defineEmits<{
  close: [];
  messageClick: [messageId: string, roomId: string];
}>();

// =============================================================================
// STORE & REFS
// =============================================================================

const searchStore = useSearchStore();
const searchInput = ref<HTMLInputElement>();
const searchQuery = ref('');
const showSuggestions = ref(false);

// =============================================================================
// COMPUTED
// =============================================================================

const canShowSuggestions = computed(() => {
  return searchQuery.value.length > 0 && 
         !searchStore.isSearching && 
         (searchStore.suggestions || searchStore.recentSearches.length > 0);
});

// =============================================================================
// METHODS
// =============================================================================

function performSearch(): void {
  if (searchStore.canSearch) {
    searchStore.setQuery(searchQuery.value);
    closeSuggestions();
  }
}

function clearSearch(): void {
  searchQuery.value = '';
  searchStore.clearSearch();
  closeSuggestions();
  searchInput.value?.focus();
}

function cancelSearch(): void {
  searchStore.clearSearch();
}

function retrySearch(): void {
  if (searchStore.canSearch) {
    searchStore.performSearch();
  }
}

function closeSearch(): void {
  clearSearch();
  emit('close');
}

function toggleAdvancedMode(): void {
  searchStore.toggleAdvancedMode();
}

function selectSuggestion(suggestion: string): void {
  searchQuery.value = suggestion;
  searchStore.setQuery(suggestion);
  closeSuggestions();
}

function selectRecentSearch(recent: string): void {
  searchQuery.value = recent;
  searchStore.setQuery(recent);
  closeSuggestions();
}

function updateFilters(filters: Partial<SearchFiltersType>): void {
  searchStore.setFilters(filters);
}

function updateSort(sortBy: SearchSortOrder): void {
  searchStore.setSortBy(sortBy);
}

function resetFilters(): void {
  searchStore.resetFilters();
}

function goToPage(page: number): void {
  searchStore.goToPage(page);
}

function nextPage(): void {
  searchStore.nextPage();
}

function prevPage(): void {
  searchStore.prevPage();
}

function handleMessageClick(messageId: string, roomId: string): void {
  emit('messageClick', messageId, roomId);
}

function closeSuggestions(): void {
  showSuggestions.value = false;
}

function openSuggestions(): void {
  if (canShowSuggestions.value) {
    showSuggestions.value = true;
  }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function handleInputFocus(): void {
  openSuggestions();
}

function handleInputBlur(): void {
  // Delay closing suggestions to allow clicking on them
  setTimeout(() => {
    closeSuggestions();
  }, 200);
}

function handleDocumentClick(event: Event): void {
  const target = event.target as Element;
  const searchContainer = searchInput.value?.closest('.search-input-container');
  
  if (searchContainer && !searchContainer.contains(target)) {
    closeSuggestions();
  }
}

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

function handleKeydown(event: KeyboardEvent): void {
  // Escape to close
  if (event.key === 'Escape') {
    closeSearch();
    return;
  }

  // Ctrl/Cmd + F to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault();
    searchInput.value?.focus();
    return;
  }
}

// =============================================================================
// LIFECYCLE
// =============================================================================

onMounted(async () => {
  // Auto-focus search input
  if (props.autoFocus) {
    await nextTick();
    searchInput.value?.focus();
  }

  // Add event listeners
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleDocumentClick);

  // Add input event listeners
  if (searchInput.value) {
    searchInput.value.addEventListener('focus', handleInputFocus);
    searchInput.value.addEventListener('blur', handleInputBlur);
  }
});

onUnmounted(() => {
  // Remove event listeners
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleDocumentClick);

  if (searchInput.value) {
    searchInput.value.removeEventListener('focus', handleInputFocus);
    searchInput.value.removeEventListener('blur', handleInputBlur);
  }

  // Clear any ongoing searches
  searchStore.clearSearch();
});

// =============================================================================
// WATCHERS
// =============================================================================

// Sync local query with store
import { watch } from 'vue';

watch(searchQuery, (newQuery) => {
  if (newQuery !== searchStore.query) {
    if (newQuery.length >= 2) {
      openSuggestions();
    } else {
      closeSuggestions();
    }
  }
});

watch(() => searchStore.query, (newQuery) => {
  if (newQuery !== searchQuery.value) {
    searchQuery.value = newQuery;
  }
});
</script>

<style scoped>
.message-search {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.search-header {
  flex-shrink: 0;
  background: #f8f9fa;
}

.search-input-container {
  position: relative;
}

.search-results {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.empty-state,
.initial-state,
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.recent-searches {
  max-width: 400px;
}

/* Button states */
.btn.active {
  background-color: var(--bs-primary);
  border-color: var(--bs-primary);
  color: white;
}

/* Search input enhancements */
.input-group .form-control:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

/* Suggestion dropdown positioning */
.search-input-container .suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1050;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .search-header {
    padding: 1rem !important;
  }
  
  .d-flex.gap-2 {
    gap: 0.5rem !important;
  }
  
  .btn-sm {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}

/* Animation for mode toggle */
.btn {
  transition: all 0.15s ease-in-out;
}

/* Loading spinner */
.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}
</style>
