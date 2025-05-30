<template>
  <!-- Usando RouterView para mostrar los componentes según la ruta -->
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'App',
});
</script>

<style>
/* Estilos globales */
:root {
  --primary-color: #42b883;
  --primary-dark: #33a06f;
  --secondary-color: #35495e;
  --text-color: #2c3e50;
  --light-bg: #f8f9fa;
  --danger: #dc3545;
  --success: #28a745;
  --info: #17a2b8;
  --warning: #ffc107;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
    Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  color: var(--text-color);
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* Animaciones para transiciones de página */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
