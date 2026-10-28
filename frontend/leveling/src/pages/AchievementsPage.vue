<script setup lang="ts">
import { computed } from 'vue'
import { api, formatDate, useLoad } from '../lib/api.ts'
import StateView from '../components/StateView.vue'

interface Achievement {
  id: string
  name: string
  kind: string
  value?: number
  date: string | null
}

const kindLabel: Record<string, string> = {
  run_distance: 'Lari',
  run_long_target: 'Lari',
  strength_sessions: 'Beban',
  diary_streak: 'Catatan Malam',
  case_done: 'Learn',
  topic_done: 'Learn',
  learn_hours: 'Learn',
  schedule_items: 'Jadwal',
  finance_streak: 'Keuangan',
  level: 'Level'
}

const { data, loading, error, reload } = useLoad(() => api<Achievement[]>('/achievements'))
const earned = computed(() => (data.value ?? []).filter(a => a.date).sort((a, b) => b.date!.localeCompare(a.date!)))
const locked = computed(() => (data.value ?? []).filter(a => !a.date))
</script>

<template>
  <div>
    <span class="kicker">Lambang pencapaian</span>
    <h1>Achievement</h1>
    <p class="lede">{{ earned.length }} dari {{ (data ?? []).length }} tonggak tercapai.</p>
  </div>
  <StateView :loading="loading" :error="error" :empty="(data ?? []).length === 0" empty-text="Belum ada achievement di config." @retry="reload">
    <section class="block">
      <h3>Didapat</h3>
      <p v-if="earned.length === 0" class="lede muted">Belum ada yang didapat.</p>
      <div class="grid">
        <div v-for="item in earned" :key="item.id" class="card">
          <span class="card-kicker">{{ kindLabel[item.kind] ?? item.kind }}</span>
          <span class="card-title">{{ item.name }}</span>
          <span class="card-meta">{{ formatDate(item.date!) }}</span>
        </div>
      </div>
    </section>
    <section class="block">
      <h3>Belum didapat</h3>
      <div class="grid locked">
        <div v-for="item in locked" :key="item.id" class="locked-item">
          <span class="kicker">{{ kindLabel[item.kind] ?? item.kind }}</span>
          <span class="name">{{ item.name }}</span>
        </div>
      </div>
    </section>
  </StateView>
</template>

<style scoped src="../styles/achievements.css"></style>
