<script setup lang="ts">
import { computed } from 'vue';
import { useApi } from '../lib/api';
import Sparkline from '../components/Sparkline.vue';
import StateView from '../components/StateView.vue';
import SyncNotice from '../components/SyncNotice.vue';
import {
  activityLabel,
  addDays,
  dayOfMonth,
  formatDay,
  formatDuration,
  formatLong,
  formatMinutes,
  formatMonth,
  formatNumber,
  formatPace,
  formatShort,
  formatWeekdayShort,
  isoWeek,
  today,
} from '../lib/format';
import type { Activity, Condition, Meal, Recovery, SyncStatus } from '../types';

type RunDay = { date: string; plan: string | null; done: boolean; km: number };
type Summary = {
  today: string;
  week: { start: string; end: string };
  runDays: RunDay[];
  runKm: number;
  strengthSessions: number;
  sleepAvg7: number | null;
  rhrAvg7: number | null;
  weightAvg7: number | null;
  weightAvgPrev7: number | null;
  proteinDays: number;
  riceAvg: number | null;
  mealDays: number;
  sync: SyncStatus;
};

const { data, loading, error, load } = useApi<Summary>(() => '/summary');
const lastWeek = useApi<Summary>(() => `/summary?date=${addDays(today(), -7)}`);
const recovery = useApi<{ recovery: Recovery[]; conditions: Condition[] }>(() => '/recovery?days=7');
const weights = useApi<{ weights: { date: string; kg: number }[] }>(() => '/weights');
const meals = useApi<Meal[]>(() => '/meals');
const activities = useApi<{ activities: Activity[] }>(() => '/activities');

function status(day: RunDay, todayDate: string) {
  if (day.done) return day.plan ? 'done' : 'extra';
  if (!day.plan) return day.date === todayDate ? 'today-rest' : 'rest';
  return day.date >= todayDate ? 'upcoming' : 'missed';
}

const days = computed(() => {
  const s = data.value;
  if (!s) return [];
  return s.runDays.map((d) => {
    const st = status(d, s.today);
    const result =
      st === 'done' || st === 'extra' ? `${formatNumber(d.km, 2)} km` : st === 'missed' ? 'tidak lari' : st === 'upcoming' ? 'belum' : '—';
    return {
      ...d,
      st,
      isToday: d.date === s.today,
      weekday: formatWeekdayShort(d.date),
      day: dayOfMonth(d.date),
      label: d.plan ?? (d.done ? 'lari tambahan' : d.date === s.today ? 'Hari ini' : 'Istirahat'),
      result,
    };
  });
});

const lastDays = computed(() =>
  (lastWeek.data.value?.runDays ?? []).map((d) => {
    const st = status(d, '9999-12-31');
    return {
      date: d.date,
      st: st === 'upcoming' ? 'missed' : st,
      weekday: formatWeekdayShort(d.date),
      value: d.done ? `${formatNumber(d.km, 1)} km` : d.plan ? '✕' : '—',
      title: `${formatDay(d.date)}: ${d.plan ?? 'tanpa jadwal'}${d.done ? ` · ${formatNumber(d.km, 2)} km` : ''}`,
    };
  }),
);

const adherence = (runDays: RunDay[] = []) => {
  const planned = runDays.filter((d) => d.plan);
  return `${planned.filter((d) => d.done).length}/${planned.length}`;
};

const weightDiff = computed(() => {
  const s = data.value;
  if (s?.weightAvg7 == null || s.weightAvgPrev7 == null) return null;
  return Math.round((s.weightAvg7 - s.weightAvgPrev7) * 10) / 10;
});

const checklist = computed(() => {
  const t = data.value?.today ?? today();
  const rec = recovery.data.value?.recovery.find((r) => r.date === t);
  const cond = recovery.data.value?.conditions.find((c) => c.date === t);
  const w = weights.data.value?.weights.find((x) => x.date === t);
  const m = meals.data.value?.find((x) => x.date === t);
  return [
    {
      label: 'Tidur & RHR',
      source: rec?.source === 'manual' ? 'Isi manual' : 'Garmin · sinkron otomatis',
      value: rec ? `${formatMinutes(rec.sleep_min)} · ${rec.rhr ?? '-'} bpm` : 'belum masuk',
      ok: !!rec,
    },
    { label: 'Berat badan', source: 'Manual', value: w ? `${formatNumber(w.kg)} kg` : 'belum', ok: !!w },
    {
      label: 'Makan',
      source: 'Protein & porsi nasi',
      value: m ? `${m.protein_met ? 'protein ✓' : 'protein kurang'} · ${formatNumber(m.rice_portions)} nasi` : 'belum',
      ok: !!m,
    },
    {
      label: 'Kondisi',
      source: 'Alkohol, sakit, catatan',
      value: cond ? [cond.alcohol && 'alkohol', cond.sick && 'sakit'].filter(Boolean).join(', ') || 'normal' : 'belum',
      ok: !!cond,
    },
  ];
});
const remaining = computed(() => checklist.value.filter((c) => !c.ok).length);

const last7 = computed(() => {
  const t = data.value?.today ?? today();
  return Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
});
const sparks = computed(() => {
  const rec = new Map((recovery.data.value?.recovery ?? []).map((r) => [r.date, r]));
  const wt = new Map((weights.data.value?.weights ?? []).map((w) => [w.date, w.kg]));
  const ml = new Map((meals.data.value ?? []).map((m) => [m.date, m.protein_met]));
  return {
    sleep: last7.value.map((d) => rec.get(d)?.sleep_min ?? null),
    rhr: last7.value.map((d) => rec.get(d)?.rhr ?? null),
    weight: last7.value.map((d) => wt.get(d) ?? null),
    protein: last7.value.map((d) => (ml.has(d) ? Number(ml.get(d)) : null)),
  };
});

const recent = computed(() => activities.data.value?.activities.slice(0, 5) ?? []);

const syncFailed = computed(() => {
  const s = data.value?.sync;
  return !!s?.last_error_at && (!s.last_success_at || s.last_error_at > s.last_success_at);
});

const reportBanner = computed(() => {
  const todayDate = data.value?.today;
  if (!todayDate) return null;
  const day = Number(todayDate.slice(8));
  if (day <= 3) {
    const month = addDays(`${todayDate.slice(0, 7)}-01`, -1).slice(0, 7);
    return { month, text: `Laporan ${formatMonth(month)} sudah siap.` };
  }
  const [year, month] = todayDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day >= lastDay - 2) {
    const current = todayDate.slice(0, 7);
    return { month: current, text: `${formatMonth(current)} hampir selesai. Lihat rangkuman bulan ini.` };
  }
  return null;
});
</script>

<template>
  <section>
    <StateView :loading="loading" :error="error" @retry="load">
      <template v-if="data">
        <div class="page-head">
          <div>
            <div class="kicker">Minggu {{ isoWeek(data.today) }} · {{ formatShort(data.week.start) }} – {{ formatShort(data.week.end) }}</div>
            <h1>Minggu ini</h1>
          </div>
          <span class="muted">{{ formatLong(data.today) }}</span>
        </div>

        <SyncNotice v-if="syncFailed" :status="data.sync" />

        <RouterLink v-if="reportBanner" :to="{ name: 'report', query: { bulan: reportBanner.month } }" class="notice">
          {{ reportBanner.text }}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </RouterLink>

        <div class="block">
          <div class="block-head">
            <h3>01 — Pola lari</h3>
            <div class="meta">
              <span>Jadwal <strong>{{ adherence(data.runDays) }}</strong></span>
              <span>Total <strong>{{ formatNumber(data.runKm, 2) }} km</strong></span>
              <span v-if="data.strengthSessions">Beban <strong>{{ data.strengthSessions }} sesi</strong></span>
            </div>
          </div>
          <div class="week-scroll">
            <div class="week-inner">
              <div class="week-grid">
                <div v-for="d in days" :key="d.date" :class="['bp', 'day-cell', d.st, { today: d.isToday, rest: d.st === 'rest' || d.st === 'today-rest' }]">
                  <div class="day-head"><span>{{ d.weekday }}</span><span>{{ d.day }}</span></div>
                  <div class="day-plan">{{ d.label }}</div>
                  <div class="day-result">
                    <svg v-if="d.done" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    <svg v-else-if="d.st === 'missed'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    {{ d.result }}
                  </div>
                </div>
              </div>
              <template v-if="lastDays.length">
                <div class="lw-head label-sm">
                  <span>Minggu lalu · {{ formatShort(lastWeek.data.value!.week.start) }} – {{ formatShort(lastWeek.data.value!.week.end) }}</span>
                  <span>{{ adherence(lastWeek.data.value!.runDays) }} jadwal · {{ formatNumber(lastWeek.data.value!.runKm, 1) }} km</span>
                </div>
                <div class="week-grid">
                  <div v-for="d in lastDays" :key="d.date" :class="['lw-cell', d.st]" :title="d.title">
                    <span>{{ d.weekday }}</span><span>{{ d.value }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <span class="muted">Pola lari diatur di <RouterLink to="/pengaturan">Pengaturan</RouterLink>.</span>
        </div>

        <div class="split">
          <div class="block">
            <h3>02 — Hari ini</h3>
            <div class="card checklist">
              <div v-for="c in checklist" :key="c.label" :class="['check-row', { ok: c.ok }]">
                <span :class="['check-box', { ok: c.ok }]">
                  <svg v-if="c.ok" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <div>
                  <div class="check-label">{{ c.label }}</div>
                  <div class="check-source">{{ c.source }}</div>
                </div>
                <span class="check-value">{{ c.value }}</span>
              </div>
              <div class="check-foot">
                <span>{{ remaining ? `${remaining} dari 4 belum dicatat` : 'Semua sudah tercatat hari ini.' }}</span>
                <RouterLink to="/catat" class="btn">Catat hari ini</RouterLink>
              </div>
            </div>
          </div>

          <div class="block">
            <h3>03 — Rata-rata 7 hari</h3>
            <div class="metrics">
              <div class="card metric">
                <span class="kicker">Tidur</span>
                <span class="figure">{{ formatMinutes(data.sleepAvg7) }}</span>
                <Sparkline :values="sparks.sleep" />
                <span class="note">Garmin · 7 malam</span>
              </div>
              <div class="card metric">
                <span class="kicker">RHR</span>
                <span class="figure">{{ formatNumber(data.rhrAvg7) }}<small>bpm</small></span>
                <Sparkline :values="sparks.rhr" />
                <span class="note">Garmin · 7 hari</span>
              </div>
              <div class="card metric">
                <span class="kicker">Berat</span>
                <span class="figure">{{ formatNumber(data.weightAvg7) }}<small>kg</small></span>
                <Sparkline :values="sparks.weight" />
                <span class="note">{{ weightDiff == null ? 'Belum cukup data pembanding' : `${weightDiff > 0 ? '+' : ''}${formatNumber(weightDiff)} kg dari minggu lalu` }}</span>
              </div>
              <div class="card metric">
                <span class="kicker">Protein</span>
                <span class="figure">{{ data.proteinDays }}/7<small>hari</small></span>
                <Sparkline :values="sparks.protein" />
                <span class="note">Nasi rata-rata {{ formatNumber(data.riceAvg) }} porsi ({{ data.mealDays }} hari diisi)</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="recent.length" class="block">
          <div class="block-head">
            <h3>04 — Aktivitas terakhir</h3>
            <RouterLink to="/aktivitas">Semua aktivitas</RouterLink>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>Aktivitas</th><th>Jarak</th><th>Durasi</th><th>Pace</th><th>HR</th></tr>
              </thead>
              <tbody>
                <tr v-for="a in recent" :key="a.garmin_id">
                  <td class="dim">{{ formatDay(a.date) }}</td>
                  <td><strong>{{ a.name ?? activityLabel(a.type) }}</strong> <span class="tag">{{ activityLabel(a.type) }}</span></td>
                  <td>{{ a.distance_m ? `${formatNumber(a.distance_m / 1000, 2)} km` : '-' }}</td>
                  <td>{{ formatDuration(a.duration_sec) }}</td>
                  <td>{{ a.avg_pace_sec_per_km && a.type.includes('running') ? formatPace(a.avg_pace_sec_per_km) : '-' }}</td>
                  <td>{{ a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </StateView>
  </section>
</template>
