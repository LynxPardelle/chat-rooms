<template>
  <div class="search-results">
    <!-- Results Header -->
    <div v-if="results" class="results-header p-3 border-bottom bg-light">
      <div class="d-flex justify-content-between align-items-center">
        <div class="results-info">
          <h6 class="mb-1">
            <i class="bi bi-search me-1"></i>
            Search Results
          </h6>
          <small class="text-muted">
            {{ results.totalMatches.toLocaleString() }} messages found
            <span v-if="results.searchTime">({{ results.searchTime }}ms)</span>
          </small>
        </div>
        
        <!-- Pagination Info -->
        <div v-if="results.pagination.total > 0" class="pagination-info text-muted small">
          Page {{ results.pagination.page }} of {{ results.pagination.totalPages }}
        </div>
      </div>

      <!-- Facets Summary -->
      <div v-if="showFacets && results.facets" class="facets-summary mt-2">
        <div class="row g-2">
          <div v-if="results.facets.userCounts.length > 0" class="col-auto">
            <small class="text-muted">
              <i class="bi bi-person me-1"></i>
              {{ results.facets.userCounts.length }} users
            </small>
          </div>
          <div v-if="results.facets.roomCounts.length > 0" class="col-auto">
            <small class="text-muted">
              <i class="bi bi-chat-dots me-1"></i>
              {{ results.facets.roomCounts.length }} rooms
            </small>
          </div>
          <div v-if="results.facets.hashtagCounts.length > 0" class="col-auto">
            <small class="text-muted">
              <i class="bi bi-hash me-1"></i>
              {{ results.facets.hashtagCounts.length }} hashtags
            </small>
          </div>
        </div>
      </div>
    </div>

    <!-- Results List -->
    <div class="results-list flex-1">
      <div 
        v-if="isLoading" 
        class="loading-overlay d-flex justify-content-center align-items-center p-4"
      >
        <div class="text-center">
          <div class="spinner-border text-primary mb-2" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <div class="small text-muted">Loading results...</div>
        </div>
      </div>

      <div v-else-if="results && results.results.length > 0" class="message-list">
        <div
          v-for="(message, index) in results.results"
          :key="message.id"
          class="message-result"
          :class="{ 'border-bottom': index < results.results.length - 1 }"
          @click="handleMessageClick(message)"
        >
          <!-- Message Header -->
          <div class="message-header d-flex justify-content-between align-items-start">
            <div class="d-flex align-items-center">
              <!-- Author Avatar -->
              <div class="author-avatar me-2">
                <img 
                  v-if="message.author.avatar"
                  :src="message.author.avatar"
                  :alt="message.author.username"
                  class="rounded-circle"
                />
                <div 
                  v-else
                  class="avatar-placeholder rounded-circle d-flex align-items-center justify-content-center"
                >
                  {{ message.author.username.charAt(0).toUpperCase() }}
                </div>
              </div>

              <!-- Author Info -->
              <div class="author-info">
                <div class="author-name fw-semibold">
                  {{ message.author.username }}
                </div>
                <div class="message-meta text-muted small">
                  <span class="room-name">
                    <i class="bi bi-hash me-1"></i>
                    {{ message.room.name }}
                  </span>
                  <span class="mx-2">•</span>
                  <span class="timestamp">
                    {{ formatDate(message.createdAt) }}
                  </span>
                  <span v-if="message.isEdited" class="mx-2">•</span>
                  <span v-if="message.isEdited" class="edited-indicator">
                    <i class="bi bi-pencil me-1"></i>
                    Edited
                  </span>
                </div>
              </div>
            </div>

            <!-- Message Score -->
            <div v-if="showScore" class="message-score">
              <span class="badge bg-light text-dark">
                <i class="bi bi-star-fill me-1"></i>
                {{ message.score.toFixed(2) }}
              </span>
            </div>
          </div>

          <!-- Message Content -->
          <div class="message-content mt-2">
            <!-- Highlighted Content -->
            <div 
              class="highlighted-content"
              v-html="message.highlightedContent"
            ></div>

            <!-- Context (if different from highlighted content) -->
            <div 
              v-if="message.context && message.context !== message.content"
              class="message-context mt-2 p-2 bg-light rounded"
            >
              <small class="text-muted">
                <i class="bi bi-three-dots me-1"></i>
                Context:
              </small>
              <div class="context-text small" v-html="message.context"></div>
            </div>

            <!-- Hashtags -->
            <div v-if="message.hashtags.length > 0" class="hashtags mt-2">
              <span
                v-for="hashtag in message.hashtags"
                :key="hashtag"
                class="badge bg-primary bg-opacity-10 text-primary me-1"
              >
                #{{ hashtag }}
              </span>
            </div>

            <!-- Mentions -->
            <div v-if="message.mentions.length > 0" class="mentions mt-2">
              <span
                v-for="mention in message.mentions"
                :key="mention"
                class="badge bg-success bg-opacity-10 text-success me-1"
              >
                @{{ mention }}
              </span>
            </div>

            <!-- Attachments -->
            <div v-if="message.attachments && message.attachments.length > 0" class="attachments mt-2">
              <div class="d-flex flex-wrap gap-2">
                <div
                  v-for="attachment in message.attachments"
                  :key="attachment.id"
                  class="attachment-badge d-flex align-items-center"
                >
                  <i class="bi bi-paperclip me-1"></i>
                  <span class="small">{{ attachment.filename }}</span>
                  <span class="badge bg-secondary ms-1">{{ attachment.type }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="results && results.results.length === 0" class="empty-results text-center p-5">
        <i class="bi bi-search display-1 text-muted mb-3"></i>
        <h5 class="text-muted">No messages found</h5>
        <p class="text-muted">Try adjusting your search terms or filters</p>
      </div>
    </div>

    <!-- Pagination -->
    <div 
      v-if="results && results.pagination.totalPages > 1" 
      class="pagination-container p-3 border-top bg-light"
    >
      <nav aria-label="Search results pagination">
        <ul class="pagination pagination-sm justify-content-center mb-0">
          <!-- Previous Button -->
          <li class="page-item" :class="{ disabled: !results.pagination.hasPrev }">
            <button
              class="page-link"
              @click="goToPrevPage"
              :disabled="!results.pagination.hasPrev"
            >
              <i class="bi bi-chevron-left"></i>
              Previous
            </button>
          </li>

          <!-- Page Numbers -->
          <li
            v-for="page in visiblePages"
            :key="page"
            class="page-item"
            :class="{ active: page === currentPage }"
          >
            <button
              v-if="page !== '...'"
              class="page-link"
              @click="goToPage(page as number)"
            >
              {{ page }}
            </button>
            <span v-else class="page-link">...</span>
          </li>

          <!-- Next Button -->
          <li class="page-item" :class="{ disabled: !results.pagination.hasNext }">
            <button
              class="page-link"
              @click="goToNextPage"
              :disabled="!results.pagination.hasNext"
            >
              Next
              <i class="bi bi-chevron-right"></i>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Jump to Page -->
      <div v-if="results.pagination.totalPages > 10" class="jump-to-page mt-2 text-center">
        <div class="input-group input-group-sm d-inline-flex" style="width: auto;">
          <span class="input-group-text">Go to page</span>
          <input
            v-model.number="jumpToPageValue"
            type="number"
            class="form-control"
            style="width: 80px;"
            :min="1"
            :max="results.pagination.totalPages"
            @keyup.enter="jumpToPage"
          />
          <button
            class="btn btn-outline-secondary"
            @click="jumpToPage"
            :disabled="!isValidJumpPage"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SearchResults } from '../types/chat-module.types';

// =============================================================================
// PROPS & EMITS
// =============================================================================

interface Props {
  results: SearchResults | null;
  currentPage: number;
  isLoading?: boolean;
  showScore?: boolean;
  showFacets?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  showScore: false,
  showFacets: true
});

const emit = defineEmits<{
  goToPage: [page: number];
  nextPage: [];
  prevPage: [];
  messageClick: [messageId: string, roomId: string];
}>();

// =============================================================================
// REACTIVE STATE
// =============================================================================

const jumpToPageValue = ref<number>(1);

// =============================================================================
// COMPUTED
// =============================================================================

const visiblePages = computed(() => {
  if (!props.results) return [];

  const totalPages = props.results.pagination.totalPages;
  const current = props.currentPage;
  const delta = 2; // Number of pages to show around current page

  let pages: (number | string)[] = [];

  // Always show first page
  if (totalPages > 0) {
    pages.push(1);
  }

  // Add ellipsis after first page if needed
  if (current - delta > 2) {
    pages.push('...');
  }

  // Add pages around current page
  for (let i = Math.max(2, current - delta); i <= Math.min(totalPages - 1, current + delta); i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if needed
  if (current + delta < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page (if it's different from first)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  // Remove duplicates and sort
  const uniquePages = Array.from(new Set(pages)).sort((a, b) => {
    if (typeof a === 'string') return 1;
    if (typeof b === 'string') return -1;
    return a - b;
  });

  return uniquePages;
});

const isValidJumpPage = computed(() => {
  if (!props.results) return false;
  const page = jumpToPageValue.value;
  return page >= 1 && page <= props.results.pagination.totalPages && page !== props.currentPage;
});

// =============================================================================
// METHODS
// =============================================================================

function goToPage(page: number): void {
  emit('goToPage', page);
}

function goToNextPage(): void {
  emit('nextPage');
}

function goToPrevPage(): void {
  emit('prevPage');
}

function jumpToPage(): void {
  if (isValidJumpPage.value) {
    goToPage(jumpToPageValue.value);
  }
}

function handleMessageClick(message: any): void {
  emit('messageClick', message.id, message.room.id);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
</script>

<style scoped>
.search-results {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.results-header {
  flex-shrink: 0;
}

.results-list {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.message-result {
  padding: 1rem;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.message-result:hover {
  background-color: #f8f9fa;
}

.author-avatar img,
.avatar-placeholder {
  width: 32px;
  height: 32px;
}

.avatar-placeholder {
  background-color: #e9ecef;
  color: #6c757d;
  font-size: 0.875rem;
  font-weight: 600;
}

.author-name {
  color: #495057;
  font-size: 0.9rem;
}

.message-meta {
  font-size: 0.8rem;
}

.message-content {
  max-width: 100%;
  word-wrap: break-word;
}

.highlighted-content {
  line-height: 1.5;
}

.highlighted-content :deep(mark) {
  background-color: #fff3cd;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-weight: 500;
}

.message-context {
  border-left: 3px solid #dee2e6;
}

.context-text {
  color: #6c757d;
  font-style: italic;
}

.hashtags .badge,
.mentions .badge {
  font-size: 0.75rem;
  font-weight: 500;
}

.attachment-badge {
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  color: #495057;
}

.pagination-container {
  flex-shrink: 0;
}

.page-link {
  color: #495057;
  border-color: #dee2e6;
}

.page-link:hover {
  color: #0d6efd;
  background-color: #e9ecef;
  border-color: #dee2e6;
}

.page-item.active .page-link {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.jump-to-page input {
  text-align: center;
}

/* Message score badge */
.message-score .badge {
  font-size: 0.7rem;
  border: 1px solid #dee2e6;
}

/* Facets summary */
.facets-summary {
  border-top: 1px solid #e9ecef;
  padding-top: 0.5rem;
}

/* Empty state */
.empty-results {
  color: #6c757d;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .message-result {
    padding: 0.75rem;
  }
  
  .author-avatar img,
  .avatar-placeholder {
    width: 28px;
    height: 28px;
  }
  
  .author-name {
    font-size: 0.85rem;
  }
  
  .message-meta {
    font-size: 0.75rem;
  }
  
  .pagination {
    flex-wrap: wrap;
  }
  
  .jump-to-page {
    margin-top: 0.5rem;
  }
}

/* Smooth scrolling */
.results-list {
  scroll-behavior: smooth;
}

/* Custom scrollbar */
.results-list::-webkit-scrollbar {
  width: 6px;
}

.results-list::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.results-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.results-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Loading animation */
.spinner-border {
  width: 2rem;
  height: 2rem;
}

/* Message hover effect */
.message-result {
  border-left: 3px solid transparent;
  transition: all 0.15s ease-in-out;
}

.message-result:hover {
  border-left-color: #0d6efd;
  transform: translateX(2px);
}

/* Badge animations */
.badge {
  transition: all 0.15s ease-in-out;
}

.hashtags .badge:hover,
.mentions .badge:hover {
  transform: scale(1.05);
}
</style>
