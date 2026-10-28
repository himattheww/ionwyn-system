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
  { to: '/beban', label: 'Beban' },
  { to: '/sinkron', label: 'Sinkron' },
  { to: '/pengaturan', label: 'Pengaturan' },
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
  <nav class="subnav" aria-label="Halaman Fitness">
    <RouterLink v-for="link in links" :key="link.to" v-slot="{ href, navigate, isActive, isExactActive }" :to="link.to" custom>
      <a :href="href" :aria-current="(link.to === '/' ? isExactActive : isActive) ? 'page' : undefined" @click="navigate">{{ link.label }}</a>
    </RouterLink>
    <span class="subnav-sync">
      <RouterLink v-if="sync?.running" to="/sinkron" class="sync-status running"><span class="spinner" /> Sinkron berjalan</RouterLink>
      <RouterLink v-else-if="failed" to="/sinkron" class="sync-status warn">{{ sync?.last_error?.startsWith('Perlu login ulang') ? 'Perlu login ulang' : 'Sinkron gagal' }}</RouterLink>
      <RouterLink v-else-if="sync?.last_success_at" to="/sinkron" class="sync-status"><i class="sync-dot" />Garmin · {{ formatDateTime(sync.last_success_at) }}</RouterLink>
      <button class="sync-now" :disabled="!sync || sync.running" @click="start">Sinkron</button>
    </span>
  </nav>
  <main class="container">
    <RouterView :key="`${$route.fullPath}-${version}`" />
  </main>
</template>
