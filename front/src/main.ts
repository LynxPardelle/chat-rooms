import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { initializeApp } from '@/core/init'
// Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// Import shared styles
import '@/shared/styles/index.css'

// Import shared components
import * as components from '@/shared/components'

// Create app instance
const app = createApp(App)

// Use plugins
app.use(createPinia())
app.use(router)

// Register all shared components globally
Object.entries(components).forEach(([name, component]) => {
  app.component(name, component)
})

// Initialize app services and mount
initializeApp().then(() => {
  app.mount('#app')
}).catch((error) => {
  console.error('Failed to initialize app:', error);
  app.mount('#app'); // Mount anyway for debugging
})
