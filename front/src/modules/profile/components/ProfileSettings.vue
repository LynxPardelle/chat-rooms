<template>
  <div class="profile-settings">
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <h3 class="mb-0">Profile Settings</h3>
        <button class="btn btn-outline-secondary btn-sm" @click="navigateBack">
          Back to Chat
        </button>
      </div>
      
      <div class="card-body">
        <div v-if="loading" class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        
        <template v-else>
          <!-- Profile Summary -->
          <div class="profile-summary text-center mb-4">
            <avatar-upload 
              :current-avatar="profileData.avatar" 
              :user-initials="userInitials"
              @update:avatar="onAvatarChange"
            />
            
            <h4 class="mt-3">{{ profileData.username }}</h4>
          </div>
          
          <!-- Validation Error Messages -->
          <div v-if="validationErrors.length" class="alert alert-danger" role="alert">
            <ul class="mb-0">
              <li v-for="error in validationErrors" :key="error.field">
                {{ error.message }}
              </li>
            </ul>
          </div>
          
          <!-- Settings Form -->
          <form @submit.prevent="saveSettings">
            <!-- Username -->
            <div class="mb-3">
              <label for="username" class="form-label">Username</label>
              <input
                id="username"
                v-model="profileData.username"
                type="text" 
                class="form-control"
                placeholder="Your display name"
                @input="profileStore.setDirty"
              >
            </div>
            
            <!-- Color Settings -->
            <color-picker
              v-model:text-color="profileData.textColor"
              v-model:bg-color="profileData.backgroundColor"
              @update:text-color="profileStore.setDirty"
              @update:bg-color="profileStore.setDirty"
            />
            
            <!-- User Preferences -->
            <user-preferences
              v-if="profileData.preferences"
              v-model:preferences="profileData.preferences"
              @update:preferences="profileStore.setDirty"
            />
            
            <!-- Message Preview -->
            <div class="message-preview p-3 mb-4 rounded" 
              :style="{ 
                color: profileData.textColor, 
                backgroundColor: profileData.backgroundColor 
              }">
              <div class="d-flex align-items-center">
                <div class="preview-avatar me-2">{{ userInitials }}</div>
                <div>
                  <div class="fw-bold">{{ profileData.username }}</div>
                  <p class="mb-0">This is how your messages will appear to others</p>
                </div>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="d-flex gap-2">
              <button 
                type="submit" 
                class="btn btn-primary" 
                :disabled="saving || !isDirty">
                <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status"></span>
                Save Changes
              </button>
              
              <button 
                type="button" 
                class="btn btn-outline-secondary"
                @click="resetChanges"
                :disabled="!isDirty">
                Reset
              </button>
            </div>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProfileStore } from '../stores/profile.store';
import AvatarUpload from './AvatarUpload.vue';
import ColorPicker from './ColorPicker.vue';
import UserPreferences from './UserPreferences.vue';
import type { UserProfile } from '../types/profile.types';

// Initialize router and store
const router = useRouter();
const profileStore = useProfileStore();

// Create a local copy of the profile data that we can modify
const profileData = ref<Partial<UserProfile>>({
  username: '',
  textColor: '#000000',
  backgroundColor: '#FFFFFF',
  avatar: undefined,
  preferences: {
    enableNotifications: true,
    showStatusToOthers: true,
    displayReadReceipts: true,
    soundEnabled: true,
    theme: 'light',
  },
});

// Computed properties
const loading = computed(() => profileStore.loading);
const saving = computed(() => profileStore.saving);
const isDirty = computed(() => profileStore.isDirty);
const validationErrors = computed(() => profileStore.validationErrors);
const userInitials = computed(() => profileStore.userInitials);

// Methods
function navigateBack() {
  router.push('/');
}

async function saveSettings() {
  if (!profileData.value) return;
  
  const success = await profileStore.updateProfile({
    username: profileData.value.username,
    textColor: profileData.value.textColor || '#000000',
    backgroundColor: profileData.value.backgroundColor || '#FFFFFF',
    avatar: profileData.value.avatar,
  });
  
  if (success && profileData.value.preferences) {
    await profileStore.updatePreferences(profileData.value.preferences);
  }
}

function resetChanges() {
  profileStore.resetChanges();
}

function onAvatarChange(avatar: File | string | null) {
  if (profileData.value) {
    profileData.value = {
      ...profileData.value,
      avatar: avatar as string
    };
  }
  profileStore.setDirty();
}

// Load profile data
onMounted(async () => {
  if (!profileStore.isProfileLoaded) {
    await profileStore.loadProfile();
  }
  
  // Initialize local data from store
  if (profileStore.profile) {
    profileData.value = { ...profileStore.profile };
  }
});

// Keep local data in sync with store
watch(() => profileStore.profile, (newProfile) => {
  if (newProfile && !isDirty.value) {
    profileData.value = { ...newProfile };
  }
}, { deep: true });
</script>

<style scoped>
.profile-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.card {
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.card-header {
  background-color: #f8f9fa;
  border-bottom: 1px solid rgba(0, 0, 0, 0.125);
  border-radius: 10px 10px 0 0 !important;
}

.preview-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: #6c757d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
}

.message-preview {
  border: 1px solid #dee2e6;
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}
</style>
