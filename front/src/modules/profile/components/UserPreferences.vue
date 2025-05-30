<template>
  <div class="user-preferences mt-4 mb-4">
    <h5 class="mb-3">Preferences</h5>
    
    <div class="card">
      <div class="list-group list-group-flush">
        <!-- Notification settings -->
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-medium">Notifications</div>
            <div class="text-muted small">Get alerts for new messages</div>
          </div>
          <div class="form-check form-switch">
            <input 
              class="form-check-input" 
              type="checkbox" 
              id="enableNotifications" 
              v-model="localPreferences.enableNotifications"
              @change="emitUpdate"
            >
          </div>
        </div>
        
        <!-- Online status visibility -->
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-medium">Show Online Status</div>
            <div class="text-muted small">Let others see when you're active</div>
          </div>
          <div class="form-check form-switch">
            <input 
              class="form-check-input" 
              type="checkbox" 
              id="showStatusToOthers" 
              v-model="localPreferences.showStatusToOthers"
              @change="emitUpdate"
            >
          </div>
        </div>
        
        <!-- Read receipts -->
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-medium">Read Receipts</div>
            <div class="text-muted small">Let others know when you've seen messages</div>
          </div>
          <div class="form-check form-switch">
            <input 
              class="form-check-input" 
              type="checkbox" 
              id="displayReadReceipts" 
              v-model="localPreferences.displayReadReceipts"
              @change="emitUpdate"
            >
          </div>
        </div>
        
        <!-- Sound settings -->
        <div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-medium">Sound Effects</div>
            <div class="text-muted small">Play sounds for new messages</div>
          </div>
          <div class="form-check form-switch">
            <input 
              class="form-check-input" 
              type="checkbox" 
              id="soundEnabled" 
              v-model="localPreferences.soundEnabled"
              @change="emitUpdate"
            >
          </div>
        </div>
        
        <!-- Theme settings -->
        <div class="list-group-item">
          <div class="fw-medium mb-2">App Theme</div>
          <div class="d-flex">
            <div class="form-check me-3">
              <input 
                class="form-check-input" 
                type="radio" 
                id="themeLight" 
                value="light"
                v-model="localPreferences.theme"
                @change="emitUpdate"
              >
              <label class="form-check-label" for="themeLight">
                Light
              </label>
            </div>
            
            <div class="form-check me-3">
              <input 
                class="form-check-input" 
                type="radio" 
                id="themeDark" 
                value="dark"
                v-model="localPreferences.theme"
                @change="emitUpdate"
              >
              <label class="form-check-label" for="themeDark">
                Dark
              </label>
            </div>
            
            <div class="form-check">
              <input 
                class="form-check-input" 
                type="radio" 
                id="themeSystem" 
                value="system"
                v-model="localPreferences.theme"
                @change="emitUpdate"
              >
              <label class="form-check-label" for="themeSystem">
                System
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { UserPreferences } from '../types/profile.types';

// Props and emit
interface Props {
  preferences: UserPreferences;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:preferences': [preferences: UserPreferences];
}>();

// Local state with defaults
const localPreferences = ref<UserPreferences>({
  enableNotifications: props.preferences?.enableNotifications ?? true,
  showStatusToOthers: props.preferences?.showStatusToOthers ?? true,
  displayReadReceipts: props.preferences?.displayReadReceipts ?? true,
  soundEnabled: props.preferences?.soundEnabled ?? true,
  theme: props.preferences?.theme ?? 'light',
});

// Methods
function emitUpdate() {
  emit('update:preferences', { ...localPreferences.value });
}

// Watch for props changes
watch(() => props.preferences, (newPrefs) => {
  if (newPrefs) {
    localPreferences.value = { ...newPrefs };
  }
}, { deep: true });
</script>

<style scoped>
.user-preferences {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.card {
  border-radius: 8px;
  overflow: hidden;
}

.form-check-input:checked {
  background-color: #0d6efd;
  border-color: #0d6efd;
}

.list-group-item:last-child {
  border-bottom: none;
}
</style>
