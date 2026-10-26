<script setup lang="ts">
import { computed } from 'vue';
import { useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import { activityLabel, formatDay, formatNumber, formatTime } from '../lib/format';
import type { ActivityDetail, LapRow } from '../types';

const props = defineProps<{ id: string }>();
const { data, loading, error, load } = useApi<ActivityDetail>(() => `/activities/${props.id}`);

const activity = computed(() => data.value?.activity ?? null);
const laps = computed(() => data.value?.laps ?? null);
const workout = computed(() => laps.value?.some((r) => r.stepType) ?? false);
const weight = computed(() => data.value?.weightKg ?? null);

const dash = '--';
const round = (value: number | null, digits = 0) => (value == null ? dash : formatNumber(value, digits));
const clock = (seconds: number | null) => {
  if (seconds == null) return dash;
  const tenths = Math.round(seconds * 10) / 10;
  const h = Math.floor(tenths / 3600);
  const m = Math.floor((tenths % 3600) / 60);
  const s = tenths % 60;
  const sec = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(1).padStart(4, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const pace = (speed: number | null) => {
  if (!speed) return dash;
  const total = Math.round(1000 / speed);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const perKg = (watts: number | null) => (watts == null || !weight.value ? dash : formatNumber(watts / weight.value, 2));

const columns: { label: string; value: (r: LapRow) => string }[] = [
  { label: 'Time', value: (r) => clock(r.duration_sec) },
  { label: 'Cumulative Time', value: (r) => clock(r.cumulative_sec) },
  { label: 'Distance km', value: (r) => formatNumber(r.distance_m / 1000, 2) },
  { label: 'Avg Pace', value: (r) => pace(r.speed) },
  { label: 'Avg GAP', value: (r) => pace(r.gap_speed) },
  { label: 'Avg HR', value: (r) => round(r.avg_hr) },
  { label: 'Max HR', value: (r) => round(r.max_hr) },
  { label: 'Total Ascent m', value: (r) => round(r.ascent_m) },
  { label: 'Total Descent m', value: (r) => round(r.descent_m) },
  { label: 'Avg Run Cadence', value: (r) => round(r.cadence) },
  { label: 'Avg GCT ms', value: (r) => round(r.gct_ms) },
  { label: 'Avg Stride Length m', value: (r) => round(r.stride_m, 2) },
  { label: 'Avg Vertical Oscillation cm', value: (r) => round(r.vo_cm, 1) },
  { label: 'Avg Vertical Ratio %', value: (r) => round(r.vr_pct, 1) },
  { label: 'NP', value: (r) => round(r.np) },
  { label: 'Avg Power W', value: (r) => round(r.power) },
  { label: 'Avg W/kg', value: (r) => perKg(r.power) },
  { label: 'Max Power W', value: (r) => round(r.max_power) },
  { label: 'Max W/kg', value: (r) => perKg(r.max_power) },
  { label: 'Calories', value: (r) => round(r.calories) },
  { label: 'Best Pace', value: (r) => pace(r.max_speed) },
  { label: 'Max Run Cadence', value: (r) => round(r.max_cadence) },
  { label: 'Moving Time', value: (r) => clock(r.moving_sec) },
  { label: 'Avg Moving Pace', value: (r) => (r.moving_sec ? pace(r.distance_m / r.moving_sec) : dash) },
];

function download() {
  const head = [...(workout.value ? ['Interval', 'Step Type'] : []), 'Lap', ...columns.map((c) => c.label)];
  const lines = (laps.value ?? []).map((r) => [...(workout.value ? [r.interval ?? '', r.stepType ?? '--'] : []), r.label, ...columns.map((c) => c.value(r))]);
  const csv = [head, ...lines].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = `activity_${props.id}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'activities' }" class="back">← Aktivitas</RouterLink>
    <StateView :loading="loading" :error="error" :empty="!activity" empty-text="Aktivitas tidak ditemukan." @retry="load">
      <template v-if="activity">
        <div class="page-head">
          <div>
            <div class="kicker">{{ formatDay(activity.date) }} · {{ formatTime(activity.start_time) }} · {{ activityLabel(activity.type) }}</div>
            <h1 class="activity-title">{{ activity.name ?? activityLabel(activity.type) }}</h1>
          </div>
          <button v-if="laps?.length" class="secondary" @click="download">Unduh CSV</button>
        </div>

        <p v-if="!laps" class="notice">
          Lap belum diambil dari Garmin. Lap diambil otomatis saat sinkron berikutnya, mulai dari lari terbaru.
        </p>
        <p v-else-if="!laps.length" class="notice">Garmin tidak mengirim data lap untuk aktivitas ini.</p>

        <div v-else class="card flush">
          <div class="table-wrap">
            <table class="laps">
              <thead>
                <tr>
                  <template v-if="workout"><th>Interval</th><th>Step Type</th></template>
                  <th>Lap</th>
                  <th v-for="c in columns" :key="c.label">{{ c.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in laps" :key="i" :class="r.kind">
                  <template v-if="workout">
                    <td>{{ r.interval ?? '' }}</td>
                    <td>{{ r.stepType ?? dash }}</td>
                  </template>
                  <td class="lap-label">{{ r.label }}</td>
                  <td v-for="c in columns" :key="c.label">{{ c.value(r) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p v-if="laps?.length && !weight" class="muted">W/kg kosong karena belum ada berat badan. Isi di halaman Catat.</p>
      </template>
    </StateView>
  </section>
</template>

<style scoped src="../styles/activity.css"></style>
