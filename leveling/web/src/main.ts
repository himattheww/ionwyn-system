import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/app.css'
import AchievementsPage from './pages/AchievementsPage.vue'
import CharacterPage from './pages/CharacterPage.vue'
import HistoryPage from './pages/HistoryPage.vue'
import SourcesPage from './pages/SourcesPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: CharacterPage },
    { path: '/riwayat', component: HistoryPage },
    { path: '/log', redirect: '/riwayat' },
    { path: '/achievement', component: AchievementsPage },
    { path: '/cita-cita', component: () => import('./pages/WishesPage.vue') },
    { path: '/sumber', component: SourcesPage }
  ]
})

createApp(App).use(router).mount('#app')
