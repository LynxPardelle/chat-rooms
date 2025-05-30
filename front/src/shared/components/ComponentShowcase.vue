<template>
  <div class="component-showcase">
    <h1>Component Library Showcase</h1>
    
    <section class="showcase-section">
      <h2>Buttons</h2>
      <div class="component-grid">
        <div v-for="variant in variants" :key="variant" class="component-item">
          <h3>{{ capitalize(variant) }}</h3>
          <div class="button-row">
            <BaseButton 
              :variant="variant"
              :label="capitalize(variant)"
            />
            <BaseButton 
              :variant="variant"
              :label="`${capitalize(variant)} Outline`"
              outline
            />
            <BaseButton 
              :variant="variant"
              :label="capitalize(variant)"
              :loading="true"
            />
          </div>
          <div class="button-row mt-3">
            <BaseButton 
              :variant="variant"
              :label="capitalize(variant)"
              size="sm"
            />
            <BaseButton 
              :variant="variant"
              :label="capitalize(variant)"
              size="md"
            />
            <BaseButton 
              :variant="variant"
              :label="capitalize(variant)"
              size="lg"
            />
          </div>
        </div>
      </div>
    </section>
    
    <section class="showcase-section">
      <h2>Form Controls</h2>
      <div class="component-grid">
        <div class="component-item">
          <h3>Text Input</h3>
          <BaseInput
            v-model="inputText"
            label="Name"
            placeholder="Enter your name"
            helpText="Your full name"
          />
          <BaseInput
            v-model="inputTextError"
            label="Email"
            placeholder="Enter your email"
            errorMessage="Please enter a valid email address"
          />
          <BaseInput
            v-model="inputTextWithIcon"
            label="Search"
            placeholder="Search..."
            clearable
          >
            <template #leftIcon>
              <i class="fas fa-search"></i>
            </template>
          </BaseInput>
        </div>
        
        <div class="component-item">
          <h3>Select</h3>
          <BaseSelect
            v-model="selectValue"
            :options="selectOptions"
            label="Country"
            placeholder="Select a country"
          />
          <BaseSelect
            v-model="selectMultiple"
            :options="selectOptions"
            label="Languages"
            placeholder="Select languages"
            multiple
            required
          />
        </div>
      </div>
    </section>
    
    <section class="showcase-section">
      <h2>Cards</h2>
      <div class="component-grid">
        <BaseCard
          title="Basic Card"
          subtitle="Card Subtitle"
        >
          <p>This is a basic card component that can be used for content presentation.</p>
        </BaseCard>
        
        <BaseCard
          variant="primary"
        >
          <template #header>
            <h3>Custom Header</h3>
          </template>
          <p>This card has a custom header and primary styling.</p>
          <template #footer>
            <div class="d-flex justify-content-end">
              <BaseButton label="Action" size="sm" />
            </div>
          </template>
        </BaseCard>
        
        <BaseCard
          title="Interactive Card"
          variant="outline"
          interactive
          elevated
          @click="showToast('Card clicked!')"
        >
          <p>This is an interactive card. Click me!</p>
        </BaseCard>
      </div>
    </section>
    
    <section class="showcase-section">
      <h2>Modals & Dialogs</h2>
      <div class="button-row">
        <BaseButton
          label="Open Basic Modal"
          @click="basicModalVisible = true"
        />
        <BaseButton
          label="Show Confirmation"
          variant="warning"
          @click="confirmationVisible = true"
        />
        <BaseButton
          label="Show Toast"
          variant="success"
          @click="showToast('This is a success message!', 'Success')"
        />
      </div>
      
      <BaseModal
        v-model="basicModalVisible"
        title="Example Modal"
      >
        <p>This is a basic modal dialog with standard footer actions.</p>
        <p>Modals are useful for focusing user attention on a specific task or information.</p>
      </BaseModal>
      
      <Confirmation
        v-if="confirmationVisible"
        title="Confirm Action"
        message="Are you sure you want to perform this action? This cannot be undone."
        icon="warning"
        confirmText="Yes, Proceed"
        confirmVariant="danger"
        @confirm="onConfirmAction"
        @cancel="confirmationVisible = false"
      />
    </section>
    
    <section class="showcase-section">
      <h2>Loading States</h2>
      <div class="component-grid">
        <div class="component-item d-flex align-items-center justify-content-center" style="height: 150px">
          <LoadingSpinner size="sm" />
        </div>
        <div class="component-item d-flex align-items-center justify-content-center" style="height: 150px">
          <LoadingSpinner size="md" variant="primary" text="Loading..." />
        </div>
        <div class="component-item d-flex align-items-center justify-content-center" style="height: 150px">
          <LoadingSpinner size="lg" variant="secondary" />
        </div>
      </div>
      <div class="button-row mt-3">
        <BaseButton
          label="Show Fullscreen Loader"
          @click="showFullscreenLoader"
        />
      </div>
    </section>
    
    <section class="showcase-section">
      <h2>Data Table</h2>
      <DataTable
        :items="tableData"
        :columns="tableColumns"
        keyField="id"
      >
        <template #actions="{ item }">
          <div class="table-actions">
            <button class="action-btn" @click="editItem(item)">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn action-danger" @click="deleteItem(item)">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </template>
      </DataTable>
    </section>
  </div>
  
  <!-- Toast component should be included once in your app -->
  <ToastNotification />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from '../composables/useToast';
import type { TableColumn } from '../types';
import type { Variant } from '../types/component.types';

// Import components
import {
  BaseButton,
  BaseCard,
  BaseInput,
  BaseModal,
  BaseSelect,
  Confirmation,
  DataTable,
  LoadingSpinner,
  ToastNotification
} from './index';

// Variables
const variants: Variant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'];

const inputText = ref('');
const inputTextError = ref('');
const inputTextWithIcon = ref('');

const selectOptions = [
  { label: 'United States', value: 'us' },
  { label: 'United Kingdom', value: 'uk' },
  { label: 'Canada', value: 'ca' },
  { label: 'Australia', value: 'au' },
  { label: 'Germany', value: 'de' },
  { label: 'France', value: 'fr' },
  { label: 'Japan', value: 'jp' }
];
const selectValue = ref('');
const selectMultiple = ref([]);

const basicModalVisible = ref(false);
const confirmationVisible = ref(false);

// Mock table data
const tableData = ref([
  { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active', createdAt: '2023-05-15' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive', createdAt: '2023-04-20' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Active', createdAt: '2023-03-10' },
  { id: 4, name: 'Alice Williams', email: 'alice@example.com', status: 'Pending', createdAt: '2023-05-01' },
  { id: 5, name: 'Charlie Brown', email: 'charlie@example.com', status: 'Active', createdAt: '2023-02-28' }
]);

const tableColumns: TableColumn[] = [
  { key: 'id', label: 'ID', sortable: true, width: '80px' },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },  { 
    key: 'status', 
    label: 'Status', 
    sortable: true,
    formatter: (value: any) => {
      const statusClasses: Record<string, string> = {
        'Active': 'status-active',
        'Inactive': 'status-inactive',
        'Pending': 'status-pending'
      };
      return `<span class="status-badge ${statusClasses[value] || ''}">${value}</span>`;
    }
  },
  { key: 'createdAt', label: 'Created Date', sortable: true }
];

// Toast integration
const { success } = useToast();

// Methods
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

const showToast = (message: string, title?: string) => {
  success(message, title);
};

const onConfirmAction = () => {
  confirmationVisible.value = false;
  showToast('Action confirmed!');
};

const showFullscreenLoader = () => {
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'fullscreen-loader';
  loadingOverlay.innerHTML = `
    <div class="fullscreen-loader-content">
      <div class="spinner-large"></div>
      <p class="mt-3">Loading...</p>
    </div>
  `;
  document.body.appendChild(loadingOverlay);
  
  setTimeout(() => {
    document.body.removeChild(loadingOverlay);
    showToast('Loading complete!');
  }, 2000);
};

const editItem = (item: any) => {
  showToast(`Editing ${item.name}`);
};

const deleteItem = (_item: any) => {
  confirmationVisible.value = true;
};
</script>

<style>
.component-showcase {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: var(--primary-color);
  text-align: center;
}

.showcase-section {
  margin-bottom: 3rem;
  background-color: var(--card-bg);
  padding: 2rem;
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.showcase-section h2 {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.component-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.component-item {
  margin-bottom: 1rem;
}

.button-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.table-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.action-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: var(--border-radius-sm);
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: rgba(0,0,0,0.05);
}

.action-danger {
  color: var(--danger-color);
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: var(--border-radius-full);
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active {
  background-color: var(--success-light);
  color: var(--success-color);
}

.status-inactive {
  background-color: var(--secondary-light);
  color: var(--secondary-color);
}

.status-pending {
  background-color: var(--warning-light);
  color: var(--warning-color);
}

/* Fullscreen loader */
.fullscreen-loader {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
}

.fullscreen-loader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
}

.spinner-large {
  width: 5rem;
  height: 5rem;
  border: 5px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
