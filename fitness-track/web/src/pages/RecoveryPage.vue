<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api, useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import TrendChart from '../components/TrendChart.vue';
import { addDays, formatDay, formatMinutes, formatNumber, formatShort, parseDecimal, today } from '../lib/format';
import type { Condition, Recovery } from '../types';

const { data, loading, error, load } = useApi<{ from: string; to: string; recovery: Recovery[]; conditions: Condition[] }>(
  () => '/recovery?days=30',
);

const days = computed(() => {
  if (!data.value) return [];
  const byDate = new Map(data.value.recovery.map((r) => [r.date, r]));
  const result = [];
  for (let d = data.value.from; d <= data.value.to; d = addDays(d, 1)) result.push({ date: d, row: byDate.get(d) });
  return result;
});
const sleepPoints = computed(() =>
  days.value.map((d) => ({ label: formatShort(d.date), value: d.row?.sleep_min != null ? Math.round((d.row.sleep_min / 60) * 10) / 10 : null })),
);
const rhrPoints = computed(() => days.value.map((d) => ({ label: formatShort(d.date), value: d.row?.rhr ?? null })));
const hasData = computed(() => !!data.value?.recovery.length);
const recentRows = computed(() => [...days.value].reverse().filter((d) => d.row));
const notes = computed(() => data.value?.conditions.filter((c) => c.alcohol || c.sick || c.injured || c.note) ?? []);

const avg = (values: (number | null | undefined)[]) => {
  const nums = values.filter((v): v is number => v != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
};
const sleepAvg = computed(() => avg(data.value?.recovery.map((r) => r.sleep_min) ?? []));
const rhrAvg = computed(() => avg(data.value?.recovery.map((r) => r.rhr) ?? []));

const manual = reactive({ date: today(), sleepHours: '', rhr: '' });
const message = ref<{ text: string; error?: boolean } | null>(null);
const saving = ref(false);

async function saveManual() {
  const hours = parseDecimal(manual.sleepHours);
  const rhr = parseDecimal(manual.rhr);
  if (hours == null && rhr == null) {
    message.value = { text: 'Isi tidur atau RHR.', error: true };
    return;
  }
  saving.value = true;
  message.value = null;
  try {
    await api(`/recovery/${manual.date}`, {
      method: 'PUT',
      body: { sleep_min: hours == null ? null : Math.round(hours * 60), rhr: rhr == null ? null : Math.round(rhr) },
    });
    message.value = { text: 'Data recovery manual tersimpan.' };
    await load();
  } catch (e) {
    message.value = { text: (e as Error).message, error: true };
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section>
    <div>
      <div class="kicker">30 hari terakhir<template v-if="data"> · {{ formatShort(data.from) }} – {{ formatShort(data.to) }}</template></div>
      <h1>Recovery</h1>
    </div>

    <StateView :loading="loading" :error="error" @retry="load">
      <div class="grid-2">
        <div class="card">
          <div class="block-head">
            <h2 class="m-0">Tidur (jam)</h2>
            <span class="muted">rata-rata <strong>{{ formatMinutes(sleepAvg == null ? null : Math.round(sleepAvg)) }}</strong></span>
          </div>
          <TrendChart v-if="hasData" :points="sleepPoints" unit="jam" />
          <p v-else class="state">Belum ada data tidur.</p>
        </div>
        <div class="card">
          <div class="block-head">
            <h2 class="m-0">RHR (bpm)</h2>
            <span class="muted">rata-rata <strong>{{ formatNumber(rhrAvg, 0) }} bpm</strong></span>
          </div>
          <TrendChart v-if="hasData" :points="rhrPoints" unit="bpm" />
          <p v-else class="state">Belum ada data RHR.</p>
        </div>
      </div>

      <div class="split">
        <div class="block">
          <h3>Per hari</h3>
          <p v-if="!recentRows.length" class="state">Belum ada data.</p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr><th>Tanggal</th><th>HRV</th><th>Tidur</th><th>Deep / REM / Awake</th><th>Skor</th><th>Resp.</th><th>RHR</th><th>Readiness</th></tr>
              </thead>
              <tbody>
                <tr v-for="d in recentRows" :key="d.date">
                  <td class="dim">{{ formatDay(d.date) }}</td>
                  <td>
                    <template v-if="d.row!.hrv_last_night != null">
                      <strong>{{ d.row!.hrv_last_night }}</strong>
                      <span class="muted"> / {{ d.row!.hrv_baseline_low ?? '?' }}–{{ d.row!.hrv_baseline_high ?? '?' }}</span>
                      <span v-if="d.row!.hrv_status" :class="['badge', { warn: d.row!.hrv_status !== 'BALANCED' }]">{{ d.row!.hrv_status }}</span>
                    </template>
                    <template v-else>-</template>
                  </td>
                  <td>{{ formatMinutes(d.row!.sleep_min) }}</td>
                  <td>{{ d.row!.deep_min != null ? `${formatMinutes(d.row!.deep_min)} / ${formatMinutes(d.row!.rem_min ?? null)} / ${formatMinutes(d.row!.awake_min ?? null)}` : '-' }}</td>
                  <td>{{ d.row!.sleep_score ?? '-' }}</td>
                  <td>{{ d.row!.sleep_respiration ?? '-' }}</td>
                  <td>{{ d.row!.rhr ?? '-' }} bpm</td>
                  <td>{{ d.row!.readiness_score != null ? `${d.row!.readiness_score} · ${d.row!.readiness_level ?? ''}` : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="block">
          <div class="block-head">
            <h3>Catatan kondisi</h3>
            <RouterLink to="/catat">Catat kondisi</RouterLink>
          </div>
          <div class="card flush">
            <p v-if="!notes.length" class="state">Belum ada catatan.</p>
            <ul class="list">
              <li v-for="c in notes" :key="c.date" class="list-item">
                <span class="muted">{{ formatDay(c.date) }}</span>
                <span class="list-meta">
                  <span v-if="c.alcohol" class="badge warn">alkohol</span>
                  <span v-if="c.sick" class="badge danger">sakit</span>
                  <span v-if="c.injured" class="badge danger">cedera</span>
                  <span>{{ c.note }}</span>
                </span>
              </li>
            </ul>
          </div>

          <form class="card form" @submit.prevent="saveManual">
            <div>
              <h2 class="m-0">Isi manual (cadangan)</h2>
              <p class="muted">Pakai hanya kalau sinkron Garmin gagal. Data Garmin di tanggal yang sama akan menimpa isian ini.</p>
            </div>
            <div class="form-row form">
              <label>Tanggal <input v-model="manual.date" type="date" :max="today()" required /></label>
              <label>Tidur (jam) <input v-model="manual.sleepHours" inputmode="decimal" placeholder="7,5" /></label>
              <label>RHR (bpm) <input v-model="manual.rhr" inputmode="numeric" placeholder="52" /></label>
            </div>
            <div><button class="secondary" :disabled="saving">Simpan manual</button></div>
            <p v-if="message" :class="['toast', { 'toast-error': message.error }]">{{ message.text }}</p>
          </form>
        </div>
      </div>
    </StateView>
  </section>
</template>
