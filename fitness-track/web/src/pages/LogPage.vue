<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { api, useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import { addDays, formatDay, formatNumber, parseDecimal, today } from '../lib/format';
import type { Condition, Meal } from '../types';

const weights = useApi<{ weights: { date: string; kg: number }[]; avg7: number | null; avgPrev7: number | null }>(() => '/weights');
const meals = useApi<Meal[]>(() => '/meals');
const conditions = useApi<{ conditions: Condition[] }>(() => '/recovery?days=365');

const loading = computed(() => weights.loading.value || meals.loading.value || conditions.loading.value);
const error = computed(() => weights.error.value || meals.error.value || conditions.error.value);
const reload = () => Promise.all([weights.load(), meals.load(), conditions.load()]);

const date = ref(today());
const form = reactive({ kg: '', protein: null as boolean | null, rice: '', alcohol: false, sick: false, note: '' });
const saving = ref(false);
const message = ref<{ text: string; error?: boolean } | null>(null);

const byDate = computed(() => ({
  weight: new Map((weights.data.value?.weights ?? []).map((w) => [w.date, w.kg])),
  meal: new Map((meals.data.value ?? []).map((m) => [m.date, m])),
  condition: new Map((conditions.data.value?.conditions ?? []).map((c) => [c.date, c])),
}));

function fill() {
  const kg = byDate.value.weight.get(date.value);
  const meal = byDate.value.meal.get(date.value);
  const cond = byDate.value.condition.get(date.value);
  form.kg = kg != null ? String(kg).replace('.', ',') : '';
  form.protein = meal ? !!meal.protein_met : null;
  form.rice = meal ? String(meal.rice_portions).replace('.', ',') : '';
  form.alcohol = !!cond?.alcohol;
  form.sick = !!cond?.sick;
  form.note = cond?.note ?? '';
}

watch(loading, (l) => !l && fill());

function pick(d: string) {
  date.value = d;
  message.value = null;
  fill();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stepRice(delta: number) {
  const current = parseDecimal(form.rice) ?? 0;
  form.rice = String(Math.max(0, current + delta)).replace('.', ',');
}

async function submit() {
  const kg = form.kg.trim() ? parseDecimal(form.kg) : null;
  if (form.kg.trim() && kg == null) {
    message.value = { text: 'Berat harus angka, misalnya 71,8.', error: true };
    return;
  }
  const rice = parseDecimal(form.rice);
  if (form.protein != null && rice == null) {
    message.value = { text: 'Porsi nasi harus angka, isi 0 kalau tidak makan nasi.', error: true };
    return;
  }
  saving.value = true;
  message.value = null;
  try {
    const d = date.value;
    await Promise.all([
      kg != null ? api(`/weights/${d}`, { method: 'PUT', body: { kg } }) : null,
      form.protein != null ? api(`/meals/${d}`, { method: 'PUT', body: { protein_met: form.protein, rice_portions: rice } }) : null,
      api(`/condition/${d}`, { method: 'PUT', body: { alcohol: form.alcohol, sick: form.sick, note: form.note.trim() || null } }),
    ]);
    message.value = { text: `Catatan ${formatDay(d)} tersimpan.` };
    await reload();
  } catch (e) {
    message.value = { text: (e as Error).message, error: true };
  } finally {
    saving.value = false;
  }
}

const history = computed(() =>
  Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today(), -i);
    const kg = byDate.value.weight.get(d);
    const meal = byDate.value.meal.get(d);
    const cond = byDate.value.condition.get(d);
    return {
      date: d,
      kg: kg != null ? `${formatNumber(kg)} kg` : '—',
      protein: meal ? (meal.protein_met ? 'tercapai' : 'kurang') : 'belum diisi',
      proteinClass: meal ? (meal.protein_met ? 'ok' : 'warn') : '',
      rice: meal ? `${formatNumber(meal.rice_portions)} porsi` : '—',
      condition: cond ? [cond.alcohol && 'alkohol', cond.sick && 'sakit', cond.note].filter(Boolean).join(' · ') || '—' : '—',
    };
  }),
);

const weightNote = computed(() => {
  const w = weights.data.value;
  if (w?.avg7 == null) return 'Belum ada rata-rata 7 hari.';
  const diff = w.avgPrev7 == null ? null : Math.round((w.avg7 - w.avgPrev7) * 10) / 10;
  return `Rata-rata 7 hari ${formatNumber(w.avg7)} kg${diff == null ? '' : ` · ${diff > 0 ? '+' : ''}${formatNumber(diff)} dari minggu lalu`}`;
});
</script>

<template>
  <section>
    <div class="page-head">
      <div>
        <div class="kicker">Berat · makan · kondisi — diisi manual</div>
        <h1>Catat harian</h1>
      </div>
      <label class="field" style="min-width: 200px">
        Tanggal
        <input v-model="date" type="date" :max="today()" required @change="fill" />
      </label>
    </div>

    <StateView :loading="loading" :error="error" @retry="reload">
      <form class="block" @submit.prevent="submit">
        <div class="cells">
          <div class="card">
            <span class="kicker">A · Berat badan</span>
            <label class="field">
              Berat (kg)
              <input v-model="form.kg" class="input-lg" inputmode="decimal" placeholder="72,0" />
            </label>
            <span class="muted">{{ weightNote }} · kosongkan kalau tidak menimbang.</span>
          </div>

          <div class="card">
            <span class="kicker">B · Makan</span>
            <div class="field">
              Target protein
              <div class="seg full">
                <label class="seg-opt"><input v-model="form.protein" type="radio" name="protein" :value="true" />Tercapai</label>
                <label class="seg-opt"><input v-model="form.protein" type="radio" name="protein" :value="false" />Kurang</label>
              </div>
            </div>
            <div class="field">
              Porsi nasi
              <div class="stepper">
                <button type="button" class="step" aria-label="Kurangi" @click="stepRice(-0.5)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14" /></svg>
                </button>
                <input v-model="form.rice" inputmode="decimal" placeholder="2" />
                <button type="button" class="step" aria-label="Tambah" @click="stepRice(0.5)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <span class="kicker">C · Kondisi</span>
            <label class="check"><input v-model="form.alcohol" type="checkbox" /> Minum alkohol</label>
            <label class="check"><input v-model="form.sick" type="checkbox" /> Sakit</label>
            <label class="field">
              Catatan
              <textarea v-model="form.note" rows="2" maxlength="1000" />
            </label>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4)">
          <button class="btn-lg" :disabled="saving">Simpan {{ formatDay(date) }}</button>
          <p v-if="message" :class="['toast', { 'toast-error': message.error }]">{{ message.text }}</p>
        </div>
      </form>

      <div class="block">
        <h3>Riwayat 14 hari</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Berat</th><th>Protein</th><th>Nasi</th><th>Kondisi</th></tr>
            </thead>
            <tbody>
              <tr v-for="h in history" :key="h.date" class="clickable" @click="pick(h.date)">
                <td class="dim">{{ formatDay(h.date) }}</td>
                <td><strong>{{ h.kg }}</strong></td>
                <td><span :class="['badge', h.proteinClass]">{{ h.protein }}</span></td>
                <td>{{ h.rice }}</td>
                <td>{{ h.condition }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </StateView>
  </section>
</template>
