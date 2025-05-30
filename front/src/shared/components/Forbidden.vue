<template>
  <div class="forbidden-container">
    <div class="forbidden-content">
      <div class="error-icon">
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#ef4444"/>
        </svg>
      </div>
      
      <h1 class="error-title">403 - Forbidden</h1>
      <p class="error-message">
        You don't have permission to access this resource.
      </p>
      
      <div v-if="reason" class="error-details">
        <p class="reason-text">
          <strong>Reason:</strong> {{ formattedReason }}
        </p>
        <p v-if="requiredRoles" class="required-roles">
          <strong>Required permissions:</strong> {{ requiredRoles }}
        </p>
      </div>
      
      <div class="action-buttons">
        <button @click="goHome" class="btn btn-primary">
          Go Home
        </button>
        <button @click="goBack" class="btn btn-secondary">
          Go Back
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const reason = ref<string>('');
const requiredRoles = ref<string>('');

const formattedReason = computed(() => {
  switch (reason.value) {
    case 'insufficient_permissions':
      return 'You do not have sufficient permissions to access this page';
    case 'authentication_required':
      return 'You must be logged in to access this page';
    default:
      return reason.value || 'Access denied';
  }
});

onMounted(() => {
  reason.value = (route.query.reason as string) || '';
  requiredRoles.value = (route.query.required as string) || '';
});

const goHome = () => {
  router.push('/');
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/');
  }
};
</script>

<style scoped>
.forbidden-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.forbidden-content {
  background: white;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.error-icon {
  margin-bottom: 20px;
}

.error-title {
  font-size: 2.5rem;
  color: #ef4444;
  margin-bottom: 16px;
  font-weight: 700;
}

.error-message {
  font-size: 1.1rem;
  color: #6b7280;
  margin-bottom: 24px;
  line-height: 1.6;
}

.error-details {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
}

.reason-text,
.required-roles {
  margin: 8px 0;
  color: #374151;
  font-size: 0.9rem;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  font-size: 0.9rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .forbidden-content {
    padding: 24px;
  }
  
  .error-title {
    font-size: 2rem;
  }
  
  .action-buttons {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
</style>
