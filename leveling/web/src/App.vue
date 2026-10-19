<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { api, refreshEvent } from './lib/api.ts'

interface Toast {
  id: number
  lines: string[]
}

const toasts = ref<Toast[]>([])
let lastId: number | null = null
let timer: ReturnType<typeof setInterval>

const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

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
  <div class="sheet">
    <header class="masthead">
      <div class="masthead-top">
        <RouterLink to="/" class="brand">Leveling</RouterLink>
        <nav class="nav">
          <RouterLink to="/">Karakter</RouterLink>
          <RouterLink to="/riwayat">Riwayat</RouterLink>
          <RouterLink to="/log">Log exp</RouterLink>
          <RouterLink to="/achievement">Achievement</RouterLink>
          <RouterLink to="/sumber">Sumber</RouterLink>
        </nav>
      </div>
      <div class="rule-thick" />
      <div class="dateline">
        <em>Lembar karakter satu orang · diisi dari tujuh aplikasi</em>
        <span>{{ today }}</span>
      </div>
      <div class="rule-thin" />
    </header>
    <main class="page">
      <RouterView />
    </main>
  </div>
  <div class="toasts">
    <div v-for="toast in toasts" :key="toast.id" class="card elev-lg toast" @click="dismiss(toast.id)">
      <span class="card-kicker">Perubahan karakter</span>
      <span v-for="line in toast.lines" :key="line" class="toast-line">{{ line }}</span>
      <span class="card-meta">Klik untuk menutup</span>
    </div>
  </div>
</template>
