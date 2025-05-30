import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { authGuard, guestGuard, loadingGuard } from './guards';

// Rutas
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/modules/chat/ChatView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/modules/auth/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/auth/login',
    name: 'AuthLogin',
    component: () => import('@/modules/auth/LoginView.vue'),
    meta: { guest: true }
  },
  {
    path: '/auth/register',
    name: 'AuthRegister',
    component: () => import('@/modules/auth/RegisterView.vue'),
    meta: { guest: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/modules/profile/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/components',
    name: 'ComponentShowcase',
    component: () => import('@/shared/components/ComponentShowcase.vue'),
    meta: { title: 'Component Showcase' }
  },
  {
    path: '/forbidden',
    name: 'Forbidden',
    component: () => import('@/shared/components/Forbidden.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/shared/components/NotFound.vue')
  }
];

// Crear instancia de router
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

// Guards para navegación usando AuthService
router.beforeEach(loadingGuard);
router.beforeEach(authGuard);
router.beforeEach(guestGuard);

export default router;
