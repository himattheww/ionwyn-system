<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from './lib/api';
import { formatDateTime } from './lib/format';
import type { SyncStatus } from './types';

const links = [
  { to: '/', label: 'Minggu ini' },
  { to: '/aktivitas', label: 'Aktivitas' },
  { to: '/recovery', label: 'Recovery' },
  { to: '/catat', label: 'Catat' },
  { to: '/laporan', label: 'Laporan' },
];

const sync = ref<SyncStatus | null>(null);
const version = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

const failed = computed(() => {
  const s = sync.value;
  return !!s?.last_error_at && (!s.last_success_at || s.last_error_at > s.last_success_at);
});

async function refresh() {
  try {
    sync.value = await api<SyncStatus>('/sync');
  } catch {
    sync.value = null;
  }
}

async function start() {
  try {
    sync.value = await api<SyncStatus>('/sync', { method: 'POST' });
  } catch {
    await refresh();
  }
}

watch(
  () => sync.value?.running,
  (running, wasRunning) => {
    clearInterval(timer);
    if (running) timer = setInterval(refresh, 3000);
    else if (wasRunning) version.value++;
  },
);
onMounted(refresh);
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/" class="brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" /></svg>
        Fitness Track
      </RouterLink>
      <nav class="nav">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to" class="nav-link" :exact-active-class="link.to === '/' ? 'router-link-active' : ''" :active-class="link.to === '/' ? '' : 'router-link-active'">{{ link.label }}</RouterLink>
      </nav>
      <div class="topbar-actions">
        <RouterLink v-if="sync?.running" to="/sinkron" class="sync-status running"><span class="spinner" /> Sinkron berjalan…</RouterLink>
        <RouterLink v-else-if="failed" to="/sinkron" class="badge warn">{{ sync?.last_error?.startsWith('Perlu login ulang') ? 'Perlu login ulang' : 'Sinkron gagal' }}</RouterLink>
        <RouterLink v-else-if="sync?.last_success_at" to="/sinkron" class="sync-status">Sinkron {{ formatDateTime(sync.last_success_at) }}</RouterLink>
        <button class="secondary" :disabled="!sync || sync.running" title="Sinkron sekarang" @click="start">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
          Sinkron
        </button>
        <RouterLink to="/pengaturan" class="btn secondary btn-icon" title="Pengaturan">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
        </RouterLink>
      </div>
    </div>
  </header>
  <main class="container">
    <RouterView :key="`${$route.fullPath}-${version}`" />
  </main>
</template>
