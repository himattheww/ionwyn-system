import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import SummaryPage from './pages/SummaryPage.vue';
import './styles/app.css';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'summary', component: SummaryPage },
    { path: '/aktivitas', name: 'activities', component: () => import('./pages/ActivitiesPage.vue') },
    { path: '/beban', name: 'strength', component: () => import('./pages/StrengthPage.vue') },
    { path: '/beban/:name', name: 'exercise', component: () => import('./pages/ExercisePage.vue'), props: true },
    { path: '/recovery', name: 'recovery', component: () => import('./pages/RecoveryPage.vue') },
    { path: '/catat', name: 'log', component: () => import('./pages/LogPage.vue') },
    { path: '/berat', redirect: '/catat' },
    { path: '/makan', redirect: '/catat' },
    { path: '/laporan', name: 'report', component: () => import('./pages/ReportPage.vue') },
    { path: '/sinkron', name: 'sync', component: () => import('./pages/SyncPage.vue') },
    { path: '/pengaturan', name: 'settings', component: () => import('./pages/SettingsPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

createApp(App).use(router).mount('#app');
