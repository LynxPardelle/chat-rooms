<template>
  <div class="connection-status" :class="statusClass">
    <div class="status-indicator">
      <i :class="statusIcon"></i>
      <span class="status-text">{{ statusText }}</span>
    </div>
    
    <div v-if="showDetails" class="status-details">
      <div class="detail-item">
        <span class="label">API:</span>
        <span :class="getStatusClass(connectionState.api.status)">
          {{ getStatusText(connectionState.api.status) }}
        </span>
      </div>
      <div v-if="authStore.isAuthenticated" class="detail-item">
        <span class="label">WebSocket:</span>
        <span :class="getStatusClass(connectionState.websocket.status)">
          {{ getStatusText(connectionState.websocket.status) }}
        </span>
      </div>
      <div v-if="hasError" class="error-details">
        <div v-if="connectionState.api.error" class="error-item">
          <strong>API Error:</strong> {{ connectionState.api.error }}
        </div>
        <div v-if="connectionState.websocket.error" class="error-item">
          <strong>WebSocket Error:</strong> {{ connectionState.websocket.error }}
        </div>
      </div>
    </div>
    
    <div v-if="showActions" class="status-actions">
      <button 
        v-if="!isConnecting && !isConnected"
        @click="handleReconnect"
        class="btn btn-sm btn-primary"
        :disabled="isConnecting"
      >
        <i class="bi bi-arrow-clockwise me-1"></i>
        Reconnect
      </button>
      
      <button 
        v-if="showDetails && !showDetailsExpanded"
        @click="showDetailsExpanded = true"
        class="btn btn-sm btn-outline-secondary"
      >
        <i class="bi bi-info-circle me-1"></i>
        Details
      </button>
      
      <button 
        v-if="showDetailsExpanded"
        @click="showDetailsExpanded = false"
        class="btn btn-sm btn-outline-secondary"
      >
        <i class="bi bi-chevron-up me-1"></i>
        Hide
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';
import { useConnectionManager } from '../services/connection-manager.service';
import { useAuthStore } from '../../stores/auth';
import type { ConnectionStatus } from '../services/connection-manager.service';

export default defineComponent({
  name: 'ConnectionStatus',
  props: {
    showDetails: {
      type: Boolean,
      default: false
    },
    showActions: {
      type: Boolean,
      default: true
    },
    autoHide: {
      type: Boolean,
      default: false
    },
    hideWhenConnected: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const connectionManager = useConnectionManager();
    const authStore = useAuthStore();
    const showDetailsExpanded = ref(false);
    
    let stateChangeUnsubscribe: (() => void) | null = null;
    
    const connectionState = connectionManager.connectionState;
    const isConnected = connectionManager.isConnected;
    const isConnecting = connectionManager.isConnecting;
    const hasError = connectionManager.hasError;
    
    const shouldShow = computed(() => {
      if (props.hideWhenConnected && isConnected.value) {
        return false;
      }
      return true;
    });
      const statusClass = computed(() => {
      const statusClasses = {
        'status-connected': isConnected.value,
        'status-connecting': isConnecting.value,
        'status-error': hasError.value,
        'status-disconnected': connectionState.value.overall === 'disconnected',
        'details-expanded': showDetailsExpanded.value
      };
      
      return Object.entries(statusClasses)
        .filter(([, condition]) => condition)
        .map(([className]) => className)
        .join(' ');
    });
    
    const statusIcon = computed(() => {
      switch (connectionState.value.overall) {
        case 'connected':
          return 'bi bi-wifi text-success';
        case 'connecting':
        case 'reconnecting':
          return 'bi bi-arrow-clockwise text-warning rotating';
        case 'error':
          return 'bi bi-wifi-off text-danger';
        case 'disconnected':
        default:
          return 'bi bi-wifi-off text-muted';
      }
    });
    
    const statusText = computed(() => {
      switch (connectionState.value.overall) {
        case 'connected':
          return 'Connected';
        case 'connecting':
          return 'Connecting...';
        case 'reconnecting':
          return 'Reconnecting...';
        case 'error':
          return 'Connection Error';
        case 'disconnected':
        default:
          return 'Disconnected';
      }
    });
    
    const getStatusClass = (status: ConnectionStatus): string => {
      switch (status) {
        case 'connected':
          return 'text-success';
        case 'connecting':
        case 'reconnecting':
          return 'text-warning';
        case 'error':
          return 'text-danger';
        case 'disconnected':
        default:
          return 'text-muted';
      }
    };
    
    const getStatusText = (status: ConnectionStatus): string => {
      switch (status) {
        case 'connected':
          return 'Connected';
        case 'connecting':
          return 'Connecting...';
        case 'reconnecting':
          return 'Reconnecting...';
        case 'error':
          return 'Error';
        case 'disconnected':
        default:
          return 'Disconnected';
      }
    };
    
    const handleReconnect = async () => {
      try {
        await connectionManager.reconnect();
      } catch (error) {
        console.error('Manual reconnect failed:', error);
      }
    };
    
    onMounted(() => {
      // Subscribe to connection state changes
      stateChangeUnsubscribe = connectionManager.onStateChange((state) => {
        // Auto-hide details if connection is restored
        if (state.overall === 'connected' && showDetailsExpanded.value && props.autoHide) {
          setTimeout(() => {
            showDetailsExpanded.value = false;
          }, 2000);
        }
      });
    });
    
    onUnmounted(() => {
      if (stateChangeUnsubscribe) {
        stateChangeUnsubscribe();
      }
    });
    
    return {
      connectionState,
      isConnected,
      isConnecting,
      hasError,
      shouldShow,
      statusClass,
      statusIcon,
      statusText,
      showDetailsExpanded,
      authStore,
      getStatusClass,
      getStatusText,
      handleReconnect
    };
  }
});
</script>

<style scoped>
.connection-status {
  position: relative;
  background: var(--bs-white);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  padding: 0.75rem;
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  transition: all 0.15s ease-in-out;
}

.connection-status.status-connected {
  border-color: var(--bs-success);
  background-color: rgba(var(--bs-success-rgb), 0.05);
}

.connection-status.status-connecting {
  border-color: var(--bs-warning);
  background-color: rgba(var(--bs-warning-rgb), 0.05);
}

.connection-status.status-error {
  border-color: var(--bs-danger);
  background-color: rgba(var(--bs-danger-rgb), 0.05);
}

.connection-status.status-disconnected {
  border-color: var(--bs-secondary);
  background-color: rgba(var(--bs-secondary-rgb), 0.05);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.status-indicator:last-child {
  margin-bottom: 0;
}

.status-text {
  font-weight: 500;
  font-size: 0.875rem;
}

.status-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--bs-border-color);
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.8125rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: var(--bs-secondary);
}

.error-details {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--bs-border-color);
}

.error-item {
  font-size: 0.75rem;
  color: var(--bs-danger);
  margin-bottom: 0.25rem;
  word-wrap: break-word;
}

.error-item:last-child {
  margin-bottom: 0;
}

.status-actions {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.rotating {
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Compact variant */
.connection-status.compact {
  padding: 0.5rem;
}

.connection-status.compact .status-indicator {
  margin-bottom: 0;
}

.connection-status.compact .status-text {
  font-size: 0.75rem;
}

/* Inline variant */
.connection-status.inline {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: transparent;
  border: none;
  box-shadow: none;
}

.connection-status.inline .status-indicator {
  margin-bottom: 0;
}

/* Minimal variant */
.connection-status.minimal {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.connection-status.minimal .status-indicator {
  margin-bottom: 0;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .connection-status {
    padding: 0.5rem;
  }
  
  .status-text {
    font-size: 0.8125rem;
  }
  
  .detail-item {
    font-size: 0.75rem;
  }
  
  .status-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .status-actions .btn {
    width: 100%;
  }
}
</style>
