<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import { activityLabel, formatDay, formatDuration, formatMinutes, formatMonth, formatNumber, formatPace, today } from '../lib/format';

type Totals = {
  activities: number;
  activeDays: number;
  durationSec: number;
  calories: number;
  runKm: number;
  sleepAvgMin: number | null;
  rhrAvg: number | null;
};

type Report = {
  month: string;
  start: string;
  end: string;
  complete: boolean;
  totals: Totals;
  previous: Totals;
  byType: { type: string; count: number; durationSec: number; distanceKm: number; calories: number }[];
  running: {
    count: number;
    longest: { date: string; km: number } | null;
    fastest: { date: string; km: number; paceSecPerKm: number } | null;
    planned: number;
    plannedDone: number;
  };
  strengthSessions: number;
  sleepScoreAvg: number | null;
  weight: { first: number; last: number; change: number; entries: number } | null;
  meals: { filled: number; proteinDays: number; riceAvg: number | null };
  conditions: { alcoholDays: number; sickDays: number };
};

const route = useRoute();
const router = useRouter();
const month = computed(() => (typeof route.query.bulan === 'string' ? route.query.bulan : today().slice(0, 7)));
const { data, loading, error, load } = useApi<{ months: string[]; report: Report }>(() => `/report?month=${month.value}`);

const report = computed(() => data.value?.report);
const months = computed(() => {
  const list = new Set(data.value?.months ?? []);
  list.add(month.value);
  return [...list].sort().reverse();
});
const adherence = computed(() => {
  const r = report.value?.running;
  return r?.planned ? Math.round((r.plannedDone / r.planned) * 100) : null;
});

function changeMonth(value: string) {
  router.push({ name: 'report', query: { bulan: value } });
}

function delta(current: number | null, previous: number | null, unit = '', digits = 1) {
  if (current == null || previous == null || !previous) return '';
  const diff = current - previous;
  if (Math.abs(diff) < 10 ** -digits) return 'sama dengan bulan lalu';
  return `${diff > 0 ? '+' : ''}${formatNumber(diff, digits)}${unit} dari bulan lalu`;
}
</script>

<template>
  <section>
    <div>
      <div class="kicker">Laporan bulanan</div>
      <h1>Laporan</h1>
    </div>

    <label class="inline-field">
      Bulan
      <select :value="month" @change="changeMonth(($event.target as HTMLSelectElement).value)">
        <option v-for="m in months" :key="m" :value="m">{{ formatMonth(m) }}</option>
      </select>
    </label>

    <StateView
      :loading="loading"
      :error="error"
      :empty="!!report && !report.totals.activities && !report.weight && !report.meals.filled && report.totals.sleepAvgMin == null"
      empty-text="Belum ada data di bulan ini."
      @retry="load"
    >
      <template v-if="report">
        <p class="muted">
          {{ formatDay(report.start) }} – {{ formatDay(report.end) }}
          <span v-if="!report.complete" class="badge warn">bulan berjalan</span>
        </p>

        <div class="stats">
          <div class="stat">
            <span class="stat-label">Aktivitas</span>
            <span class="stat-value">{{ report.totals.activities }} sesi</span>
            <span class="muted">{{ report.totals.activeDays }} hari aktif · {{ delta(report.totals.activities, report.previous.activities, '', 0) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Total durasi</span>
            <span class="stat-value">{{ formatDuration(report.totals.durationSec) }}</span>
            <span class="muted">{{ delta(report.totals.durationSec / 3600, report.previous.durationSec / 3600, ' jam') }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Kalori aktivitas</span>
            <span class="stat-value">{{ formatNumber(report.totals.calories, 0) }} kkal</span>
            <span class="muted">{{ delta(report.totals.calories, report.previous.calories, ' kkal', 0) }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Total lari</span>
            <span class="stat-value">{{ formatNumber(report.totals.runKm, 1) }} km</span>
            <span class="muted">{{ delta(report.totals.runKm, report.previous.runKm, ' km') }}</span>
          </div>
        </div>

        <div class="card">
          <h2>Yang sudah dilakukan</h2>
          <p v-if="!report.byType.length" class="state">Belum ada aktivitas.</p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th>Sesi</th>
                  <th>Durasi</th>
                  <th>Jarak</th>
                  <th>Kalori</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in report.byType" :key="t.type">
                  <td>{{ activityLabel(t.type) }}</td>
                  <td>{{ t.count }}</td>
                  <td>{{ formatDuration(t.durationSec) }}</td>
                  <td>{{ t.distanceKm ? `${formatNumber(t.distanceKm, 1)} km` : '-' }}</td>
                  <td>{{ formatNumber(t.calories, 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="report.strengthSessions" class="muted">Termasuk {{ report.strengthSessions }} sesi latihan beban.</p>
        </div>

        <div class="grid-2">
          <div class="card">
            <h2>Lari</h2>
            <dl class="details">
              <dt>Jadwal terpenuhi</dt>
              <dd>{{ report.running.plannedDone }}/{{ report.running.planned }} <template v-if="adherence != null">({{ adherence }}%)</template></dd>
              <dt>Long run terjauh</dt>
              <dd>{{ report.running.longest ? `${formatNumber(report.running.longest.km, 2)} km · ${formatDay(report.running.longest.date)}` : '-' }}</dd>
              <dt>Pace tercepat (≥ 3 km)</dt>
              <dd>
                {{ report.running.fastest ? `${formatPace(report.running.fastest.paceSecPerKm)} · ${formatNumber(report.running.fastest.km, 1)} km · ${formatDay(report.running.fastest.date)}` : '-' }}
              </dd>
            </dl>
          </div>

          <div class="card">
            <h2>Recovery</h2>
            <dl class="details">
              <dt>Tidur rata-rata</dt>
              <dd>{{ formatMinutes(report.totals.sleepAvgMin) }} <span class="muted">{{ delta(report.totals.sleepAvgMin, report.previous.sleepAvgMin, ' mnt', 0) }}</span></dd>
              <dt>Skor tidur</dt>
              <dd>{{ formatNumber(report.sleepScoreAvg, 0) }}</dd>
              <dt>RHR rata-rata</dt>
              <dd>{{ formatNumber(report.totals.rhrAvg) }} bpm <span class="muted">{{ delta(report.totals.rhrAvg, report.previous.rhrAvg, ' bpm') }}</span></dd>
            </dl>
          </div>

          <div class="card">
            <h2>Berat badan</h2>
            <dl v-if="report.weight" class="details">
              <dt>Awal → akhir</dt>
              <dd>{{ formatNumber(report.weight.first) }} → {{ formatNumber(report.weight.last) }} kg</dd>
              <dt>Perubahan</dt>
              <dd>{{ report.weight.change > 0 ? '+' : '' }}{{ formatNumber(report.weight.change) }} kg ({{ report.weight.entries }} kali timbang)</dd>
            </dl>
            <p v-else class="muted">Belum ada data berat bulan ini.</p>
          </div>

          <div class="card">
            <h2>Makan &amp; kondisi</h2>
            <dl class="details">
              <dt>Protein tercapai</dt>
              <dd>{{ report.meals.proteinDays }}/{{ report.meals.filled }} hari diisi</dd>
              <dt>Nasi rata-rata</dt>
              <dd>{{ formatNumber(report.meals.riceAvg) }} porsi</dd>
              <dt>Minum alkohol</dt>
              <dd>{{ report.conditions.alcoholDays }} hari</dd>
              <dt>Sakit</dt>
              <dd>{{ report.conditions.sickDays }} hari</dd>
            </dl>
          </div>
        </div>
      </template>
    </StateView>
  </section>
</template>

<style scoped src="../styles/report.css"></style>
