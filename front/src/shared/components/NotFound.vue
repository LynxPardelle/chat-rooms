<template>
  <div class="not-found-container">
    <div class="card text-center p-5">
      <h1>404</h1>
      <h2>Página no encontrada</h2>
      <p>Lo sentimos, la página que estás buscando no existe.</p>
      <router-link to="/" class="btn btn-primary mt-3">
        Volver al inicio
      </router-link>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'NotFound',
});
</script>

<style scoped>
.not-found-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--light-bg);
}

.card {
  max-width: 500px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 6rem;
  color: var(--secondary-color);
}

h2 {
  color: var(--primary-color);
}
</style>
