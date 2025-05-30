# 1.3 Setup Frontend (Vue 3 + TypeScript)

## Explicación

Crearemos el proyecto frontend con Vue 3, Vite y TypeScript. Configuraremos una estructura modular similar a Angular o NestJS para mantener una organización consistente en todo el proyecto. Esta estructura nos permitirá escalar fácilmente la aplicación y reutilizar componentes. Configuraremos los componentes para que se dividan en tres partes: template, script y estilos, similar a Angular.

## Objetivos

- Configurar Vue 3 con Vite y TypeScript
- Implementar estructura modular escalable
- Instalar dependencias principales para estado, routing y comunicación
- Configurar herramientas de desarrollo y testing

## Estructura Esperada

`
front/
├── src/
│   ├── modules/           # Módulos de funcionalidad
│   │   ├── auth/
│   │   ├── chat/
│   │   └── user/
│   ├── core/             # Servicios centrales
│   │   ├── services/
│   │   ├── config/
│   │   └── interceptors/
│   ├── shared/           # Componentes compartidos
│   │   ├── components/
│   │   ├── composables/
│   │   └── utils/
│   ├── types/            # Definiciones TypeScript
│   │   ├── api.types.ts
│   │   └── app.types.ts
│   ├── assets/           # Recursos estáticos
│   ├── styles/           # Estilos globales
│   ├── App.vue          # Componente raíz
│   └── main.ts          # Punto de entrada
├── public/               # Archivos públicos
├── tests/               # Tests unitarios y e2e
├── index.html           # HTML principal
├── package.json         # Dependencias del frontend
├── vite.config.ts       # Configuración Vite
├── tsconfig.json        # Configuración TypeScript
├── tsconfig.app.json    # Configuración app
├── tsconfig.node.json   # Configuración Node
└── vitest.config.ts     # Configuración testing
`

## Dependencias Requeridas

### Dependencias Principales

```json
{
  "dependencies": {
    "vue": "^3.3.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "socket.io-client": "^4.7.0",
    "bootstrap": "^5.3.0",
    "@vueuse/core": "^10.2.0",
    "axios": "^1.4.0"
  }
}
```

### Dependencias de Desarrollo

```json
{
  "devDependencies": {
    "@vitejs/plugin-vue": "^4.2.0",
    "@vue/tsconfig": "^0.4.0",
    "@types/node": "^20.3.0",
    "typescript": "^5.1.0",
    "vite": "^4.4.0",
    "vitest": "^0.33.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^22.1.0",
    "eslint": "^8.42.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "prettier": "^2.8.8"
  }
}
```

## Configuraciones Importantes

### vite.config.ts

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/modules': resolve(__dirname, 'src/modules'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/shared': resolve(__dirname, 'src/shared'),
      '@/types': resolve(__dirname, 'src/types')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/modules/*": ["./src/modules/*"],
      "@/core/*": ["./src/core/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
```

## Archivos Base a Crear

### src/main.ts

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './core/router'
import App from './App.vue'

// Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Estilos globales
import './styles/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
```

### src/App.vue

```vue
<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup lang="ts">
// Lógica del componente principal
</script>

<style scoped>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
```

### src/core/router/index.ts

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/modules/chat/views/ChatView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
```

## Estructura de Componentes Vue

Los componentes deben seguir esta estructura de tres partes:

```vue
<template>
  <!-- HTML template con binding de Vue -->
  <div class="component-container">
    <h1>{{ title }}</h1>
    <button @click="handleClick">Click me</button>
  </div>
</template>

<script setup lang="ts">
// TypeScript logic con Composition API
import { ref, computed } from 'vue'

interface Props {
  initialTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialTitle: 'Default Title'
})

const title = ref(props.initialTitle)

const handleClick = () => {
  console.log('Button clicked!')
}
</script>

<style scoped>
/* CSS específico del componente */
.component-container {
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}
</style>
```

## Validación

### Checklist de Validación

- [ ] Proyecto Vue 3 inicializado con Vite
- [ ] Estructura modular implementada (4 carpetas principales en src/)
- [ ] Todas las dependencias instaladas sin errores
- [ ] TypeScript configurado correctamente con paths
- [ ] El proyecto compila y se ejecuta sin errores
- [ ] Hot reload funcionando con `npm run dev`
- [ ] Testing configurado con Vitest

### Comandos de Verificación

1. **Instalación y build**:

   ```bash
   cd front
   npm install
   npm run build
   ```

2. **Iniciar en modo desarrollo**:

   ```bash
   npm run dev
   ```

3. **Ejecutar tests**:

   ```bash
   npm run test
   ```

4. **Verificar estructura**:

   ```bash
   tree src/
   # o
   ls -la src/*/
   ```

5. **Verificar TypeScript**:

   ```bash
   npx vue-tsc --noEmit
   ```

## Scripts del package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --ignore-path .gitignore",
    "lint:fix": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --ignore-path .gitignore --fix"
  }
}
```

## Notas de Implementación

- Usar Composition API como estándar para todos los componentes
- Configurar path aliases para imports limpios
- Bootstrap proporciona base sólida para UI rápido
- Pinia es el state manager oficial recomendado para Vue 3
- Vitest está optimizado para proyectos Vite

## Problemas Comunes

- **Puerto 5173**: Asegurar que no esté ocupado
- **Path aliases**: Verificar configuración en vite.config.ts y tsconfig.json
- **TypeScript errors**: Asegurar compatibilidad de versiones

---

**Siguiente fase**: [Fase 2: Configuración de Base de Datos y Docker](../fase-2-database/README.md)
