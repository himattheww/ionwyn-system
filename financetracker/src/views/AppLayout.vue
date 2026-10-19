<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'
import { isOffline } from '@/lib/offlineCache'
import { pendingItems } from '@/lib/pending'

const router = useRouter()
const route  = useRoute()
const { displayName, profile, logout } = useAuth()
const { theme, toggle: toggleTheme } = useTheme()

const sidebarOpen = ref(true)
const drawerOpen  = ref(false)

const navItems = [
  { to: '/dashboard',    label: 'Home',       icon: ['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8', 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'] },
  { to: '/transactions', label: 'Transaksi',  icon: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 17.5v-11'] },
  { to: '/charts',       label: 'Charts',     icon: ['M3 3v16a2 2 0 0 0 2 2h16', 'M18 17V9', 'M13 17V5', 'M8 17v-3'] },
  { to: '/goals',        label: 'Goals',      icon: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z', 'M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'] },
  { to: '/budget',       label: 'Budget',     icon: ['M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z', 'M21.21 15.89A10 10 0 1 1 8 2.83'] },
  { to: '/ai',           label: 'AI Analyst', icon: ['M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z'] },
]

const bottomNavItems = [navItems[0], navItems[1], navItems[5], navItems[2], navItems[4]]

const initials = computed(() => {
  const name = displayName.value ?? ''
  return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
})

const isDark = computed(() => theme.value === 'dark' || (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))

const offlineText = computed(() => {
  const parts: string[] = []
  if (isOffline.value) parts.push('Offline, menampilkan data terakhir')
  if (pendingItems.value.length) parts.push(`${pendingItems.value.length} transaksi pending`)
  return parts.join(' · ')
})

const expanded = computed(() => sidebarOpen.value || drawerOpen.value)

async function handleLogout() {
  await logout()
  router.push('/auth/login')
}

function closeDrawer() {
  drawerOpen.value = false
}
</script>

<template>
  <div class="app-shell">
    <div v-if="drawerOpen" class="drawer-overlay" @click="closeDrawer"></div>

    <aside class="sidebar" :class="{ collapsed: !sidebarOpen, 'drawer-open': drawerOpen }">
      <div class="sidebar-top">
        <div v-if="expanded" class="brand">
          <span class="brand-name">FinTrack</span>
          <span class="brand-sub">Buku kas pribadi</span>
        </div>
        <span v-else class="brand-mark">F</span>
        <button class="icon-btn desktop-only" @click="sidebarOpen = !sidebarOpen" aria-label="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
        </button>
        <button class="icon-btn mobile-only" @click="closeDrawer" aria-label="Tutup menu">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="(item, i) in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.path.startsWith(item.to) }"
          :title="!expanded ? item.label : ''"
          @click="closeDrawer"
        >
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path v-for="d in item.icon" :key="d" :d="d"/>
          </svg>
          <span v-if="expanded" class="nav-label">{{ item.label }}</span>
          <span v-if="expanded" class="nav-num">{{ String(i + 1).padStart(2, '0') }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <RouterLink to="/profile" class="user-pill" :class="{ active: route.path === '/profile' }" :title="!expanded ? displayName : ''" @click="closeDrawer">
          <span class="avatar">{{ initials }}</span>
          <span v-if="expanded" class="user-info">
            <span class="user-name">{{ displayName }}</span>
            <span class="user-meta">{{ profile?.currency ?? 'IDR' }}</span>
          </span>
        </RouterLink>
        <div class="footer-actions" :class="{ stacked: !expanded }">
          <button class="c-btn c-btn-ghost" @click="toggleTheme" :title="!expanded ? (isDark ? 'Mode terang' : 'Mode gelap') : ''">
            <svg v-if="isDark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            <span v-if="expanded">{{ isDark ? 'Mode terang' : 'Mode gelap' }}</span>
          </button>
          <button class="c-btn c-btn-ghost" @click="handleLogout" :title="!expanded ? 'Keluar' : ''">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
            <span v-if="expanded">Keluar</span>
          </button>
        </div>
      </div>
    </aside>

    <header class="mobile-topbar">
      <button class="icon-btn" @click="drawerOpen = true" aria-label="Buka menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
      </button>
      <span class="brand-name">FinTrack</span>
      <div class="mobile-actions">
        <button class="icon-btn" @click="toggleTheme" aria-label="Toggle theme">
          <svg v-if="isDark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        </button>
        <RouterLink to="/profile" class="avatar" :class="{ active: route.path === '/profile' }">{{ initials }}</RouterLink>
      </div>
    </header>

    <main class="main-content">
      <div v-if="offlineText" class="offline-bar">{{ offlineText }}</div>
      <RouterView />
    </main>

    <nav class="bottom-nav">
      <RouterLink
        v-for="item in bottomNavItems"
        :key="item.to"
        :to="item.to"
        class="bottom-nav-item"
        :class="{ active: route.path.startsWith(item.to) }"
      >
        <svg class="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path v-for="d in item.icon" :key="d" :d="d"/>
        </svg>
        <span class="bn-label">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped src="../styles/views/app-layout.css"></style>
