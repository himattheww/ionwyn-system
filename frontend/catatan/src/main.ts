import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import '@phosphor-icons/web/regular/style.css'
import '@phosphor-icons/web/fill/style.css'
import App from './App.vue'
import HomePage from './pages/HomePage.vue'
import './styles/app.css'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomePage },
    { path: '/kalender', component: () => import('./pages/CalendarPage.vue') },
    { path: '/entri/:date', component: () => import('./pages/EntryPage.vue'), props: true },
    { path: '/pelajaran', component: () => import('./pages/CollectionPage.vue'), props: { kind: 'lessons' } },
    { path: '/hal-baik', component: () => import('./pages/CollectionPage.vue'), props: { kind: 'good-things' } },
    { path: '/cari', component: () => import('./pages/SearchPage.vue') },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

createApp(App).use(router).mount('#app')
