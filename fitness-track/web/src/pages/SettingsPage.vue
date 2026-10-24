<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, useApi } from '../lib/api';
import StateView from '../components/StateView.vue';

const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const { data, loading, error, load } = useApi<{ run_pattern: Record<string, string> }>(() => '/settings');
const plans = ref<string[]>(Array(7).fill(''));
const saving = ref(false);
const message = ref<{ text: string; error?: boolean } | null>(null);

watch(data, (value) => {
  if (value) plans.value = WEEKDAYS.map((_, i) => value.run_pattern[i + 1] ?? '');
});

async function submit() {
  const pattern = Object.fromEntries(
    plans.value.map((plan, i) => [String(i + 1), plan.trim()]).filter(([, plan]) => plan),
  );
  saving.value = true;
  message.value = null;
  try {
    await api('/settings/run-pattern', { method: 'PUT', body: pattern });
    message.value = { text: 'Pola lari tersimpan.' };
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
      <div class="kicker">Pola lari dan target</div>
      <h1>Pengaturan</h1>
    </div>
    <StateView :loading="loading" :error="error" @retry="load">
      <form class="card form" @submit.prevent="submit">
        <h2>Pola lari mingguan</h2>
        <p class="muted">Isi jenis lari di hari terjadwal, kosongkan hari tanpa jadwal lari.</p>
        <label v-for="(day, i) in WEEKDAYS" :key="day" class="inline-field">
          <span class="weekday">{{ day }}</span>
          <input v-model="plans[i]" maxlength="30" placeholder="-" />
        </label>
        <button :disabled="saving">Simpan pola</button>
        <p v-if="message" :class="['toast', { 'toast-error': message.error }]">{{ message.text }}</p>
      </form>
    </StateView>
  </section>
</template>

<style scoped src="../styles/settings.css"></style>
