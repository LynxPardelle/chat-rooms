<template>
  <AuthLayout 
    subtitle="Join our community and start chatting"
    switch-text="Already have an account?"
    switch-to="/auth/login"
    switch-link-text="Sign in here"
  >
    <RegisterForm 
      @success="handleSuccess"
      @error="handleError"
    />
  </AuthLayout>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { onMounted } from 'vue';
import { AuthLayout, RegisterForm } from '@/modules/auth';

const router = useRouter();
const route = useRoute();

const handleSuccess = (data: any) => {
  console.log('Registration successful:', data);
  
  // Redirect to login page after successful registration
  setTimeout(() => {
    router.push('/auth/login?registered=true');
  }, 2000);
};

const handleError = (error: string) => {
  console.error('Registration failed:', error);
};

// Handle any query parameters or setup on mount
onMounted(() => {
  // You can add any initialization logic here
  console.log('RegisterView mounted');
});
</script>

<style scoped>
/* Any component-specific styles can go here */
</style>
