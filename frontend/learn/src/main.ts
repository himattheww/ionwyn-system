import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './styles/app.css'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: () => import('./views/TrackList.vue') },
    { path: '/tracks/new', component: () => import('./views/TrackNew.vue') },
    { path: '/tracks/:id', component: () => import('./views/TrackDetail.vue'), props: true },
    { path: '/topics/:id', component: () => import('./views/TopicDetail.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

createApp(App).use(router).mount('#app')
