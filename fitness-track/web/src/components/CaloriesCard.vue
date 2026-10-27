<script setup lang="ts">
import { computed, ref } from 'vue';
import { api, useApi } from '../lib/api';
import { formatNumber, formatShort, today } from '../lib/format';

type Day = { date: string; burned: number | null; active: number | null; bmr: number | null; intake: number | null; intake_note: string | null; deficit: number | null; left_to_target: number | null; partial: boolean };
const calories = useApi<{ target: { kcal: number; note: string | null; updated_at: string } | null; days: Day[] }>(() => '/calories?days=7');

const todayRow = computed(() => calories.data.value?.days[0] ?? null);
const target = computed(() => calories.data.value?.target ?? null);
const kcal = ref('');
const saving = ref(false);
const message = ref<string | null>(null);
const kkal = (v: number | null) => (v == null ? '-' : `${formatNumber(v, 0)} kkal`);

async function save() {
  const value = Number(kcal.value);
  if (!Number.isInteger(value) || value < 0) return;
  saving.value = true;
  message.value = null;
  try {
    await api(`/intake/${today()}`, { method: 'PUT', body: { kcal: value } });
    kcal.value = '';
    await calories.load();
  } catch (e) {
    message.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="card">
    <div class="block-head">
      <h2 class="m-0">Kalori</h2>
      <span class="muted">terbakar dari Garmin, masuk diisi manual</span>
    </div>
    <p v-if="calories.loading.value" class="muted">Memuat…</p>
    <template v-else-if="todayRow">
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Terbakar hari ini</span>
          <span class="stat-value">{{ formatNumber(todayRow.burned, 0) }}</span>
          <span class="muted">sejauh ini · aktif {{ formatNumber(todayRow.active, 0) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Masuk</span>
          <span class="stat-value">{{ formatNumber(todayRow.intake, 0) }}</span>
          <span class="muted">{{ todayRow.intake_note ?? 'kkal' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Target makan</span>
          <span class="stat-value">{{ target ? formatNumber(target.kcal, 0) : '-' }}</span>
          <span class="muted">{{ target ? `sisa ${kkal(todayRow.left_to_target)}` : 'belum ditentukan' }}</span>
        </div>
      </div>
      <p v-if="target?.note" class="muted">Target dari Claude: {{ target.note }}</p>
      <p v-else-if="!target" class="muted">Minta Claude menghitung target makan harianmu, nanti tersimpan di sini.</p>

      <form class="inline-group" @submit.prevent="save">
        <label class="field">Kalori masuk hari ini (kkal) <input v-model="kcal" inputmode="numeric" placeholder="1900" /></label>
        <button :disabled="saving || !kcal">Simpan</button>
      </form>
      <p v-if="message" class="toast toast-error">{{ message }}</p>

      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Terbakar</th><th>Masuk</th><th>Defisit</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in calories.data.value?.days" :key="d.date">
              <td class="dim">{{ formatShort(d.date) }}{{ d.partial ? ' (berjalan)' : '' }}</td>
              <td>{{ kkal(d.burned) }}</td>
              <td>{{ kkal(d.intake) }}</td>
              <td :class="{ surplus: d.deficit != null && d.deficit < 0 }">{{ d.deficit == null ? '-' : d.deficit >= 0 ? `−${formatNumber(d.deficit, 0)}` : `+${formatNumber(-d.deficit, 0)}` }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.surplus {
  color: var(--bad);
}
.inline-group .field {
  flex: 1 1 200px;
}
</style>
