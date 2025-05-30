<template>
  <div class="profile-container">
    <profile-settings />
  </div>
</template>

<script setup lang="ts">
import ProfileSettings from './components/ProfileSettings.vue';
</script>

<style scoped>
.profile-container {
  width: 100%;
  min-height: 100vh;
  padding: 1rem;
  background-color: #f8f9fa;
}

@media (min-width: 768px) {
  .profile-container {
    padding: 2rem;
  }
}
</style>
