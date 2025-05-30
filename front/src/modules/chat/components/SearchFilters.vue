<template>
  <div class="search-filters card mt-3">
    <div class="card-header py-2">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="mb-0">
          <i class="bi bi-funnel me-1"></i>
          Advanced Filters
        </h6>
        <div class="d-flex gap-2">
          <button 
            class="btn btn-outline-secondary btn-sm"
            @click="resetFilters"
            :disabled="!hasActiveFilters"
          >
            <i class="bi bi-arrow-clockwise me-1"></i>
            Reset
          </button>
          <span 
            v-if="hasActiveFilters"
            class="badge bg-primary"
          >
            {{ activeFilterCount }}
          </span>
        </div>
      </div>
    </div>

    <div class="card-body">
      <div class="row g-3">
        <!-- Date Range Filter -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-calendar-range me-1"></i>
            Date Range
          </label>
          <div class="row g-2">
            <div class="col">
              <input
                v-model="localFilters.dateRange.start"
                type="date"
                class="form-control form-control-sm"
                placeholder="Start date"
                @change="updateFilters"
              />
            </div>
            <div class="col">
              <input
                v-model="localFilters.dateRange.end"
                type="date"
                class="form-control form-control-sm"
                placeholder="End date"
                @change="updateFilters"
              />
            </div>
          </div>
          <small class="form-text text-muted">
            Filter messages by date range
          </small>
        </div>

        <!-- Sort Options -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-sort-down me-1"></i>
            Sort Results
          </label>
          <select
            v-model="localSortBy"
            class="form-select form-select-sm"
            @change="updateSort"
          >
            <option :value="SearchSortOrder.RELEVANCE">Most Relevant</option>
            <option :value="SearchSortOrder.NEWEST">Newest First</option>
            <option :value="SearchSortOrder.OLDEST">Oldest First</option>
          </select>
          <small class="form-text text-muted">
            How to order search results
          </small>
        </div>

        <!-- User Filter -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-person me-1"></i>
            Specific User
          </label>
          <div class="input-group input-group-sm">
            <input
              v-model="userSearchQuery"
              type="text"
              class="form-control"
              placeholder="Search users..."
              @input="searchUsers"
              @focus="showUserDropdown = true"
            />
            <button 
              v-if="localFilters.selectedUsers.length > 0"
              class="btn btn-outline-secondary"
              @click="clearUserFilter"
            >
              <i class="bi bi-x"></i>
            </button>
          </div>
          
          <!-- User Dropdown -->
          <div 
            v-if="showUserDropdown && filteredUsers.length > 0"
            class="dropdown-menu d-block mt-1"
            style="max-height: 200px; overflow-y: auto;"
          >
            <button
              v-for="user in filteredUsers"
              :key="user.id"
              class="dropdown-item d-flex align-items-center"
              @click="selectUser(user)"
            >
              <div class="avatar-sm me-2">
                <img 
                  v-if="user.avatar"
                  :src="user.avatar"
                  :alt="user.username"
                  class="rounded-circle"
                  style="width: 24px; height: 24px;"
                />
                <div 
                  v-else
                  class="avatar-placeholder rounded-circle d-flex align-items-center justify-content-center"
                  style="width: 24px; height: 24px; background: #e9ecef;"
                >
                  {{ user.username.charAt(0).toUpperCase() }}
                </div>
              </div>
              <div>
                <div class="fw-semibold">{{ user.username }}</div>
                <small class="text-muted">{{ user.displayName || user.username }}</small>
              </div>
            </button>
          </div>

          <!-- Selected Users -->
          <div v-if="localFilters.selectedUsers.length > 0" class="mt-2">
            <div class="d-flex flex-wrap gap-1">
              <span
                v-for="userId in localFilters.selectedUsers"
                :key="userId"
                class="badge bg-secondary d-flex align-items-center gap-1"
              >
                {{ getUserDisplayName(userId) }}
                <button 
                  class="btn-close btn-close-white"
                  style="font-size: 0.6rem;"
                  @click="removeUser(userId)"
                ></button>
              </span>
            </div>
          </div>
        </div>

        <!-- Room Filter -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-chat-dots me-1"></i>
            Specific Room
          </label>
          <div class="input-group input-group-sm">
            <input
              v-model="roomSearchQuery"
              type="text"
              class="form-control"
              placeholder="Search rooms..."
              @input="searchRooms"
              @focus="showRoomDropdown = true"
            />
            <button 
              v-if="localFilters.selectedRooms.length > 0"
              class="btn btn-outline-secondary"
              @click="clearRoomFilter"
            >
              <i class="bi bi-x"></i>
            </button>
          </div>
          
          <!-- Room Dropdown -->
          <div 
            v-if="showRoomDropdown && filteredRooms.length > 0"
            class="dropdown-menu d-block mt-1"
            style="max-height: 200px; overflow-y: auto;"
          >
            <button
              v-for="room in filteredRooms"
              :key="room.id"
              class="dropdown-item d-flex align-items-center"
              @click="selectRoom(room)"
            >
              <i class="bi bi-hash me-2 text-muted"></i>
              <div>
                <div class="fw-semibold">{{ room.name }}</div>
                <small class="text-muted">{{ room.description || 'No description' }}</small>
              </div>
            </button>
          </div>

          <!-- Selected Rooms -->
          <div v-if="localFilters.selectedRooms.length > 0" class="mt-2">
            <div class="d-flex flex-wrap gap-1">
              <span
                v-for="roomId in localFilters.selectedRooms"
                :key="roomId"
                class="badge bg-info d-flex align-items-center gap-1"
              >
                {{ getRoomDisplayName(roomId) }}
                <button 
                  class="btn-close btn-close-white"
                  style="font-size: 0.6rem;"
                  @click="removeRoom(roomId)"
                ></button>
              </span>
            </div>
          </div>
        </div>

        <!-- Message Type Filter -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-file-earmark me-1"></i>
            Message Types
          </label>
          <div class="d-flex flex-wrap gap-2">
            <div class="form-check form-check-inline">
              <input
                v-model="localFilters.messageTypes"
                :value="MessageType.TEXT"
                class="form-check-input"
                type="checkbox"
                id="type-text"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="type-text">
                <i class="bi bi-chat-text me-1"></i>
                Text
              </label>
            </div>
            <div class="form-check form-check-inline">
              <input
                v-model="localFilters.messageTypes"
                :value="MessageType.IMAGE"
                class="form-check-input"
                type="checkbox"
                id="type-image"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="type-image">
                <i class="bi bi-image me-1"></i>
                Images
              </label>
            </div>
            <div class="form-check form-check-inline">
              <input
                v-model="localFilters.messageTypes"
                :value="MessageType.FILE"
                class="form-check-input"
                type="checkbox"
                id="type-file"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="type-file">
                <i class="bi bi-file-earmark me-1"></i>
                Files
              </label>
            </div>
          </div>
        </div>

        <!-- Additional Options -->
        <div class="col-md-6">
          <label class="form-label small fw-semibold">
            <i class="bi bi-toggles me-1"></i>
            Additional Options
          </label>
          <div class="d-flex flex-column gap-2">
            <div class="form-check">
              <input
                v-model="localFilters.hasAttachments"
                class="form-check-input"
                type="checkbox"
                id="has-attachments"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="has-attachments">
                <i class="bi bi-paperclip me-1"></i>
                Has attachments only
              </label>
            </div>
            <div class="form-check">
              <input
                v-model="localFilters.includeEdited"
                class="form-check-input"
                type="checkbox"
                id="include-edited"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="include-edited">
                <i class="bi bi-pencil me-1"></i>
                Include edited messages
              </label>
            </div>
            <div class="form-check">
              <input
                v-model="localFilters.includeDeleted"
                class="form-check-input"
                type="checkbox"
                id="include-deleted"
                @change="updateFilters"
              />
              <label class="form-check-label small" for="include-deleted">
                <i class="bi bi-trash me-1"></i>
                Include deleted messages
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { SearchFilters } from '../types/chat-module.types';
import { SearchSortOrder, MessageType } from '../types/chat-module.types';

// =============================================================================
// PROPS & EMITS
// =============================================================================

interface Props {
  filters: SearchFilters;
  sortBy: SearchSortOrder;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  updateFilters: [filters: Partial<SearchFilters>];
  updateSort: [sortBy: SearchSortOrder];
  resetFilters: [];
}>();

// =============================================================================
// TYPES
// =============================================================================

interface User {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
}

interface Room {
  id: string;
  name: string;
  description?: string;
}

// =============================================================================
// REACTIVE STATE
// =============================================================================

const localFilters = ref<SearchFilters>({ ...props.filters });
const localSortBy = ref<SearchSortOrder>(props.sortBy);

// User selection state
const userSearchQuery = ref('');
const showUserDropdown = ref(false);
const availableUsers = ref<User[]>([]);
const filteredUsers = ref<User[]>([]);

// Room selection state
const roomSearchQuery = ref('');
const showRoomDropdown = ref(false);
const availableRooms = ref<Room[]>([]);
const filteredRooms = ref<Room[]>([]);

// =============================================================================
// COMPUTED
// =============================================================================

const hasActiveFilters = computed(() => {
  const f = localFilters.value;
  return (
    (f.dateRange.start !== null && f.dateRange.start !== undefined) ||
    (f.dateRange.end !== null && f.dateRange.end !== undefined) ||
    f.selectedUsers.length > 0 ||
    f.selectedRooms.length > 0 ||
    f.messageTypes.length > 0 ||
    f.hasAttachments !== null ||
    f.includeDeleted ||
    !f.includeEdited
  );
});

const activeFilterCount = computed(() => {
  let count = 0;
  const f = localFilters.value;
  
  if (f.dateRange.start || f.dateRange.end) count++;
  if (f.selectedUsers.length > 0) count++;
  if (f.selectedRooms.length > 0) count++;
  if (f.messageTypes.length > 0) count++;
  if (f.hasAttachments !== null) count++;
  if (f.includeDeleted) count++;
  if (!f.includeEdited) count++;
  
  return count;
});

// =============================================================================
// METHODS
// =============================================================================

function updateFilters(): void {
  emit('updateFilters', { ...localFilters.value });
}

function updateSort(): void {
  emit('updateSort', localSortBy.value);
}

function resetFilters(): void {
  emit('resetFilters');
}

// User management
function searchUsers(): void {
  const query = userSearchQuery.value.toLowerCase();
  filteredUsers.value = availableUsers.value.filter(user =>
    user.username.toLowerCase().includes(query) ||
    (user.displayName && user.displayName.toLowerCase().includes(query))
  );
}

function selectUser(user: User): void {
  if (!localFilters.value.selectedUsers.includes(user.id)) {
    localFilters.value = {
      ...localFilters.value,
      selectedUsers: [...localFilters.value.selectedUsers, user.id]
    };
    updateFilters();
  }
  userSearchQuery.value = '';
  showUserDropdown.value = false;
}

function removeUser(userId: string): void {
  localFilters.value = {
    ...localFilters.value,
    selectedUsers: localFilters.value.selectedUsers.filter(id => id !== userId)
  };
  updateFilters();
}

function clearUserFilter(): void {
  localFilters.value = {
    ...localFilters.value,
    selectedUsers: []
  };
  updateFilters();
}

function getUserDisplayName(userId: string): string {
  const user = availableUsers.value.find(u => u.id === userId);
  return user ? user.username : userId;
}

// Room management
function searchRooms(): void {
  const query = roomSearchQuery.value.toLowerCase();
  filteredRooms.value = availableRooms.value.filter(room =>
    room.name.toLowerCase().includes(query) ||
    (room.description && room.description.toLowerCase().includes(query))
  );
}

function selectRoom(room: Room): void {
  if (!localFilters.value.selectedRooms.includes(room.id)) {
    localFilters.value = {
      ...localFilters.value,
      selectedRooms: [...localFilters.value.selectedRooms, room.id]
    };
    updateFilters();
  }
  roomSearchQuery.value = '';
  showRoomDropdown.value = false;
}

function removeRoom(roomId: string): void {
  localFilters.value = {
    ...localFilters.value,
    selectedRooms: localFilters.value.selectedRooms.filter(id => id !== roomId)
  };
  updateFilters();
}

function clearRoomFilter(): void {
  localFilters.value = {
    ...localFilters.value,
    selectedRooms: []
  };
  updateFilters();
}

function getRoomDisplayName(roomId: string): string {
  const room = availableRooms.value.find(r => r.id === roomId);
  return room ? room.name : roomId;
}

// Event handlers
function handleDocumentClick(event: Event): void {
  const target = event.target as Element;
  
  // Close user dropdown if clicked outside
  const userContainer = document.querySelector('.user-filter-container');
  if (userContainer && !userContainer.contains(target)) {
    showUserDropdown.value = false;
  }
  
  // Close room dropdown if clicked outside
  const roomContainer = document.querySelector('.room-filter-container');
  if (roomContainer && !roomContainer.contains(target)) {
    showRoomDropdown.value = false;
  }
}

// Load available users and rooms (mock data for now)
function loadAvailableOptions(): void {
  // TODO: Replace with actual API calls
  availableUsers.value = [
    { id: '1', username: 'john_doe', displayName: 'John Doe', avatar: undefined },
    { id: '2', username: 'jane_smith', displayName: 'Jane Smith', avatar: undefined },
    { id: '3', username: 'mike_wilson', displayName: 'Mike Wilson', avatar: undefined },
    { id: '4', username: 'sarah_jones', displayName: 'Sarah Jones', avatar: undefined },
  ];

  availableRooms.value = [
    { id: '1', name: 'general', description: 'General discussion' },
    { id: '2', name: 'random', description: 'Random conversations' },
    { id: '3', name: 'tech-talk', description: 'Technology discussions' },
    { id: '4', name: 'announcements', description: 'Important announcements' },
  ];

  filteredUsers.value = [...availableUsers.value];
  filteredRooms.value = [...availableRooms.value];
}

// =============================================================================
// WATCHERS
// =============================================================================

watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters };
}, { deep: true });

watch(() => props.sortBy, (newSortBy) => {
  localSortBy.value = newSortBy;
});

// =============================================================================
// LIFECYCLE
// =============================================================================

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  loadAvailableOptions();
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
});
</script>

<style scoped>
.search-filters {
  border: 1px solid #dee2e6;
}

.form-label {
  margin-bottom: 0.25rem;
  color: #495057;
}

.form-control,
.form-select {
  font-size: 0.875rem;
}

.form-check {
  margin-bottom: 0;
}

.form-check-input {
  margin-top: 0.125rem;
}

.form-check-label {
  color: #6c757d;
  cursor: pointer;
}

.badge {
  font-size: 0.75rem;
  padding: 0.35em 0.65em;
}

.btn-close-white {
  filter: invert(1) grayscale(100%) brightness(200%);
}

.dropdown-menu {
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.dropdown-item {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.dropdown-item:hover {
  background-color: #f8f9fa;
}

.avatar-placeholder {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6c757d;
}

/* Custom checkbox and radio styles */
.form-check-input:checked {
  background-color: var(--bs-primary);
  border-color: var(--bs-primary);
}

.form-check-input:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
}

/* Date input styles */
input[type="date"] {
  position: relative;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .col-md-6 {
    margin-bottom: 1rem;
  }
  
  .form-check-inline {
    display: block;
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .d-flex.flex-wrap.gap-2 {
    flex-direction: column;
    gap: 0.5rem !important;
  }
}

/* Animation for filter expand/collapse */
.search-filters {
  transition: all 0.3s ease-in-out;
}

/* Badge animations */
.badge {
  transition: all 0.15s ease-in-out;
}

.badge:hover {
  transform: scale(1.05);
}
</style>
