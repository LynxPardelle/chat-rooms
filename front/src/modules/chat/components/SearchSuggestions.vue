<template>
  <div 
    class="suggestions-dropdown card shadow-sm border-0"
    v-if="shouldShow"
  >
    <div class="card-body p-0">
      <!-- Loading State -->
      <div v-if="isLoading" class="suggestion-loading text-center p-3">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <small class="text-muted">Getting suggestions...</small>
      </div>

      <!-- Main Suggestions -->
      <div v-else-if="suggestions && suggestions.suggestions.length > 0">
        <div class="suggestion-section">
          <div class="suggestion-header px-3 py-2 bg-light">
            <small class="text-muted fw-semibold">
              <i class="bi bi-search me-1"></i>
              Suggestions
            </small>
          </div>
          <div class="suggestion-list">
            <button
              v-for="(suggestion, index) in suggestions.suggestions.slice(0, 5)"
              :key="`suggestion-${index}`"
              class="suggestion-item"
              @click="selectSuggestion(suggestion)"
              @mouseenter="highlightItem(`suggestion-${index}`)"
            >
              <i class="bi bi-search me-2 text-muted"></i>
              <span v-html="highlightText(suggestion)"></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Hashtag Suggestions -->
      <div v-if="suggestions && suggestions.hashtagSuggestions.length > 0">
        <div class="suggestion-section">
          <div class="suggestion-header px-3 py-2 bg-light">
            <small class="text-muted fw-semibold">
              <i class="bi bi-hash me-1"></i>
              Hashtags
            </small>
          </div>
          <div class="suggestion-list">
            <button
              v-for="(hashtag, index) in suggestions.hashtagSuggestions.slice(0, 3)"
              :key="`hashtag-${index}`"
              class="suggestion-item"
              @click="selectSuggestion(`#${hashtag}`)"
              @mouseenter="highlightItem(`hashtag-${index}`)"
            >
              <i class="bi bi-hash me-2 text-primary"></i>
              <span class="text-primary">#{{ hashtag }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Mention Suggestions -->
      <div v-if="suggestions && suggestions.mentionSuggestions.length > 0">
        <div class="suggestion-section">
          <div class="suggestion-header px-3 py-2 bg-light">
            <small class="text-muted fw-semibold">
              <i class="bi bi-at me-1"></i>
              Mentions
            </small>
          </div>
          <div class="suggestion-list">
            <button
              v-for="(mention, index) in suggestions.mentionSuggestions.slice(0, 3)"
              :key="`mention-${index}`"
              class="suggestion-item"
              @click="selectSuggestion(`@${mention.username}`)"
              @mouseenter="highlightItem(`mention-${index}`)"
            >
              <i class="bi bi-at me-2 text-success"></i>
              <div class="d-flex align-items-center">
                <span class="text-success me-2">@{{ mention.username }}</span>
                <small class="text-muted">{{ mention.displayName }}</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Recent Searches -->
      <div v-if="recentSearches && recentSearches.length > 0">
        <div class="suggestion-section">
          <div class="suggestion-header px-3 py-2 bg-light d-flex justify-content-between align-items-center">
            <small class="text-muted fw-semibold">
              <i class="bi bi-clock-history me-1"></i>
              Recent Searches
            </small>
            <button 
              class="btn btn-link btn-sm p-0 text-muted"
              @click="clearRecentSearches"
              title="Clear recent searches"
            >
              <i class="bi bi-x-circle-fill"></i>
            </button>
          </div>
          <div class="suggestion-list">
            <button
              v-for="(recent, index) in recentSearches.slice(0, 3)"
              :key="`recent-${index}`"
              class="suggestion-item"
              @click="selectRecent(recent)"
              @mouseenter="highlightItem(`recent-${index}`)"
            >
              <i class="bi bi-clock-history me-2 text-muted"></i>
              <span>{{ recent }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- History Suggestions from Backend -->
      <div v-if="suggestions && suggestions.historySuggestions.length > 0">
        <div class="suggestion-section">
          <div class="suggestion-header px-3 py-2 bg-light">
            <small class="text-muted fw-semibold">
              <i class="bi bi-archive me-1"></i>
              From History
            </small>
          </div>
          <div class="suggestion-list">
            <button
              v-for="(history, index) in suggestions.historySuggestions.slice(0, 3)"
              :key="`history-${index}`"
              class="suggestion-item"
              @click="selectSuggestion(history)"
              @mouseenter="highlightItem(`history-${index}`)"
            >
              <i class="bi bi-archive me-2 text-info"></i>
              <span>{{ history }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && !hasAnySuggestions" class="suggestion-empty text-center p-3">
        <i class="bi bi-search text-muted mb-2" style="font-size: 1.5rem;"></i>
        <small class="text-muted d-block">No suggestions available</small>
        <small class="text-muted">Try typing more characters</small>
      </div>

      <!-- Footer with Tips -->
      <div v-if="hasAnySuggestions" class="suggestion-footer px-3 py-2 bg-light border-top">
        <small class="text-muted">
          <i class="bi bi-lightbulb me-1"></i>
          Use <kbd>#hashtag</kbd> or <kbd>@username</kbd> for specific searches
        </small>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SearchSuggestions as SearchSuggestionsType } from '../types/chat-module.types';

// =============================================================================
// PROPS & EMITS
// =============================================================================

interface Props {
  suggestions?: SearchSuggestionsType | null;
  recentSearches?: string[];
  isLoading?: boolean;
  currentQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  suggestions: null,
  recentSearches: () => [],
  isLoading: false,
  currentQuery: ''
});

const emit = defineEmits<{
  selectSuggestion: [suggestion: string];
  selectRecent: [recent: string];
  close: [];
  clearRecentSearches: [];
}>();

// =============================================================================
// COMPUTED
// =============================================================================

const shouldShow = computed(() => {
  return props.isLoading || hasAnySuggestions.value;
});

const hasAnySuggestions = computed(() => {
  if (props.suggestions) {
    return (
      props.suggestions.suggestions.length > 0 ||
      props.suggestions.hashtagSuggestions.length > 0 ||
      props.suggestions.mentionSuggestions.length > 0 ||
      props.suggestions.historySuggestions.length > 0
    );
  }
  return props.recentSearches && props.recentSearches.length > 0;
});

// =============================================================================
// METHODS
// =============================================================================

function selectSuggestion(suggestion: string): void {
  emit('selectSuggestion', suggestion);
}

function selectRecent(recent: string): void {
  emit('selectRecent', recent);
}

function clearRecentSearches(): void {
  emit('clearRecentSearches');
}

function highlightItem(itemId: string): void {
  // Remove previous highlights
  const previousHighlighted = document.querySelector('.suggestion-item.highlighted');
  if (previousHighlighted) {
    previousHighlighted.classList.remove('highlighted');
  }

  // Add highlight to current item
  const item = document.querySelector(`[data-item-id="${itemId}"]`);
  if (item) {
    item.classList.add('highlighted');
  }
}

function highlightText(text: string): string {
  if (!props.currentQuery || props.currentQuery.length < 2) {
    return text;
  }

  const query = props.currentQuery.toLowerCase();
  const index = text.toLowerCase().indexOf(query);
  
  if (index === -1) {
    return text;
  }

  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);

  return `${before}<mark class="bg-warning bg-opacity-50">${match}</mark>${after}`;
}

// =============================================================================
// KEYBOARD NAVIGATION
// =============================================================================

function handleKeyNavigation(event: KeyboardEvent): void {
  const suggestions = document.querySelectorAll('.suggestion-item');
  const currentHighlighted = document.querySelector('.suggestion-item.highlighted');
  let currentIndex = -1;

  if (currentHighlighted) {
    currentIndex = Array.from(suggestions).indexOf(currentHighlighted as Element);
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      const nextIndex = currentIndex < suggestions.length - 1 ? currentIndex + 1 : 0;
      highlightItemByIndex(suggestions, nextIndex);
      break;

    case 'ArrowUp':
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : suggestions.length - 1;
      highlightItemByIndex(suggestions, prevIndex);
      break;

    case 'Enter':
      event.preventDefault();
      if (currentHighlighted) {
        (currentHighlighted as HTMLButtonElement).click();
      }
      break;

    case 'Escape':
      emit('close');
      break;
  }
}

function highlightItemByIndex(suggestions: NodeListOf<Element>, index: number): void {
  // Remove all highlights
  suggestions.forEach(item => item.classList.remove('highlighted'));
  
  // Add highlight to target
  if (suggestions[index]) {
    suggestions[index].classList.add('highlighted');
    suggestions[index].scrollIntoView({ block: 'nearest' });
  }
}

// =============================================================================
// LIFECYCLE
// =============================================================================

import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  document.addEventListener('keydown', handleKeyNavigation);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyNavigation);
});
</script>

<style scoped>
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1050;
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.375rem;
}

.suggestion-section {
  border-bottom: 1px solid #e9ecef;
}

.suggestion-section:last-child {
  border-bottom: none;
}

.suggestion-header {
  border-bottom: 1px solid #dee2e6;
  background-color: #f8f9fa !important;
}

.suggestion-list {
  max-height: 150px;
  overflow-y: auto;
}

.suggestion-item {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  background: white;
  text-align: left;
  display: flex;
  align-items: center;
  color: #495057;
  text-decoration: none;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.suggestion-item:hover,
.suggestion-item.highlighted {
  background-color: #f8f9fa;
  color: #212529;
}

.suggestion-item:active {
  background-color: #e9ecef;
}

.suggestion-item:focus {
  outline: none;
  background-color: #e3f2fd;
  color: #1976d2;
}

.suggestion-loading {
  background-color: #f8f9fa;
}

.suggestion-empty {
  background-color: #f8f9fa;
  color: #6c757d;
}

.suggestion-footer {
  background-color: #f8f9fa !important;
  border-top: 1px solid #dee2e6;
}

/* Custom scrollbar for suggestion lists */
.suggestion-list::-webkit-scrollbar {
  width: 4px;
}

.suggestion-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.suggestion-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.suggestion-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Keyboard navigation styles */
kbd {
  background-color: #e9ecef;
  border: 1px solid #adb5bd;
  border-radius: 0.25rem;
  color: #495057;
  font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.75rem;
  padding: 0.125rem 0.25rem;
}

/* Mark highlighting for search matches */
mark {
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .suggestions-dropdown {
    max-height: 300px;
  }
  
  .suggestion-list {
    max-height: 120px;
  }
  
  .suggestion-item {
    padding: 0.75rem;
  }
}

/* Animation for dropdown appearance */
.suggestions-dropdown {
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Loading spinner animation */
.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}
</style>
