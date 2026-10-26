import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/auth',
      component: () => import('@/views/AuthView.vue'),
      meta: { requiresGuest: true },
      children: [
        { path: '', redirect: '/auth/login' },
        { path: 'login', name: 'login', component: () => import('@/views/auth/LoginPage.vue') },
        { path: 'register', name: 'register', component: () => import('@/views/auth/RegisterPage.vue') },
        { path: 'callback',       name: 'auth-callback',    component: () => import('@/views/auth/CallbackPage.vue') },
        { path: 'forgot',          name: 'forgot-password',  component: () => import('@/views/auth/ForgotPasswordPage.vue') },
        { path: 'reset-password',  name: 'reset-password',   component: () => import('@/views/auth/ResetPasswordPage.vue'), meta: { requiresGuest: false } },
      ],
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/telegram-link',
      name: 'telegram-link',
      component: () => import('@/views/TelegramLinkView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      component: () => import('@/views/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard',    name: 'dashboard',    component: () => import('@/views/DashboardView.vue') },
        { path: 'transactions', name: 'transactions', component: () => import('@/views/TransactionsView.vue') },
        { path: 'charts',       name: 'charts',       component: () => import('@/views/ChartsView.vue') },
        { path: 'goals',        name: 'goals',        component: () => import('@/views/GoalsView.vue') },
        { path: 'budget',       name: 'budget',       component: () => import('@/views/BudgetView.vue') },
        { path: 'profile',      name: 'profile',      component: () => import('@/views/ProfileView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (!authStore.user && !authStore.loading) {
    await authStore.initialize()
  }

  const isLoggedIn = authStore.isLoggedIn

  if (to.meta.requiresAuth && !isLoggedIn) {
    // Kalau ada redirect query (misal dari telegram-link), bawa balik setelah login
    if (to.query.redirect) {
      return { name: 'login', query: { redirect: to.query.redirect } }
    }
    return { name: 'login' }
  }

  if (to.meta.requiresGuest && isLoggedIn) {
    return { name: 'dashboard' }
  }

  if (isLoggedIn && to.meta.requiresAuth && to.name !== 'onboarding' && to.name !== 'auth-callback' && to.name !== 'reset-password') {
    if (!authStore.profile) {
      await authStore.fetchProfile()
    }
    if (authStore.profile && !authStore.isOnboarded && to.name !== 'telegram-link') {
      return { name: 'onboarding' }
    }
  }
})

export default router