<template>
  <div class="read-receipt-container" v-if="showReadReceipts && messageId">
    <!-- Read Receipt Summary -->
    <div class="receipt-summary" v-if="readStats.total > 0">
      <div class="receipt-stats">        <span class="stat-item delivered" v-if="readStats.delivered > 0">
          <span class="icon icon-delivered"></span>
          {{ readStats.delivered }}/{{ readStats.total }} delivered
        </span>
        <span class="stat-item read" v-if="readStats.read > 0">
          <span class="icon icon-read"></span>
          {{ readStats.read }}/{{ readStats.total }} read
        </span>
      </div>
      
      <!-- Progress Bars -->
      <div class="progress-bars" v-if="showProgress">
        <div class="progress-bar">
          <label>Delivery Rate</label>
          <div class="progress-track">
            <div 
              class="progress-fill delivery" 
              :style="{ width: `${readStats.deliveryRate}%` }"
            ></div>
          </div>
          <span class="progress-text">{{ Math.round(readStats.deliveryRate) }}%</span>
        </div>
        
        <div class="progress-bar">
          <label>Read Rate</label>
          <div class="progress-track">
            <div 
              class="progress-fill read" 
              :style="{ width: `${readStats.readRate}%` }"
            ></div>
          </div>
          <span class="progress-text">{{ Math.round(readStats.readRate) }}%</span>
        </div>
      </div>
    </div>

    <!-- Detailed Read Receipts -->
    <div class="receipt-details" v-if="showDetails && readReceipts.length > 0">
      <h5>Read by:</h5>
      <div class="receipt-list">
        <div 
          v-for="receipt in readReceipts" 
          :key="receipt.userId"
          class="receipt-item"
        >
          <div class="user-avatar">
            {{ receipt.username.charAt(0).toUpperCase() }}
          </div>
          <div class="receipt-info">
            <span class="username">{{ receipt.username }}</span>
            <span class="read-time">{{ formatReadTime(receipt.readAt) }}</span>
          </div>
          <span class="icon icon-read-check read-icon"></span>
        </div>
      </div>
    </div>

    <!-- Toggle Details Button -->
    <button 
      v-if="readReceipts.length > 0"
      @click="showDetails = !showDetails"
      class="toggle-details"
    >
      {{ showDetails ? 'Hide Details' : 'Show Details' }}
      <span :class="['icon', showDetails ? 'icon-chevron-up' : 'icon-chevron-down']"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useReadReceiptsStore } from '@/stores/read-receipts';

// Props
interface Props {
  messageId: string;
  showProgress?: boolean;
  showReadReceipts?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showProgress: true,
  showReadReceipts: true
});

// Store
const readReceiptsStore = useReadReceiptsStore();

// Local state
const showDetails = ref(false);

// Computed
const readStats = computed(() => 
  readReceiptsStore.getMessageDeliveryStats(props.messageId).value
);

const readReceipts = computed(() => 
  readReceiptsStore.getReadReceiptsForMessage(props.messageId).value
);

// Methods
const formatReadTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};


</script>

<style scoped>
.read-receipt-container {
  margin-top: 8px;
  padding: 8px;
  background: var(--bg-tertiary, #f8f9fa);
  border-radius: 6px;
  border: 1px solid var(--border-color, #e0e0e0);
  font-size: 12px;
}

.receipt-summary {
  margin-bottom: 8px;
}

.receipt-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary, #666);
}

.stat-item.delivered {
  color: var(--warning-color, #ff9800);
}

.stat-item.read {
  color: var(--success-color, #4caf50);
}

.progress-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar label {
  font-size: 10px;
  color: var(--text-secondary, #666);
  min-width: 60px;
  font-weight: 500;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: var(--border-color, #e0e0e0);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 2px;
}

.progress-fill.delivery {
  background: var(--warning-color, #ff9800);
}

.progress-fill.read {
  background: var(--success-color, #4caf50);
}

.progress-text {
  font-size: 10px;
  color: var(--text-secondary, #666);
  min-width: 30px;
  text-align: right;
  font-weight: 500;
}

.receipt-details {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.receipt-details h5 {
  margin: 0 0 8px 0;
  font-size: 11px;
  color: var(--text-primary, #333);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.receipt-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.receipt-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: white;
  border-radius: 4px;
  border: 1px solid var(--border-color, #f0f0f0);
}

.user-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--primary-color, #2196f3);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.receipt-info {
  flex: 1;
  min-width: 0;
}

.username {
  display: block;
  font-weight: 500;
  font-size: 11px;
  color: var(--text-primary, #333);
}

.read-time {
  display: block;
  font-size: 10px;
  color: var(--text-secondary, #666);
}

.read-icon {
  color: var(--success-color, #4caf50);
  font-size: 12px;
  flex-shrink: 0;
}

.toggle-details {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 4px 8px;
  background: none;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 4px;
  font-size: 10px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.toggle-details:hover {
  background: var(--bg-secondary, #f0f0f0);
  border-color: var(--primary-color, #2196f3);
  color: var(--primary-color, #2196f3);
}

/* Icon styles (placeholder) */
.icon {
  display: inline-block;
  width: 12px;
  height: 12px;
}

.icon-delivered::before {
  content: '✓';
}

.icon-read::before {
  content: '✓✓';
}

.icon-read-check::before {
  content: '✓';
}

.icon-chevron-up::before {
  content: '▲';
}

.icon-chevron-down::before {
  content: '▼';
}

/* Responsive design */
@media (max-width: 768px) {
  .read-receipt-container {
    padding: 6px;
  }
  
  .receipt-stats {
    flex-direction: column;
    gap: 4px;
  }
  
  .progress-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .progress-bar label {
    min-width: auto;
  }
  
  .receipt-list {
    max-height: 100px;
  }
}
</style>
