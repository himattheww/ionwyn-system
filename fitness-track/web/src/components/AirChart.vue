<script setup lang="ts">
import { computed } from 'vue';
import { useApi } from '../lib/api';

type Hour = { time: string; pm25: number | null; aqi: number | null };
const air = useApi<{ location: { from: string }; hours: Hour[]; station: { aqi: number; pm25: number; name: string | null } | null }>(() => '/air');

const now = new Date();
const nowKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
  .format(now)
  .replace(' ', 'T')
  .slice(0, 13);

const hoursAround = computed(() => {
  const hours = air.data.value?.hours ?? [];
  const index = Math.max(0, hours.findIndex((h) => h.time.startsWith(nowKey)));
  return hours.slice(Math.max(0, index - 12), index + 13).map((h) => ({ ...h, now: h.time.startsWith(nowKey) }));
});
const current = computed(() => hoursAround.value.find((h) => h.now) ?? null);
const max = computed(() => Math.max(200, ...hoursAround.value.map((h) => h.aqi ?? 0)));

const band = (aqi: number) =>
  aqi <= 50 ? 'good' : aqi <= 100 ? 'moderate' : aqi <= 150 ? 'sensitive' : aqi <= 200 ? 'unhealthy' : aqi <= 300 ? 'very' : 'hazard';
const label: Record<string, string> = {
  good: 'baik',
  moderate: 'sedang',
  sensitive: 'tidak sehat bagi sensitif',
  unhealthy: 'tidak sehat',
  very: 'sangat tidak sehat',
  hazard: 'berbahaya',
};
const best = computed(() => {
  const ahead = hoursAround.value.filter((h) => !h.now && h.time > (current.value?.time ?? '') && h.aqi != null);
  return ahead.sort((a, b) => a.aqi! - b.aqi!)[0] ?? null;
});
</script>

<template>
  <div class="card air">
    <div class="block-head">
      <h2 class="m-0">Udara per jam</h2>
      <span class="muted">{{ air.data.value ? `lokasi ${air.data.value.location.from}` : '' }}</span>
    </div>
    <p v-if="air.loading.value" class="muted">Memuat AQI…</p>
    <p v-else-if="air.error.value" class="muted">AQI belum bisa diambil: {{ air.error.value }}</p>
    <template v-else>
      <div class="air-now">
        <div v-if="air.data.value?.station">
          <span class="label-sm">Stasiun sekarang</span>
          <strong :class="['air-value', band(air.data.value.station.aqi)]">{{ air.data.value.station.aqi }}</strong>
          <span class="muted">{{ label[band(air.data.value.station.aqi)] }}{{ air.data.value.station.name ? ` · ${air.data.value.station.name}` : '' }}</span>
        </div>
        <div v-if="current?.aqi != null">
          <span class="label-sm">Model jam ini</span>
          <strong :class="['air-value', band(current.aqi)]">{{ current.aqi }}</strong>
          <span class="muted">{{ label[band(current.aqi)] }} · PM2.5 {{ current.pm25 }}</span>
        </div>
        <div v-if="best">
          <span class="label-sm">Paling bersih 12 jam ke depan</span>
          <strong :class="['air-value', band(best.aqi!)]">{{ best.time.slice(11, 16) }}</strong>
          <span class="muted">AQI {{ best.aqi }}</span>
        </div>
      </div>
      <div class="air-bars" role="img" aria-label="AQI per jam, 12 jam ke belakang sampai 12 jam ke depan">
        <div v-for="h in hoursAround" :key="h.time" :class="['air-bar', { now: h.now }]" :title="`${h.time.slice(11, 16)} · AQI ${h.aqi ?? '-'} · PM2.5 ${h.pm25 ?? '-'}`">
          <i v-if="h.aqi != null" :class="band(h.aqi)" :style="{ height: `${(h.aqi / max) * 100}%` }" />
          <span>{{ h.time.slice(11, 13) }}</span>
        </div>
      </div>
      <p class="muted small">AQI dari PM2.5 per jam (model Open-Meteo, tabel EPA 2024). Garis terang = jam sekarang.</p>
    </template>
  </div>
</template>

<style scoped src="../styles/air-chart.css"></style>
