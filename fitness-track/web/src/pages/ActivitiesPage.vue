<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useApi } from '../lib/api';
import StateView from '../components/StateView.vue';
import TrendChart from '../components/TrendChart.vue';
import { activityLabel, formatDay, formatDuration, formatNumber, formatPace, formatShort, formatTime } from '../lib/format';
import type { Activity } from '../types';

type Session = { garmin_id: number; name: string | null; date: string; exercises: { name: string; sets: number; text: string }[] };

const type = ref('');
const list = useApi<{ activities: Activity[]; types: string[] }>(() => (type.value ? `/activities?type=${encodeURIComponent(type.value)}` : '/activities'));
const longRuns = useApi<{ target_km: number; weeks: { week_start: string; km: number }[] }>(() => '/long-runs');
const strength = useApi<Session[]>(() => '/strength');

const types = ref<string[]>([]);
watch(list.data, (d) => {
  if (d && !type.value) types.value = d.types;
});
const options = computed(() => [{ value: '', label: 'Semua' }, ...types.value.map((t) => ({ value: t, label: activityLabel(t) }))]);

const points = computed(() => longRuns.data.value?.weeks.map((w) => ({ label: formatShort(w.week_start), value: w.km })) ?? []);
const longest = computed(() => Math.max(0, ...(longRuns.data.value?.weeks.map((w) => w.km) ?? [])));

function select(value: string) {
  type.value = value;
  list.load();
}
</script>

<template>
  <section>
    <div>
      <div class="kicker">Dari Garmin Connect</div>
      <h1>Aktivitas</h1>
    </div>

    <div class="card">
      <div class="block-head">
        <h2 class="m-0">Long run per minggu</h2>
        <span v-if="longRuns.data.value" class="muted">Target {{ formatNumber(longRuns.data.value.target_km) }} km · terjauh {{ formatNumber(longest) }} km</span>
      </div>
      <StateView
        :loading="longRuns.loading.value"
        :error="longRuns.error.value"
        :empty="!points.length"
        empty-text="Belum ada data lari."
        @retry="longRuns.load"
      >
        <TrendChart :points="points" kind="bar" unit="km" :target="longRuns.data.value?.target_km" />
      </StateView>
    </div>

    <div class="block">
      <div class="block-head">
        <h3>Riwayat</h3>
        <div class="seg">
          <label v-for="o in options" :key="o.value" class="seg-opt">
            <input type="radio" name="type" :checked="type === o.value" @change="select(o.value)" />{{ o.label }}
          </label>
        </div>
      </div>
      <StateView
        :loading="list.loading.value"
        :error="list.error.value"
        :empty="!list.data.value?.activities.length"
        empty-text="Belum ada aktivitas. Jalankan sinkron Garmin dulu."
        @retry="list.load"
      >
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Aktivitas</th><th>Jarak</th><th>Durasi</th><th>Pace</th><th>HR</th><th>Kalori</th></tr>
            </thead>
            <tbody>
              <tr v-for="a in list.data.value?.activities" :key="a.garmin_id">
                <td class="dim">{{ formatDay(a.date) }} · {{ formatTime(a.start_time) }}</td>
                <td><strong>{{ a.name ?? activityLabel(a.type) }}</strong> <span class="tag">{{ activityLabel(a.type) }}</span></td>
                <td>{{ a.distance_m ? `${formatNumber(a.distance_m / 1000, 2)} km` : '-' }}</td>
                <td>{{ formatDuration(a.duration_sec) }}</td>
                <td>{{ a.avg_pace_sec_per_km && a.type.includes('running') ? formatPace(a.avg_pace_sec_per_km) : '-' }}</td>
                <td>{{ a.avg_hr ? `${Math.round(a.avg_hr)} bpm` : '-' }}</td>
                <td>{{ a.calories ? `${formatNumber(a.calories, 0)} kkal` : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </StateView>
    </div>

    <div class="block">
      <div class="block-head">
        <h3>Latihan beban</h3>
        <RouterLink v-if="(strength.data.value?.length ?? 0) > 4" :to="{ name: 'strength' }">Semua sesi</RouterLink>
      </div>
      <StateView
        :loading="strength.loading.value"
        :error="strength.error.value"
        :empty="!strength.data.value?.length"
        empty-text="Belum ada sesi latihan beban dari Garmin."
        @retry="strength.load"
      >
        <div class="cells">
          <div v-for="s in strength.data.value?.slice(0, 4)" :key="s.garmin_id" class="card">
            <span class="kicker">{{ formatDay(s.date) }}</span>
            <h2 class="m-0">{{ s.name ?? 'Latihan beban' }}</h2>
            <p v-if="!s.exercises.length" class="muted">Detail set belum tersedia.</p>
            <ul class="list">
              <li v-for="e in s.exercises" :key="e.name" class="list-item">
                <RouterLink :to="{ name: 'exercise', params: { name: e.name } }">{{ e.text }}</RouterLink>
              </li>
            </ul>
          </div>
        </div>
      </StateView>
    </div>
  </section>
</template>
