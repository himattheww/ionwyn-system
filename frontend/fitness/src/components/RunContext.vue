<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { api } from '../lib/api';
import { formatDuration, formatNumber, formatPace } from '../lib/format';
import type { ActivityContext, Fueling } from '../types';

const props = defineProps<{ id: number; context: ActivityContext | null; fueling: Fueling | null }>();
const emit = defineEmits<{ saved: [] }>();

const feelLabel: Record<number, string> = { 0: 'sangat lemah', 25: 'lemah', 50: 'normal', 75: 'kuat', 100: 'sangat kuat' };
const zoneTotal = computed(() => props.context?.hr_zones.reduce((sum, z) => sum + z.seconds, 0) ?? 0);
const share = (seconds: number) => (zoneTotal.value ? Math.round((seconds / zoneTotal.value) * 100) : 0);
const aqiLabel = (aqi: number) =>
  aqi <= 50 ? 'baik' : aqi <= 100 ? 'sedang' : aqi <= 150 ? 'tidak sehat bagi sensitif' : aqi <= 200 ? 'tidak sehat' : aqi <= 300 ? 'sangat tidak sehat' : 'berbahaya';

const form = reactive({ gels: 0, gel_km: '', drink_ml: '', electrolytes: '', note: '' });
watch(
  () => props.fueling,
  (f) => Object.assign(form, { gels: f?.gels ?? 0, gel_km: f?.gel_km ?? '', drink_ml: f?.drink_ml == null ? '' : String(f.drink_ml), electrolytes: f?.electrolytes ?? '', note: f?.note ?? '' }),
  { immediate: true },
);
const saving = ref(false);
const message = ref<{ text: string; error: boolean } | null>(null);

async function save() {
  saving.value = true;
  message.value = null;
  try {
    await api(`/activities/${props.id}/fueling`, {
      method: 'PUT',
      body: { gels: Number(form.gels) || 0, gel_km: form.gel_km.trim() || null, drink_ml: form.drink_ml ? Number(form.drink_ml) : null, electrolytes: form.electrolytes.trim() || null, note: form.note.trim() || null },
    });
    message.value = { text: 'Fueling tersimpan.', error: false };
    emit('saved');
  } catch (e) {
    message.value = { text: (e as Error).message, error: true };
  } finally {
    saving.value = false;
  }
}

type Drift = { skipped_warmup_sec: number; first_half: { avg_hr: number; pace_sec_per_km: number }; second_half: { avg_hr: number; pace_sec_per_km: number }; decoupling_pct: number };
const drift = ref<Drift | null>(null);
const driftState = ref<'idle' | 'loading' | string>('idle');
async function loadDrift() {
  driftState.value = 'loading';
  try {
    const result = await api<{ drift?: Drift | null; error?: string }>(`/activities/${props.id}/series`);
    if (result.error || !result.drift) throw new Error(result.error ?? 'Data HR atau pace tidak cukup.');
    drift.value = result.drift;
    driftState.value = 'idle';
  } catch (e) {
    driftState.value = (e as Error).message;
  }
}
</script>

<template>
  <div class="grid-2">
    <div class="card">
      <h2 class="m-0">Kondisi sesi</h2>
      <p v-if="!context" class="muted">Cuaca, AQI, zona HR, dan RPE diambil saat sinkron berikutnya.</p>
      <dl v-else class="details">
        <dt>Cuaca</dt>
        <dd>
          <template v-if="context.temp_c != null">
            {{ formatNumber(context.temp_c) }}°C (terasa {{ formatNumber(context.feels_like_c) }}°C) · dew point <strong>{{ formatNumber(context.dew_point_c) }}°C</strong> ·
            {{ formatNumber(context.humidity_pct, 0) }}% · angin {{ formatNumber(context.wind_kph) }} km/j
            <span class="muted">{{ context.weather }}</span>
          </template>
          <template v-else>-</template>
        </dd>
        <dt>AQI</dt>
        <dd>
          <template v-if="context.aqi != null">
            <strong>{{ context.aqi }}</strong> {{ aqiLabel(context.aqi) }}
            <span class="badge">{{ context.aqi_source === 'station' ? 'stasiun' : 'model' }}</span>
            <span class="muted">
              <template v-if="context.aqi_station != null"> · stasiun {{ context.aqi_station }} (PM2.5 {{ formatNumber(context.pm25_station) }}){{ context.station_name ? `, ${context.station_name}` : '' }}</template>
              <template v-if="context.aqi_model != null"> · model {{ context.aqi_model }} (PM2.5 {{ formatNumber(context.pm25_model) }})</template>
            </span>
          </template>
          <template v-else>-</template>
        </dd>
        <dt>RPE / feel</dt>
        <dd>{{ context.rpe ?? '-' }}{{ context.feel != null ? ` · ${feelLabel[context.feel] ?? context.feel}` : '' }}</dd>
        <dt>Training effect</dt>
        <dd>
          {{ context.te_label ?? '-' }}<template v-if="context.anaerobic_te != null"> · anaerob {{ formatNumber(context.anaerobic_te) }}</template>
          <template v-if="context.training_load != null"> · load {{ formatNumber(context.training_load, 0) }}</template>
        </dd>
        <dt>Sepatu</dt>
        <dd>{{ context.shoes ?? 'belum terdaftar di Garmin' }}</dd>
      </dl>

      <template v-if="context?.hr_zones.length">
        <h3 class="zones-title">Zona HR (batas Garmin)</h3>
        <div v-for="z in context.hr_zones" :key="z.zone" class="zone">
          <span class="zone-name">Z{{ z.zone }} <small>≥ {{ z.from_bpm }}</small></span>
          <span class="zone-bar"><i :style="{ width: `${share(z.seconds)}%` }" /></span>
          <span class="zone-time">{{ formatDuration(z.seconds) }} · {{ share(z.seconds) }}%</span>
        </div>
      </template>
    </div>

    <div class="card">
      <form class="form" @submit.prevent="save">
        <h2 class="m-0">Fueling</h2>
        <div class="form-row form">
          <label>Jumlah gel <input v-model="form.gels" type="number" min="0" max="30" inputmode="numeric" /></label>
          <label>Di km berapa <input v-model="form.gel_km" placeholder="8, 15" /></label>
          <label>Minum (ml) <input v-model="form.drink_ml" type="number" min="0" inputmode="numeric" /></label>
        </div>
        <label>Elektrolit <input v-model="form.electrolytes" placeholder="1 tablet, garam" /></label>
        <label>Catatan <textarea v-model="form.note" rows="2" /></label>
        <div><button :disabled="saving">{{ saving ? 'Menyimpan...' : 'Simpan fueling' }}</button></div>
        <p v-if="message" :class="['toast', { 'toast-error': message.error }]">{{ message.text }}</p>
      </form>

      <div class="drift">
        <h2 class="m-0">HR drift</h2>
        <p class="muted">Diambil dari Garmin saat diminta, tidak disimpan. Cocok untuk long run.</p>
        <button class="secondary" :disabled="driftState === 'loading'" @click="loadDrift">{{ driftState === 'loading' ? 'Menghitung...' : 'Hitung HR drift' }}</button>
        <p v-if="driftState !== 'idle' && driftState !== 'loading'" class="toast toast-error">{{ driftState }}</p>
        <dl v-if="drift" class="details">
          <dt>Paruh pertama</dt>
          <dd>{{ formatPace(drift.first_half.pace_sec_per_km) }} · {{ drift.first_half.avg_hr }} bpm</dd>
          <dt>Paruh kedua</dt>
          <dd>{{ formatPace(drift.second_half.pace_sec_per_km) }} · {{ drift.second_half.avg_hr }} bpm</dd>
          <dt>Decoupling</dt>
          <dd><strong>{{ formatNumber(drift.decoupling_pct) }}%</strong> <span class="muted">(pemanasan {{ Math.round(drift.skipped_warmup_sec / 60) }} menit tidak dihitung)</span></dd>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped src="../styles/run-context.css"></style>
