/**
 * AuthLayout Component
 * Layout container for authentication pages
 */

<template>
  <div class="auth-layout">
    <!-- Background -->
    <div class="auth-layout__background w-100" />
    
    <!-- Content Container -->
    <div class="auth-layout__container">
      <div class="auth-layout__card">
        <!-- Header -->
        <div class="auth-layout__header">
          <div class="auth-layout__logo">
            <h1 class="auth-layout__title">LiveChat</h1>
            <p class="auth-layout__subtitle">{{ subtitle }}</p>
          </div>
        </div>
        
        <!-- Main Content -->
        <div class="auth-layout__content">
          <slot />
        </div>
        
        <!-- Footer -->
        <div class="auth-layout__footer">
          <slot name="footer">
            <p class="auth-layout__footer-text">
              By continuing, you agree to our 
              <a href="/terms" class="auth-layout__link">Terms of Service</a> 
              and 
              <a href="/privacy" class="auth-layout__link">Privacy Policy</a>
            </p>
          </slot>
        </div>
      </div>
      
      <!-- Switch Form Link -->
      <div v-if="switchText && switchTo" class="auth-layout__switch">
        <p class="auth-layout__switch-text">
          {{ switchText }}
          <router-link :to="switchTo" class="auth-layout__switch-link">
            {{ switchLinkText }}
          </router-link>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  subtitle?: string;
  switchText?: string;
  switchTo?: string;
  switchLinkText?: string;
}

withDefaults(defineProps<Props>(), {
  subtitle: 'Connect and chat with friends',
  switchText: '',
  switchTo: '',
  switchLinkText: ''
});
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow: hidden;
}

.auth-layout__background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.3) 0%, transparent 50%);
  animation: backgroundShift 20s ease-in-out infinite;
}

@keyframes backgroundShift {
  0%, 100% {
    transform: scale(1) rotate(0deg);
  }
  50% {
    transform: scale(1.1) rotate(2deg);
  }
}

.auth-layout__container {
  max-width: 400px;
  width: 100%;
  padding: 24px;
  z-index: 1;
}

.auth-layout__card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.05);
  padding: 32px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.auth-layout__card:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.15),
    0 4px 12px rgba(0, 0, 0, 0.1);
}

.auth-layout__header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-layout__logo {
  margin-bottom: 8px;
}

.auth-layout__title {
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 8px 0;
}

.auth-layout__subtitle {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.8;
}

.auth-layout__content {
  margin-bottom: 24px;
}

.auth-layout__footer {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.auth-layout__footer-text {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.auth-layout__link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.auth-layout__link:hover {
  color: #5a67d8;
  text-decoration: underline;
}

.auth-layout__switch {
  text-align: center;
  margin-top: 24px;
}

.auth-layout__switch-text {
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  margin: 0;
}

.auth-layout__switch-link {
  color: white;
  text-decoration: none;
  font-weight: 600;
  margin-left: 4px;
  transition: all 0.2s ease;
  border-bottom: 1px solid transparent;
}

.auth-layout__switch-link:hover {
  border-bottom-color: white;
  transform: translateY(-1px);
}

/* Responsive Design */
@media (max-width: 480px) {
  .auth-layout__container {
    padding: 16px;
  }
  
  .auth-layout__card {
    padding: 24px;
    border-radius: 16px;
  }
  
  .auth-layout__title {
    font-size: 1.75rem;
  }
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .auth-layout {
    background: linear-gradient(135deg, #1a202c 0%, #2d3748 100%);
  }
  
  .auth-layout__card {
    background: rgba(26, 32, 44, 0.95);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .auth-layout__footer-text {
    color: #a0aec0;
  }
  
  .auth-layout__footer {
    border-top-color: rgba(255, 255, 255, 0.1);
  }
}
</style>
