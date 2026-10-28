<script setup lang="ts">
import { useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import { formatDay } from '../lib/format';

type Session = { garmin_id: number; name: string | null; date: string; exercises: { name: string; sets: number; text: string }[] };

const { data, loading, error, load } = useApi<Session[]>(() => '/strength');
</script>

<template>
  <section>
    <div>
      <div class="kicker">Strength · per gerakan</div>
      <h1>Beban</h1>
    </div>
    <StateView
      :loading="loading"
      :error="error"
      :empty="!data?.length"
      empty-text="Belum ada sesi latihan beban dari Garmin."
      @retry="load"
    >
      <div v-for="s in data" :key="s.garmin_id" class="card">
        <h2>{{ s.name ?? 'Latihan beban' }}</h2>
        <p class="muted">{{ formatDay(s.date) }}</p>
        <p v-if="!s.exercises.length" class="muted">Detail set belum tersedia.</p>
        <ul class="exercise-list">
          <li v-for="e in s.exercises" :key="e.name">
            <RouterLink :to="{ name: 'exercise', params: { name: e.name } }">{{ e.text }}</RouterLink>
          </li>
        </ul>
      </div>
    </StateView>
  </section>
</template>

<style scoped src="../styles/strength.css"></style>
