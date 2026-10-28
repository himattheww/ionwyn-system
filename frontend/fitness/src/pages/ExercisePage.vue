<script setup lang="ts">
import { computed } from 'vue';
import { useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import TrendChart from '../components/TrendChart.vue';
import { formatDay, formatShort } from '../lib/format';

const props = defineProps<{ name: string }>();

type HistoryRow = { date: string; text: string; total_reps: number; max_weight_kg: number | null };

const { data, loading, error, load } = useApi<HistoryRow[]>(() => `/strength/exercise?name=${encodeURIComponent(props.name)}`);

const hasWeight = computed(() => data.value?.some((r) => r.max_weight_kg != null) ?? false);
const points = computed(() =>
  [...(data.value ?? [])].reverse().map((r) => ({
    label: formatShort(r.date),
    value: hasWeight.value ? r.max_weight_kg : r.total_reps,
  })),
);
</script>

<template>
  <section>
    <RouterLink :to="{ name: 'strength' }" class="back">← Latihan beban</RouterLink>
    <h1>{{ name }}</h1>
    <StateView :loading="loading" :error="error" :empty="!data?.length" empty-text="Belum ada riwayat gerakan ini." @retry="load">
      <div v-if="points.length > 1" class="card">
        <h2>{{ hasWeight ? 'Beban terberat' : 'Total repetisi' }} per sesi</h2>
        <TrendChart :points="points" :unit="hasWeight ? 'kg' : 'reps'" />
      </div>
      <div class="card">
        <ul class="list">
          <li v-for="r in data" :key="r.date + r.text" class="list-item">
            <span>{{ formatDay(r.date) }}</span>
            <strong>{{ r.text }}</strong>
          </li>
        </ul>
      </div>
    </StateView>
  </section>
</template>
