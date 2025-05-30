<template>
  <div class="profile-summary">
    <div class="profile-card" @click="navigateToProfile">
      <div class="user-info d-flex align-items-center">
        <!-- Avatar -->
        <div class="avatar me-2" :style="avatarStyle">
          <template v-if="profile?.avatar">
            <img :src="profile.avatar" alt="User avatar" class="avatar-image" />
          </template>
          <template v-else>
            {{ userInitials }}
          </template>
          <span v-if="isOnline" class="online-indicator"></span>
        </div>
        
        <!-- User details -->
        <div class="user-details">
          <div class="username fw-bold text-truncate">{{ profile?.username || 'User' }}</div>
          <div class="status-text text-muted small">
            {{ statusText }}
          </div>
        </div>
        
        <!-- Settings button -->
        <button 
          class="btn btn-sm btn-icon ms-auto" 
          @click.stop="navigateToProfile" 
          title="Edit Profile"
        >
          <i class="settings-icon"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProfileStore } from '../stores/profile.store';

// Props
interface Props {
  isOnline?: boolean;
  lastActive?: Date | null;
}

const props = withDefaults(defineProps<Props>(), {
  isOnline: true,
  lastActive: null
});

// Setup
const router = useRouter();
const profileStore = useProfileStore();

// Computed properties
const profile = computed(() => profileStore.profile);

const userInitials = computed(() => profileStore.userInitials);

const avatarStyle = computed(() => {
  if (profile.value?.textColor || profile.value?.backgroundColor) {
    return {
      color: profile.value.textColor || '#000000',
      backgroundColor: profile.value.backgroundColor || '#FFFFFF'
    };
  }
  return {};
});

const statusText = computed(() => {
  if (props.isOnline) {
    return 'Online';
  }
  
  if (props.lastActive) {
    // Format relative time
    const now = new Date();
    const lastActive = new Date(props.lastActive);
    const diffMinutes = Math.round((now.getTime() - lastActive.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) {
      return 'Just now';
    }
    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    }
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
  
  return 'Offline';
});

// Methods
function navigateToProfile() {
  router.push('/profile');
}

// Initialize
onMounted(() => {
  if (!profileStore.isProfileLoaded) {
    profileStore.loadProfile();
  }
});
</script>

<style scoped>
.profile-summary {
  padding: 0.75rem;
}

.profile-card {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.profile-card:hover {
  background-color: #e9ecef;
}

.avatar {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background-color: #6c757d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.online-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #28a745;
  border: 2px solid white;
}

.user-details {
  flex-grow: 1;
  min-width: 0; /* Enable text truncation */
}

.status-text {
  font-size: 0.75rem;
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: transparent;
}

.btn-icon:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.settings-icon::before {
  content: "⚙️";
  font-size: 16px;
}
</style>
