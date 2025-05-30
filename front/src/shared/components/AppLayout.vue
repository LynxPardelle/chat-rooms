<template>
  <div class="app-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <button 
          v-if="hasSidebar" 
          class="sidebar-toggle"
          @click="toggleSidebar"
          aria-label="Toggle sidebar"
        >
          <i class="fas fa-bars"></i>
        </button>
        <slot name="header-left">
          <div class="app-logo">
            <slot name="logo">{{ title }}</slot>
          </div>
        </slot>
      </div>
      
      <div class="header-center">
        <slot name="header-center"></slot>
      </div>
      
      <div class="header-right">
        <slot name="header-right"></slot>
      </div>
    </header>
    
    <!-- Main container -->
    <div class="app-container">
      <!-- Sidebar -->
      <aside v-if="hasSidebar" class="app-sidebar">
        <slot name="sidebar"></slot>
      </aside>
      
      <!-- Main content -->
      <main class="app-content">
        <slot></slot>
      </main>
    </div>
    
    <!-- Footer -->
    <footer v-if="hasFooter" class="app-footer">
      <slot name="footer">
        <p class="copyright">&copy; {{ new Date().getFullYear() }} {{ title }}. All rights reserved.</p>
      </slot>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useSlots } from 'vue';

interface Props {
  title?: string;
  sidebarCollapsible?: boolean;
  initialCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Application',
  sidebarCollapsible: true,
  initialCollapsed: false
});

const slots = useSlots();
const sidebarCollapsed = ref(props.initialCollapsed);

const hasSidebar = computed(() => !!slots.sidebar);
const hasFooter = computed(() => !!slots.footer || true);

/**
 * Toggle sidebar visibility
 */
const toggleSidebar = () => {
  if (props.sidebarCollapsible) {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }
};
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--light-bg);
}

/* Header */
.app-header {
  height: 64px;
  background-color: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: var(--z-index-fixed);
  box-shadow: var(--shadow-sm);
}

.header-left {
  display: flex;
  align-items: center;
  margin-right: auto;
}

.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
}

.header-right {
  display: flex;
  align-items: center;
  margin-left: auto;
}

.app-logo {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--primary-color);
  margin-left: 0.5rem;
}

.sidebar-toggle {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  margin-right: 0.5rem;
  border-radius: var(--border-radius-md);
  transition: var(--transition-base);
}

.sidebar-toggle:hover {
  color: var(--text-primary);
  background-color: rgba(0, 0, 0, 0.05);
}

/* Container for sidebar and content */
.app-container {
  display: flex;
  flex: 1;
  position: relative;
}

/* Sidebar */
.app-sidebar {
  width: 280px;
  background-color: var(--card-bg);
  border-right: 1px solid var(--border-color);
  height: calc(100vh - 64px);
  position: sticky;
  top: 64px;
  overflow-y: auto;
  transition: transform 0.3s ease, width 0.3s ease;
}

/* Content area */
.app-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

/* Footer */
.app-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  background-color: var(--card-bg);
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  text-align: center;
}

.copyright {
  margin: 0;
}

/* Collapsed sidebar */
.sidebar-collapsed .app-sidebar {
  width: 64px;
  overflow-x: hidden;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .app-sidebar {
    transform: translateX(-100%);
    position: fixed;
    z-index: var(--z-index-fixed) - 1;
    height: calc(100vh - 64px);
  }
  
  .sidebar-collapsed .app-sidebar {
    transform: translateX(0);
    width: 280px;
  }
  
  .app-header {
    padding: 0 1rem;
  }
  
  .app-content {
    padding: 1rem;
  }
}
</style>
