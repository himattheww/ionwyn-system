<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { isOffline } from '@/lib/offlineCache'
import { pendingItems } from '@/lib/pending'

const router = useRouter()
const route = useRoute()
const { logout } = useAuth()

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transaksi' },
  { to: '/charts', label: 'Charts' },
  { to: '/goals', label: 'Goals' },
  { to: '/budget', label: 'Budget' },
  { to: '/profile', label: 'Profil' },
]

const offlineText = computed(() => {
  const parts: string[] = []
  if (isOffline.value) parts.push('Offline, menampilkan data terakhir')
  if (pendingItems.value.length) parts.push(`${pendingItems.value.length} transaksi pending`)
  return parts.join(' · ')
})

async function handleLogout() {
  await logout()
  router.push('/auth/login')
}
</script>

<template>
  <div class="app-shell">
    <nav class="subnav" aria-label="Halaman Keuangan">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :aria-current="route.path.startsWith(item.to) ? 'page' : undefined"
      >
        {{ item.label }}
      </RouterLink>
      <button class="subnav-out" @click="handleLogout">Keluar</button>
    </nav>
    <main class="main-content">
      <div v-if="offlineText" class="offline-bar">{{ offlineText }}</div>
      <RouterView />
    </main>
  </div>
</template>
<style scoped src="../styles/views/app-layout.css"></style>
