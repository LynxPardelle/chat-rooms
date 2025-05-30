# Shared Component System Documentation

## Overview

This document provides detailed information about the Enterprise-Grade Shared Component System implemented in the Chat Rooms application. The system is designed to be the foundation for building consistent, accessible, and highly reusable UI components throughout the application.

## Table of Contents

1. [Installation & Usage](#installation--usage)
2. [Core Base Components](#core-base-components)
3. [Feedback & Interactive Components](#feedback--interactive-components)
4. [Layout & Structure Components](#layout--structure-components)
5. [Utilities & Helpers](#utilities--helpers)
6. [Composables](#composables)
7. [Theming System](#theming-system)
8. [Accessibility Guidelines](#accessibility-guidelines)
9. [Testing](#testing)

## Installation & Usage

### Global Registration

Import and register all components globally in your main.ts:

```typescript
import { createApp } from 'vue';
import App from './App.vue';
import * as components from './shared/components';

const app = createApp(App);

// Register all components globally
Object.entries(components).forEach(([name, component]) => {
  app.component(name, component);
});

app.mount('#app');
```

### Individual Import

Import components individually when needed:

```vue
<script setup lang="ts">
import { BaseButton, BaseInput } from '@/shared/components';
</script>

<template>
  <BaseButton variant="primary">Click Me</BaseButton>
  <BaseInput v-model="value" label="Input Label" />
</template>
```

## Core Base Components

### BaseButton

A versatile button component with multiple variants, states, and accessibility features.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'danger' \| 'ghost' \| 'link'` | `'primary'` | Button style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `disabled` | `boolean` | `false` | Disables the button |
| `loading` | `boolean` | `false` | Shows loading spinner and disables button |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | HTML button type |
| `iconStart` | `string` | `undefined` | Icon class to show before text |
| `iconEnd` | `string` | `undefined` | Icon class to show after text |
| `block` | `boolean` | `false` | Makes button full width |
| `ariaLabel` | `string` | `undefined` | Accessible label for screen readers |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `click` | `MouseEvent` | Emitted when button is clicked (not emitted when disabled or loading) |

#### Usage

```vue
<BaseButton 
  variant="primary" 
  size="md" 
  :loading="isLoading" 
  iconStart="bi-envelope"
  @click="handleClick"
>
  Send Message
</BaseButton>
```

### BaseInput

A form input component with validation, icons, and accessibility features.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string \| number` | `''` | v-model binding value |
| `label` | `string` | `undefined` | Input label |
| `type` | `'text' \| 'email' \| 'password' \| 'number' \| etc.` | `'text'` | HTML input type |
| `placeholder` | `string` | `''` | Input placeholder |
| `disabled` | `boolean` | `false` | Disables the input |
| `readonly` | `boolean` | `false` | Makes input read-only |
| `error` | `string` | `''` | Error message to display |
| `prefix` | `string` | `undefined` | Text/icon to show before input |
| `suffix` | `string` | `undefined` | Text/icon to show after input |
| `required` | `boolean` | `false` | Makes input required |
| `autocomplete` | `string` | `'off'` | HTML autocomplete attribute |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string \| number` | Emitted when input value changes |
| `focus` | `FocusEvent` | Emitted when input gains focus |
| `blur` | `FocusEvent` | Emitted when input loses focus |

#### Usage

```vue
<BaseInput
  v-model="email"
  label="Email Address"
  type="email"
  placeholder="your@email.com"
  required
  :error="emailError"
  prefix="@"
  @blur="validateEmail"
/>
```

### BaseSelect

A select dropdown component with support for option groups, search, and multi-select.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `any` | `''` | v-model binding value |
| `options` | `Array<Option \| OptionGroup>` | `[]` | Select options or option groups |
| `label` | `string` | `undefined` | Select label |
| `placeholder` | `string` | `'Select an option'` | Placeholder text |
| `disabled` | `boolean` | `false` | Disables the select |
| `error` | `string` | `''` | Error message to display |
| `hasGroups` | `boolean` | `false` | Indicates if options include option groups |
| `required` | `boolean` | `false` | Makes select required |
| `searchable` | `boolean` | `false` | Enables search functionality |
| `multiple` | `boolean` | `false` | Enables multiple selection |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `any` | Emitted when selection changes |

#### Usage

```vue
<BaseSelect
  v-model="selectedCountry"
  :options="countries"
  label="Country"
  placeholder="Select your country"
  :error="countryError"
  searchable
  required
/>
```

### BaseCard

A flexible container component with customizable header, body, and footer.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'primary' \| 'secondary' \| 'danger'` | `'default'` | Card style variant |
| `elevation` | `0 \| 1 \| 2 \| 3` | `1` | Shadow elevation level |
| `bordered` | `boolean` | `true` | Shows card border |
| `flat` | `boolean` | `false` | Removes shadow |
| `clickable` | `boolean` | `false` | Makes card interactive |
| `aspectRatio` | `string` | `undefined` | Media aspect ratio (e.g., '16:9') |

#### Slots

| Slot | Description |
|------|-------------|
| `header` | Card header content |
| `default` | Card body content |
| `footer` | Card footer content |
| `media` | Card media content (images, videos) |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `click` | `MouseEvent` | Emitted when clickable card is clicked |

#### Usage

```vue
<BaseCard variant="primary" :clickable="true" @click="handleCardClick">
  <template #header>
    <h3>Card Title</h3>
  </template>
  
  <p>This is the card content.</p>
  
  <template #footer>
    <BaseButton size="sm">View Details</BaseButton>
  </template>
</BaseCard>
```

## Feedback & Interactive Components

### BaseModal

A modal dialog component with focus management and accessibility features.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `boolean` | `false` | Controls modal visibility |
| `title` | `string` | `''` | Modal title |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'fullscreen'` | `'md'` | Modal size |
| `closeOnBackdrop` | `boolean` | `true` | Closes modal when backdrop clicked |
| `closeOnEsc` | `boolean` | `true` | Closes modal when ESC key pressed |
| `scrollable` | `boolean` | `true` | Makes modal body scrollable |
| `centered` | `boolean` | `false` | Centers modal vertically |
| `persistent` | `boolean` | `false` | Prevents closing on backdrop/ESC |

#### Slots

| Slot | Description |
|------|-------------|
| `header` | Custom modal header (overrides title prop) |
| `default` | Modal body content |
| `footer` | Modal footer content |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `boolean` | Emitted when modal visibility changes |
| `close` | - | Emitted when modal is closed |
| `open` | - | Emitted when modal is opened |

#### Usage

```vue
<script setup>
import { ref } from 'vue';

const showModal = ref(false);
</script>

<template>
  <BaseButton @click="showModal = true">Open Modal</BaseButton>
  
  <BaseModal v-model="showModal" title="Modal Title">
    <p>This is the modal content.</p>
    
    <template #footer>
      <BaseButton variant="secondary" @click="showModal = false">Cancel</BaseButton>
      <BaseButton variant="primary" @click="handleConfirm">Confirm</BaseButton>
    </template>
  </BaseModal>
</template>
```

### ToastNotification

A notification component for displaying temporary messages.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'success' \| 'error' \| 'warning' \| 'info'` | `'info'` | Notification style |
| `message` | `string` | `''` | Notification message |
| `title` | `string` | `undefined` | Optional notification title |
| `duration` | `number` | `5000` | Auto-dismiss duration (ms), 0 for no auto-dismiss |
| `position` | `'top-right' \| 'top-left' \| etc.` | `'top-right'` | Screen position |
| `showProgress` | `boolean` | `true` | Shows dismiss progress indicator |
| `showIcon` | `boolean` | `true` | Shows variant icon |
| `showClose` | `boolean` | `true` | Shows close button |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `close` | - | Emitted when notification is closed |

#### Usage with composable (recommended)

```vue
<script setup>
import { useToast } from '@/shared/composables';

const toast = useToast();

function showSuccessToast() {
  toast.success('Operation completed successfully!');
}

function showErrorToast() {
  toast.error('An error occurred', 'Error Title', 10000);
}
</script>

<template>
  <BaseButton @click="showSuccessToast">Show Success</BaseButton>
  <BaseButton @click="showErrorToast">Show Error</BaseButton>
</template>
```

### LoadingSpinner

A component for indicating loading states with various styles.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'spinner' \| 'dots' \| 'skeleton' \| 'progress'` | `'spinner'` | Loader style |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Loader size |
| `color` | `'primary' \| 'secondary' \| etc.` | `'primary'` | Loader color |
| `label` | `string` | `'Loading...'` | Accessible label for screen readers |
| `inline` | `boolean` | `false` | Display inline vs. block |

#### Usage

```vue
<LoadingSpinner size="lg" color="primary" />

<LoadingSpinner variant="dots" inline />

<LoadingSpinner variant="skeleton" :repeat="3" />
```

### Confirmation

A specialized modal component for confirming user actions.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `boolean` | `false` | Controls visibility |
| `title` | `string` | `'Confirm Action'` | Dialog title |
| `message` | `string` | `'Are you sure?'` | Confirmation message |
| `confirmText` | `string` | `'Confirm'` | Confirm button text |
| `cancelText` | `string` | `'Cancel'` | Cancel button text |
| `confirmVariant` | `'primary' \| 'danger' \| etc.` | `'primary'` | Confirm button variant |
| `type` | `'default' \| 'delete' \| 'warning'` | `'default'` | Preset configuration |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `boolean` | Emitted when visibility changes |
| `confirm` | - | Emitted when confirmed |
| `cancel` | - | Emitted when canceled |

#### Usage

```vue
<script setup>
import { ref } from 'vue';

const showConfirm = ref(false);

function handleDelete() {
  showConfirm.value = true;
}

function confirmDelete() {
  // Perform delete operation
  showConfirm.value = false;
}
</script>

<template>
  <BaseButton variant="danger" @click="handleDelete">Delete Item</BaseButton>
  
  <Confirmation
    v-model="showConfirm"
    type="delete"
    title="Delete Item"
    message="Are you sure you want to delete this item? This action cannot be undone."
    @confirm="confirmDelete"
  />
</template>
```

## Layout & Structure Components

### AppLayout

A main layout component with header, sidebar, and content areas.

#### Slots

| Slot | Description |
|------|-------------|
| `header` | Page header content |
| `sidebar` | Sidebar navigation content |
| `default` | Main content |
| `footer` | Page footer content |

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sidebarOpen` | `boolean` | `true` | Controls sidebar visibility |
| `sidebarWidth` | `string` | `'250px'` | Sidebar width |
| `fixedHeader` | `boolean` | `true` | Makes header sticky |
| `fixedSidebar` | `boolean` | `true` | Makes sidebar sticky |
| `headerHeight` | `string` | `'60px'` | Header height |

#### Usage

```vue
<AppLayout :sidebar-open="sidebarVisible">
  <template #header>
    <AppHeader @toggle-sidebar="sidebarVisible = !sidebarVisible" />
  </template>
  
  <template #sidebar>
    <AppSidebar />
  </template>
  
  <main>
    <!-- Your page content here -->
  </main>
  
  <template #footer>
    <AppFooter />
  </template>
</AppLayout>
```

### DataTable

A feature-rich table component for displaying and interacting with tabular data.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `Array<Column>` | `[]` | Column definitions |
| `items` | `Array<any>` | `[]` | Data items to display |
| `sortable` | `boolean` | `false` | Enables column sorting |
| `searchable` | `boolean` | `false` | Enables search functionality |
| `pagination` | `boolean` | `false` | Enables pagination |
| `pageSize` | `number` | `10` | Items per page |
| `striped` | `boolean` | `false` | Applies striped rows style |
| `hover` | `boolean` | `true` | Applies hover effect on rows |
| `bordered` | `boolean` | `false` | Adds borders to table |
| `responsive` | `boolean` | `true` | Makes table responsive |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `row-click` | `item` | Emitted when row is clicked |
| `sort-change` | `{ column, direction }` | Emitted when sort changes |
| `page-change` | `number` | Emitted when page changes |
| `selection-change` | `Array<any>` | Emitted when row selection changes |

#### Usage

```vue
<script setup>
import { ref } from 'vue';

const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email' },
  { key: 'actions', label: 'Actions' }
];

const items = ref([
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
]);

function handleRowClick(item) {
  console.log('Row clicked:', item);
}
</script>

<template>
  <DataTable
    :columns="columns"
    :items="items"
    sortable
    searchable
    pagination
    :page-size="5"
    hover
    @row-click="handleRowClick"
  >
    <template #cell(actions)="{ item }">
      <BaseButton size="sm" @click.stop="editItem(item)">Edit</BaseButton>
      <BaseButton size="sm" variant="danger" @click.stop="deleteItem(item)">Delete</BaseButton>
    </template>
  </DataTable>
</template>
```

## Utilities & Helpers

### Accessibility Utilities

```typescript
// Import
import { useAccessibility } from '@/shared/utils/accessibility';

// Usage
const { 
  generateId, 
  getFocusableElements,
  trapFocus,
  announceToScreenReader 
} = useAccessibility();

// Generate unique IDs for ARIA attributes
const fieldId = generateId('input');  // -> "input-1234"

// Announce dynamic content to screen readers
announceToScreenReader('New message received');

// Trap focus in modal dialogs
const modalRef = ref(null);
onMounted(() => {
  trapFocus(modalRef.value);
});
```

### Style Utilities

```typescript
// Import
import { classNames } from '@/shared/utils/style';

// Usage
const buttonClasses = classNames(
  'btn',
  variant && `btn-${variant}`,
  size && `btn-${size}`,
  disabled && 'disabled',
  block && 'btn-block'
);
```

### Validation Utilities

```typescript
// Import
import { 
  validateEmail, 
  validateRequired, 
  validateMinLength 
} from '@/shared/utils/validation';

// Usage
const errors = ref({});

function validateForm() {
  errors.value.email = validateEmail(form.email);
  errors.value.password = validateRequired(form.password) || 
                          validateMinLength(form.password, 8);
                          
  return Object.values(errors.value).every(error => !error);
}
```

## Composables

### useTheme

```typescript
// Import
import { useTheme } from '@/shared/composables';

// Usage
const { 
  theme, 
  isDarkMode, 
  toggleDarkMode, 
  setTheme,
  applyThemeToElement 
} = useTheme();

// Toggle between light and dark mode
function handleToggleTheme() {
  toggleDarkMode();
}

// Apply theme variables to a specific element
const cardRef = ref(null);
onMounted(() => {
  applyThemeToElement(cardRef.value, {
    backgroundColor: 'var(--color-surface-2)',
    textColor: 'var(--color-text-primary)'
  });
});
```

### useToast

```typescript
// Import
import { useToast } from '@/shared/composables';

// Usage
const toast = useToast();

// Show different types of notifications
function handleFormSubmit() {
  try {
    // Submit form logic
    toast.success('Form submitted successfully!');
  } catch (error) {
    toast.error('Failed to submit form', error.message);
  }
}

// Advanced usage
toast.show({
  title: 'Payment Required',
  message: 'Your subscription has expired',
  variant: 'warning',
  duration: 10000,
  actions: [
    { text: 'Renew Now', handler: () => navigateToPayment() },
    { text: 'Dismiss', variant: 'ghost' }
  ]
});
```

### useModal

```typescript
// Import
import { useModal } from '@/shared/composables';

// Usage
const modal = useModal();

// Simple usage
function showUserDetails(userId) {
  modal.open('userDetails', { userId });
}

// Register modal with configuration
modal.register('userDetails', {
  component: UserDetailsModal,
  props: {
    title: 'User Details',
    size: 'lg'
  },
  events: {
    'user:update': (user) => refreshUserData(user)
  }
});

// Close programmatically
function handleCancelAction() {
  modal.close('userDetails');
}
```

### useForm

```typescript
// Import
import { useForm } from '@/shared/composables';

// Usage
const { 
  values, 
  errors, 
  touched,
  isValid,
  isSubmitting,
  handleSubmit,
  validateField,
  resetForm
} = useForm({
  initialValues: {
    username: '',
    email: '',
    password: ''
  },
  validationSchema: {
    username: [required(), minLength(3)],
    email: [required(), email()],
    password: [required(), minLength(8), password()]
  },
  onSubmit: async (values) => {
    await registerUser(values);
  }
});
```

## Theming System

The component system uses CSS variables for consistent theming across the application.

### CSS Variables

Key variables that can be customized:

```css
:root {
  /* Colors - Light Theme */
  --color-primary: #4361ee;
  --color-secondary: #3f37c9;
  --color-success: #4cc9f0;
  --color-danger: #f72585;
  --color-warning: #f8961e;
  --color-info: #4895ef;
  
  /* Text Colors */
  --color-text-primary: #212529;
  --color-text-secondary: #495057;
  --color-text-muted: #6c757d;
  
  /* Background Colors */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-bg-tertiary: #e9ecef;
  
  /* Border Colors */
  --color-border: #dee2e6;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Typography */
  --font-family-base: 'Nunito', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-heading: 'Poppins', sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
  --font-size-xl: 1.5rem;
  
  /* Borders */
  --border-radius-sm: 0.25rem;
  --border-radius-md: 0.375rem;
  --border-radius-lg: 0.5rem;
  --border-radius-xl: 1rem;
  --border-width: 1px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
  
  /* Z-index layers */
  --z-index-dropdown: 1000;
  --z-index-sticky: 1020;
  --z-index-fixed: 1030;
  --z-index-modal-backdrop: 1040;
  --z-index-modal: 1050;
  --z-index-popover: 1060;
  --z-index-tooltip: 1070;
}

/* Dark Theme Variables */
.theme-dark {
  --color-primary: #4cc9f0;
  --color-secondary: #4895ef;
  --color-success: #2dc653;
  --color-danger: #f72585;
  --color-warning: #f8961e;
  --color-info: #4361ee;
  
  --color-text-primary: #f8f9fa;
  --color-text-secondary: #e9ecef;
  --color-text-muted: #adb5bd;
  
  --color-bg-primary: #121212;
  --color-bg-secondary: #1e1e1e;
  --color-bg-tertiary: #2d2d2d;
  
  --color-border: #444444;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
}
```

### Customizing Theme

To customize the theme, override the CSS variables in your root stylesheet:

```css
:root {
  --color-primary: #0066cc; /* Custom primary color */
  --font-family-base: 'Roboto', sans-serif; /* Custom font */
}
```

## Accessibility Guidelines

All components are designed to meet WCAG 2.1 AA standards:

1. **Keyboard Navigation**
   - All interactive elements are focusable
   - Focus indicators are clearly visible
   - Focus trap in modals and other dialogs

2. **Screen Reader Support**
   - ARIA roles and attributes throughout
   - Proper labeling of controls
   - Announcements for dynamic content changes

3. **Color Contrast**
   - All text meets minimum contrast requirements
   - Non-text elements have sufficient contrast
   - No information conveyed by color alone

4. **Reduced Motion**
   - Respects `prefers-reduced-motion` media query
   - Minimal animations for those who prefer reduced motion

## Testing

Run component tests:

```bash
npm run test:unit
```

Testing components individually:

```bash
npm run test:unit -- --filter=BaseButton
```

### Component Test Example

```js
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseButton from '../components/BaseButton.vue';

describe('BaseButton', () => {
  it('renders with default props', () => {
    const wrapper = mount(BaseButton, {
      slots: {
        default: 'Button Text'
      }
    });
    
    expect(wrapper.text()).toBe('Button Text');
    expect(wrapper.classes()).toContain('btn-primary');
  });
  
  it('emits click event when clicked', async () => {
    const wrapper = mount(BaseButton);
    
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });
});
```
