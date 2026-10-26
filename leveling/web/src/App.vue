<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { api, refreshEvent } from './lib/api.ts'

interface Toast {
  id: number
  lines: string[]
}

const links = [
  { to: '/', label: 'Karakter' },
  { to: '/riwayat', label: 'Riwayat' },
  { to: '/log', label: 'Log exp' },
  { to: '/achievement', label: 'Achievement' },
  { to: '/cita-cita', label: 'Cita-cita' },
  { to: '/sumber', label: 'Sumber' },
]

const toasts = ref<Toast[]>([])
let lastId: number | null = null
let timer: ReturnType<typeof setInterval>

async function pollNotifications() {
  try {
    const result = await api<{ lastId: number; items: Toast[] }>(lastId === null ? '/notifications' : `/notifications?after=${lastId}`)
    lastId = result.lastId
    for (const item of result.items) {
      toasts.value.push(item)
      setTimeout(() => dismiss(item.id), 10_000)
    }
  } catch {
    return
  }
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

onMounted(() => {
  pollNotifications()
  timer = setInterval(pollNotifications, 15_000)
  window.addEventListener(refreshEvent, pollNotifications)
})
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener(refreshEvent, pollNotifications)
})
</script>

<template>
  <nav class="subnav" aria-label="Halaman Leveling">
    <RouterLink v-for="link in links" :key="link.to" v-slot="{ href, navigate, isExactActive }" :to="link.to" custom>
      <a :href="href" :aria-current="isExactActive ? 'page' : undefined" @click="navigate">{{ link.label }}</a>
    </RouterLink>
  </nav>
  <main class="page">
    <RouterView />
  </main>
  <div class="toasts">
    <div v-for="toast in toasts" :key="toast.id" class="card elev-lg toast" @click="dismiss(toast.id)">
      <span class="card-kicker">Perubahan karakter</span>
      <span v-for="line in toast.lines" :key="line" class="toast-line">{{ line }}</span>
      <span class="card-meta">Klik untuk menutup</span>
    </div>
  </div>
</template>
