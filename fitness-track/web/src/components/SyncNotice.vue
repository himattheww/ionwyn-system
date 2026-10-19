<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime } from '../lib/format';
import type { SyncStatus } from '../types';

const props = defineProps<{ status: SyncStatus }>();

const failed = computed(
  () => !!props.status.last_error_at && (!props.status.last_success_at || props.status.last_error_at > props.status.last_success_at),
);
const needsLogin = computed(() => failed.value && props.status.last_error?.startsWith('Perlu login ulang'));
</script>

<template>
  <div :class="['notice', { 'notice-error': failed && !status.running }]">
    <p v-if="status.running"><span class="spinner" /> Sinkron Garmin sedang berjalan...</p>
    <template v-else-if="failed">
      <div>
        <div class="kicker">Sinkron gagal · {{ formatDateTime(status.last_error_at) }}</div>
        <p><strong>{{ status.last_error }}</strong></p>
        <p v-if="needsLogin" class="muted">Isi tidur dan RHR manual di halaman Recovery sambil menunggu.</p>
      </div>
      <RouterLink v-if="needsLogin" to="/recovery" class="btn secondary">Isi manual</RouterLink>
    </template>
    <p v-else-if="status.last_success_at">Sinkron terakhir: {{ formatDateTime(status.last_success_at) }}</p>
    <p v-else>Belum pernah sinkron dengan Garmin.</p>
  </div>
</template>
