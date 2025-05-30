<template>
  <section class="data-table-section" aria-labelledby="data-table-title">
    <h2 id="data-table-title" class="visually-hidden">{{ ariaLabel || 'Data Table' }}</h2>
    <div class="data-table-container">
      <!-- Table Search & Controls -->
      <div class="data-table-header" v-if="searchable || hasHeaderSlot">
        <slot name="header">
          <div class="data-table-search" v-if="searchable">
            <BaseInput
              v-model="searchQuery"
              placeholder="Search..."
              clearable
              size="sm"
              aria-label="Search data table"
            >
              <template #leftIcon>
                <i class="fas fa-search" aria-hidden="true"></i>
              </template>
            </BaseInput>
          </div>
        </slot>
      </div>
      
      <!-- Main Table -->
      <div class="data-table-responsive">
        <table class="data-table" :class="tableClasses" :aria-label="ariaLabel || 'Data Table'">
          <thead>
            <tr>
              <th 
                v-for="column in visibleColumns" 
                :key="column.key"
                :class=" [
                  column.headerClass, 
                  column.sortable ? 'sortable' : '',
                  sortBy === column.key ? `sorted-${sortDirection}` : ''
                ]"
                :style="column.width ? { width: column.width } : {}"
                :aria-sort="getSortAriaAttribute(column)"
              >
                <div class="th-content" :class="column.align ? `text-${column.align}` : ''">
                  <template v-if="column.sortable">
                    <button 
                      class="sort-button"
                      @click="sortByColumn(column.key)"
                      :aria-label="`Sort by ${column.label} ${getSortAriaLabel(column.key)}`"
                    >
                      {{ column.label }}
                      <span class="sort-icon" aria-hidden="true"></span>
                    </button>
                  </template>
                  <template v-else>
                    {{ column.label }}
                  </template>
                </div>
              </th>
              <th v-if="hasActions" class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(item, index) in paginatedItems" 
              :key="keyField ? item[keyField] : index"
              :class="{ 'selected': selectedItems.includes(item) }"
              @click="handleRowClick(item, index)"
            >
              <td 
                v-for="column in visibleColumns" 
                :key="column.key"
                :class="[column.cellClass]"
              >
                <div :class="column.align ? `text-${column.align}` : ''">
                  <slot 
                    :name="`cell-${column.key}`" 
                    :item="item" 
                    :value="getValue(item, column)"
                    :index="index"
                  >
                    {{ formatValue(item, column) }}
                  </slot>
                </div>
              </td>
              <td v-if="hasActions" class="actions-column">
                <slot name="actions" :item="item" :index="index"></slot>
              </td>
            </tr>
            <tr v-if="processedItems.length === 0">
              <td :colspan="visibleColumns.length + (hasActions ? 1 : 0)" class="empty-table">
                <slot name="empty">
                  <div class="empty-message">
                    <i class="fas fa-inbox empty-icon"></i>
                    <p>No data available</p>
                  </div>
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="data-table-footer" v-if="paginated">
        <div class="pagination-info">
          Showing {{ paginationInfo.from }} to {{ paginationInfo.to }} of {{ processedItems.length }} entries
        </div>
        <div class="pagination-controls">
          <button 
            class="pagination-btn" 
            :disabled="currentPage === 1"
            @click="goToPage(1)"
            aria-label="Go to first page"
          >
            <i class="fas fa-angle-double-left"></i>
          </button>
          <button 
            class="pagination-btn" 
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
            aria-label="Go to previous page"
          >
            <i class="fas fa-angle-left"></i>
          </button>
          
          <span class="pagination-pages">
            <button 
              v-for="page in visiblePages" 
              :key="page"
              class="pagination-btn" 
              :class="{ active: currentPage === page }"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </span>
          
          <button 
            class="pagination-btn" 
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
            aria-label="Go to next page"
          >
            <i class="fas fa-angle-right"></i>
          </button>
          <button 
            class="pagination-btn" 
            :disabled="currentPage === totalPages"
            @click="goToPage(totalPages)"
            aria-label="Go to last page"
          >
            <i class="fas fa-angle-double-right"></i>
          </button>
        </div>
        
        <div class="pagination-size">
          <label id="pagination-size-label" class="visually-hidden">Items per page</label>
          <select 
            v-model="itemsPerPage" 
            @change="currentPage = 1" 
            aria-labelledby="pagination-size-label"
          >
            <option v-for="size in pageSizeOptions" :key="size" :value="size">
              {{ size === -1 ? 'All' : size }} per page
            </option>
          </select>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch, useSlots } from 'vue';
import BaseInput from './BaseInput.vue';
import type { TableColumn } from '../types';

interface Props {
  items: any[];
  columns: TableColumn[];
  keyField?: string;
  striped?: boolean;
  bordered?: boolean;
  hover?: boolean;
  compact?: boolean;
  searchable?: boolean;
  paginated?: boolean;
  itemsPerPage?: number;
  pageSizeOptions?: number[];
  ariaLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  striped: true,
  bordered: true,
  hover: true,
  compact: false,
  searchable: true,
  paginated: true,
  itemsPerPage: 10,
  pageSizeOptions: () => [5, 10, 25, 50, 100, -1]
});

const emits = defineEmits<{
  (e: 'row-click', item: any, index: number): void;
  (e: 'sort', column: string, direction: 'asc' | 'desc'): void;
  (e: 'page-change', page: number): void;
}>();

const slots = useSlots();
const searchQuery = ref('');
const sortBy = ref('');
const sortDirection = ref<'asc' | 'desc'>('asc');
const currentPage = ref(1);
const itemsPerPage = ref(props.itemsPerPage);
const selectedItems = ref<any[]>([]);

const hasHeaderSlot = computed(() => !!slots.header);
const hasActions = computed(() => !!slots.actions);

/**
 * Filter the visible columns
 */
const visibleColumns = computed(() => {
  return props.columns.filter(col => col.key !== 'actions');
});

/**
 * Generate table CSS classes
 */
const tableClasses = computed(() => {
  return [
    props.striped ? 'table-striped' : '',
    props.bordered ? 'table-bordered' : '',
    props.hover ? 'table-hover' : '',
    props.compact ? 'table-compact' : ''
  ].filter(Boolean).join(' ');
});

/**
 * Handle sorting by column
 */
const sortByColumn = (columnKey: string) => {
  if (sortBy.value === columnKey) {
    // Toggle direction
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // New column
    sortBy.value = columnKey;
    sortDirection.value = 'asc';
  }
  
  emits('sort', columnKey, sortDirection.value);
};

/**
 * Get sort ARIA label based on column sort state
 */
const getSortAriaLabel = (columnKey: string): string => {
  if (sortBy.value === columnKey) {
    return sortDirection.value === 'asc' ? '(sorted ascending, click to sort descending)' : '(sorted descending, click to sort ascending)';
  }
  return '(not sorted, click to sort ascending)';
};

/**
 * Determine the aria-sort attribute value for a column
 */
const getSortAriaAttribute = (column: TableColumn): 'none' | 'ascending' | 'descending' | 'other' => {
  if (!column.sortable) return 'none';
  if (sortBy.value === column.key) {
    return sortDirection.value === 'asc' ? 'ascending' : 'descending';
  }
  return 'none';
};

/**
 * Filter items by search query
 */
const filteredItems = computed(() => {
  if (!searchQuery.value) return props.items;
  
  const query = searchQuery.value.toLowerCase();
  return props.items.filter(item => {
    // Search in all visible columns
    return visibleColumns.value.some(column => {
      const value = getValue(item, column);
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    });
  });
});

/**
 * Sort items by current sort column and direction
 */
const processedItems = computed(() => {
  if (!sortBy.value) return filteredItems.value;
  
  return [...filteredItems.value].sort((a, b) => {
    const column = props.columns.find(col => col.key === sortBy.value);
    if (!column) return 0;
    
    const aValue = getValue(a, column);
    const bValue = getValue(b, column);
    
    // Handle null/undefined
    if (aValue == null) return sortDirection.value === 'asc' ? -1 : 1;
    if (bValue == null) return sortDirection.value === 'asc' ? 1 : -1;
    
    // Compare based on type
    if (typeof aValue === 'string') {
      return sortDirection.value === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortDirection.value === 'asc'
        ? aValue - bValue
        : bValue - aValue;
    }
  });
});

/**
 * Calculate total pages
 */
const totalPages = computed(() => {
  if (itemsPerPage.value === -1) return 1;
  return Math.max(1, Math.ceil(processedItems.value.length / itemsPerPage.value));
});

/**
 * Paginate items
 */
const paginatedItems = computed(() => {
  if (!props.paginated || itemsPerPage.value === -1) {
    return processedItems.value;
  }
  
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return processedItems.value.slice(start, end);
});

/**
 * Calculate pagination info text
 */
const paginationInfo = computed(() => {
  const total = processedItems.value.length;
  
  if (total === 0) {
    return { from: 0, to: 0 };
  }
  
  if (itemsPerPage.value === -1) {
    return { from: 1, to: total };
  }
  
  const from = ((currentPage.value - 1) * itemsPerPage.value) + 1;
  const to = Math.min(currentPage.value * itemsPerPage.value, total);
  
  return { from, to };
});

/**
 * Calculate visible page buttons
 */
const visiblePages = computed(() => {
  const totalPagesToShow = 5;
  const pages: number[] = [];
  
  if (totalPages.value <= totalPagesToShow) {
    // Show all pages
    for (let i = 1; i <= totalPages.value; i++) {
      pages.push(i);
    }
  } else {
    // Calculate pages to show based on current page
    const halfWay = Math.ceil(totalPagesToShow / 2);
    
    if (currentPage.value <= halfWay) {
      // Near the start
      for (let i = 1; i <= totalPagesToShow - 1; i++) {
        pages.push(i);
      }
      pages.push(totalPages.value);
    } else if (currentPage.value > totalPages.value - halfWay) {
      // Near the end
      pages.push(1);
      for (let i = totalPages.value - totalPagesToShow + 2; i <= totalPages.value; i++) {
        pages.push(i);
      }
    } else {
      // Middle
      pages.push(1);
      for (let i = currentPage.value - 1; i <= currentPage.value + 1; i++) {
        pages.push(i);
      }
      pages.push(totalPages.value);
    }
  }
  
  return pages;
});

/**
 * Go to specified page
 */
const goToPage = (page: number) => {
  currentPage.value = page;
  emits('page-change', page);
};

/**
 * Get value from item based on column configuration
 */
const getValue = (item: any, column: TableColumn): any => {
  const { key } = column;
  
  if (key.includes('.')) {
    // Handle nested properties
    return key.split('.').reduce((obj, key) => obj?.[key], item);
  } else {
    return item[key];
  }
};

/**
 * Format value based on column formatter
 */
const formatValue = (item: any, column: TableColumn): string => {
  const value = getValue(item, column);
  
  if (column.formatter) {
    return column.formatter(value, item);
  }
  
  return value != null ? String(value) : '';
};

/**
 * Handle row click
 */
const handleRowClick = (item: any, index: number) => {
  emits('row-click', item, index);
};

/**
 * Reset to first page when items change
 */
watch(() => props.items, () => {
  currentPage.value = 1;
});

/**
 * Reset page when search query changes
 */
watch(searchQuery, () => {
  currentPage.value = 1;
});
</script>

<style scoped>
.data-table-container {
  width: 100%;
}

/* Table header with search and controls */
.data-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.data-table-search {
  width: 250px;
}

/* Responsive table wrapper */
.data-table-responsive {
  overflow-x: auto;
  margin-bottom: 1rem;
}

/* Main table styling */
.data-table {
  width: 100%;
  margin-bottom: 1rem;
  border-collapse: collapse;
  color: var(--text-primary);
  background-color: var(--card-bg);
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  vertical-align: middle;
}

.data-table th {
  font-weight: 600;
  text-align: left;
  background-color: rgba(0, 0, 0, 0.03);
  white-space: nowrap;
  position: relative;
}

/* Table variants */
.table-bordered {
  border: 1px solid var(--border-color);
}

.table-bordered th,
.table-bordered td {
  border: 1px solid var(--border-color);
}

.table-striped tr:nth-child(even) {
  background-color: rgba(0, 0, 0, 0.02);
}

.table-hover tr:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.table-compact th,
.table-compact td {
  padding: 0.4rem 0.6rem;
}

/* Sortable columns */
.sortable {
  cursor: pointer;
  user-select: none;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sort-icon {
  margin-left: 0.5rem;
  width: 0;
  height: 0;
  display: inline-block;
  content: '';
}

.sortable .sort-icon::before,
.sortable .sort-icon::after {
  content: '';
  position: absolute;
  right: 8px;
  width: 0;
  height: 0;
}

.sortable .sort-icon::before {
  bottom: calc(50% + 2px);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid var(--text-light);
}

.sortable .sort-icon::after {
  top: calc(50% + 2px);
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--text-light);
}

.sorted-asc .sort-icon::before {
  border-bottom-color: var(--primary-color);
}

.sorted-desc .sort-icon::after {
  border-top-color: var(--primary-color);
}

/* Empty state */
.empty-table {
  text-align: center;
  padding: 2rem !important;
}

.empty-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

/* Selected row */
.selected {
  background-color: var(--primary-light) !important;
}

/* Text alignment */
.text-left {
  text-align: left;
}

.text-center {
  text-align: center;
}

.text-right {
  text-align: right;
}

/* Actions column */
.actions-column {
  white-space: nowrap;
  width: 1%;
  text-align: center;
}

/* Table footer with pagination */
.data-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.pagination-info {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}

.pagination-controls {
  display: flex;
  align-items: center;
}

.pagination-btn {
  margin: 0 0.125rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-color);
  background-color: var(--card-bg);
  border-radius: var(--border-radius-md);
  cursor: pointer;
  transition: var(--transition-base);
  color: var(--text-primary);
  outline: none;
}

.pagination-btn:hover {
  background-color: var(--light-bg);
}

.pagination-btn.active {
  background-color: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-pages {
  display: flex;
  align-items: center;
}

.pagination-size select {
  padding: 0.375rem;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  background-color: var(--card-bg);
  color: var(--text-primary);
}
</style>
