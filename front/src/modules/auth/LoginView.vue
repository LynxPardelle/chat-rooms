<template>
  <AuthLayout 
    subtitle="Inicia sesión para continuar en LiveChat"
    switch-text="¿No tienes una cuenta?"
    switch-to="/auth/register"
    switch-link-text="Crea una aquí"
  >
    <LoginForm 
      @success="handleSuccess"
      @error="handleError"
    />
  </AuthLayout>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { onMounted } from 'vue';
import { AuthLayout, LoginForm } from '@/modules/auth';

const router = useRouter();
const route = useRoute();

const handleSuccess = (data: any) => {
  console.log('Inicio de sesión exitoso:', data);
  
  // Redirigir a la página de chat después de un inicio de sesión exitoso
  setTimeout(() => {
    const redirectTo = (route.query.redirect as string) || '/';
    router.push(redirectTo);
  }, 1500);
};

const handleError = (error: string) => {
  console.error('Error al iniciar sesión:', error);
};

// Manejar cualquier parámetro de consulta al montar
onMounted(() => {
  if (route.query.registered) {
    console.log('El usuario se registró recientemente, mostrando el formulario de inicio de sesión');
  }
});
</script>

<style scoped>
/* Aquí pueden ir los estilos específicos del componente */
</style>
