<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { api, useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import SyncNotice from '../components/SyncNotice.vue';
import { formatDateTime } from '../lib/format';
import type { SyncStatus } from '../types';

const { data, loading, error, load } = useApi<SyncStatus>(() => '/sync');
const startError = ref<string | null>(null);
const syncing = ref(false);
const online = computed(() => data.value?.local === false);
const connected = computed(() => !!data.value?.garmin?.connected);
const inApp = navigator.userAgent.includes('IonwynApp');
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
  syncing.value = true;
  try {
    data.value = await api<SyncStatus>('/sync', { method: 'POST' });
  } catch (e) {
    startError.value = (e as Error).message;
  } finally {
    syncing.value = false;
  }
}
</script>

<template>
  <section>
    <div>
      <div class="kicker">Garmin Connect</div>
      <h1>Sinkron</h1>
    </div>
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
          <button :disabled="data.running || syncing || (online && !connected)" @click="start">
            {{ data.running || syncing ? 'Sedang sinkron...' : 'Sinkron sekarang' }}
          </button>
          <p v-if="startError" class="toast toast-error">{{ startError }}</p>
        </div>

        <div v-if="online" class="card">
          <h2>{{ connected ? 'Garmin terhubung' : 'Hubungkan Garmin' }}</h2>
          <p class="muted">
            Versi online mengambil data Garmin sendiri tiap 3 jam. Kalau sesi Garmin habis, hubungkan lagi lewat login Garmin di aplikasi
            Android Ionwyn.
          </p>
          <a v-if="inApp" class="btn" href="ionwyn://garmin" target="_top">{{ connected ? 'Hubungkan ulang' : 'Login Garmin' }}</a>
          <p v-else class="muted">Buka halaman ini dari aplikasi Android Ionwyn untuk login Garmin.</p>
        </div>
      </template>
    </StateView>

    <div v-if="data?.local !== false" class="card">
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
