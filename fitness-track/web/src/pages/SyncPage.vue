<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { api, useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import SyncNotice from '../components/SyncNotice.vue';
import { formatDateTime } from '../lib/format';
import type { SyncStatus } from '../types';

const { data, loading, error, load } = useApi<SyncStatus>(() => '/sync');
const startError = ref<string | null>(null);
let timer: ReturnType<typeof setInterval> | undefined;

watch(
  () => data.value?.running,
  (running) => {
    clearInterval(timer);
    if (running) timer = setInterval(refresh, 3000);
  },
);
onUnmounted(() => clearInterval(timer));

async function refresh() {
  try {
    data.value = await api<SyncStatus>('/sync');
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function start() {
  startError.value = null;
  try {
    data.value = await api<SyncStatus>('/sync', { method: 'POST' });
  } catch (e) {
    startError.value = (e as Error).message;
  }
}
</script>

<template>
  <section>
    <h1>Sinkron Garmin</h1>
    <StateView :loading="loading" :error="error" @retry="load">
      <template v-if="data">
        <SyncNotice :status="data" />
        <div class="card">
          <dl class="details">
            <dt>Sukses terakhir</dt>
            <dd>{{ formatDateTime(data.last_success_at) }}</dd>
            <dt>Error terakhir</dt>
            <dd>{{ data.last_error_at ? `${formatDateTime(data.last_error_at)} — ${data.last_error}` : '-' }}</dd>
          </dl>
          <button :disabled="data.running" @click="start">{{ data.running ? 'Sedang sinkron...' : 'Sinkron sekarang' }}</button>
          <p v-if="startError" class="toast toast-error">{{ startError }}</p>
        </div>
      </template>
    </StateView>

    <div class="card">
      <h2>Login ulang Garmin</h2>
      <ol class="steps">
        <li>Kalau sinkron sedang berjalan, tunggu sampai selesai.</li>
        <li>Di folder project, jalankan <code>npm run garmin:login</code>.</li>
        <li>Login di jendela browser yang terbuka, termasuk MFA.</li>
        <li>Setelah dashboard Garmin tampil, tekan Enter di terminal.</li>
        <li>Kembali ke sini dan tekan "Sinkron sekarang".</li>
      </ol>
      <p class="muted">
        Kalau sinkron terus gagal walau sudah login, coba set <code>GARMIN_HEADLESS=false</code> di <code>.env</code> lalu restart server.
      </p>
    </div>
  </section>
</template>
