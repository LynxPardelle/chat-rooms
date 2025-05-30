<template>
  <div class="avatar-upload-container">
    <!-- Avatar Preview -->
    <div class="avatar-preview" @click="triggerFileInput">
      <template v-if="previewUrl">
        <img :src="previewUrl" alt="User avatar" class="avatar-image" />
      </template>
      <template v-else>
        <div class="avatar-placeholder">{{ userInitials }}</div>
      </template>
      
      <div class="avatar-overlay">
        <i class="avatar-edit-icon"></i>
      </div>
    </div>
    
    <!-- Upload Controls -->
    <div class="avatar-controls mt-2">
      <input 
        ref="fileInput"
        type="file" 
        accept="image/jpeg,image/png,image/gif,image/webp" 
        class="visually-hidden"
        @change="onFileSelected" 
      />
      
      <div class="d-flex gap-2 justify-content-center">
        <button 
          type="button" 
          class="btn btn-sm btn-outline-primary" 
          @click="triggerFileInput">
          Change Avatar
        </button>
        
        <button 
          v-if="hasAvatar" 
          type="button" 
          class="btn btn-sm btn-outline-danger" 
          @click="removeAvatar">
          Remove
        </button>
      </div>
    </div>
    
    <!-- Validation Error -->
    <div v-if="error" class="avatar-error mt-2 text-danger small">
      {{ error }}
    </div>
    
    <!-- Upload Progress -->
    <div v-if="uploadInProgress" class="mt-2">
      <div class="progress" style="height: 5px;">
        <div 
          class="progress-bar" 
          role="progressbar"
          :style="{ width: `${uploadProgress}%` }"
          :aria-valuenow="uploadProgress" 
          aria-valuemin="0" 
          aria-valuemax="100">
        </div>
      </div>
      <div class="text-center small mt-1">Uploading: {{ uploadProgress }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { AVATAR_CONSTRAINTS } from '../types/profile.types';
import { useProfileStore } from '../stores/profile.store';

// Props and emit
interface Props {
  currentAvatar?: string;
  userInitials: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:avatar': [value: File | string | null]
}>();

// State
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const error = ref<string | null>(null);
const profileStore = useProfileStore();

// Computed
const uploadInProgress = computed(() => 
  profileStore.avatarUploadStatus === 'uploading'
);

const uploadProgress = computed(() => 
  profileStore.avatarUploadProgress
);

const hasAvatar = computed(() => 
  !!previewUrl.value || !!props.currentAvatar
);

// Methods
function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  
  const file = target.files[0];
  error.value = null;
  
  // Validate file
  if (!validateFile(file)) return;
  
  // Set selected file and create preview
  selectedFile.value = file;
  createPreview(file);
  
  // Emit update event
  emit('update:avatar', file);
}

function validateFile(file: File): boolean {
  // Check file type
  if (!AVATAR_CONSTRAINTS.ALLOWED_FORMATS.includes(file.type)) {
    error.value = `Invalid file type. Allowed: ${AVATAR_CONSTRAINTS.ALLOWED_FORMATS.map(type => type.split('/')[1]).join(', ')}`;
    return false;
  }
  
  // Check file size
  if (file.size > AVATAR_CONSTRAINTS.MAX_SIZE_BYTES) {
    error.value = `File too large. Maximum size: ${AVATAR_CONSTRAINTS.MAX_SIZE_MB}MB`;
    return false;
  }
  
  return true;
}

function createPreview(file: File) {
  const reader = new FileReader();
    reader.onload = (e) => {
    if (e.target?.result) {
      // Create image to check dimensions
      const img = new Image();
      img.src = e.target.result as string;
      
      img.onload = () => {
        // Check image dimensions
        if (img.width > AVATAR_CONSTRAINTS.MAX_DIMENSIONS.width || 
            img.height > AVATAR_CONSTRAINTS.MAX_DIMENSIONS.height) {
          error.value = `Image dimensions too large. Max: ${AVATAR_CONSTRAINTS.MAX_DIMENSIONS.width}x${AVATAR_CONSTRAINTS.MAX_DIMENSIONS.height}px`;
          selectedFile.value = null;
          previewUrl.value = null;
          emit('update:avatar', null);
          return;
        }
        
        if (img.width < AVATAR_CONSTRAINTS.MIN_DIMENSIONS.width || 
            img.height < AVATAR_CONSTRAINTS.MIN_DIMENSIONS.height) {
          error.value = `Image dimensions too small. Min: ${AVATAR_CONSTRAINTS.MIN_DIMENSIONS.width}x${AVATAR_CONSTRAINTS.MIN_DIMENSIONS.height}px`;
          selectedFile.value = null;
          previewUrl.value = null;
          emit('update:avatar', null);
          return;
        }
        
        if (e.target && e.target.result) {
          previewUrl.value = e.target.result as string;
        }
      };
    }
  };
  
  reader.readAsDataURL(file);
}

function removeAvatar() {
  selectedFile.value = null;
  previewUrl.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  emit('update:avatar', null);
}

// Initialize preview from props
onMounted(() => {
  if (props.currentAvatar) {
    previewUrl.value = props.currentAvatar;
  }
});

// Watch props changes
watch(() => props.currentAvatar, (newAvatar) => {
  if (newAvatar && !selectedFile.value) {
    previewUrl.value = newAvatar;
  }
});

// Reset on upload status change
watch(() => profileStore.avatarUploadStatus, (status) => {
  if (status === 'error') {
    error.value = 'Failed to upload avatar. Please try again.';
  }
});
</script>

<style scoped>
.avatar-upload-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-preview {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 3px solid #e9ecef;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.avatar-preview:hover {
  border-color: #007bff;
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #6c757d;
  color: white;
  font-size: 2.5rem;
  font-weight: bold;
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.avatar-edit-icon::before {
  content: "📷";
  font-size: 1.5rem;
  color: white;
}
</style>
