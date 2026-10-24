<script setup lang="ts">
import { computed } from 'vue'
import { api, formatDate, useLoad, type HistoryItem } from '../lib/api.ts'
import StateView from '../components/StateView.vue'

const { data, loading, error, reload } = useLoad(() => api<(HistoryItem & { id: number })[]>('/history'))

const kindLabel: Record<HistoryItem['kind'], string> = {
  level: 'Level',
  tier: 'Tingkatan',
  attribute: 'Atribut',
  class: 'Kelas',
  subclass: 'Subkelas',
  achievement: 'Achievement',
  quest: 'Quest'
}
const major = new Set<HistoryItem['kind']>(['level', 'tier', 'class'])

const days = computed(() => {
  const groups = new Map<string, HistoryItem[]>()
  for (const item of data.value ?? []) groups.set(item.date, [...(groups.get(item.date) ?? []), item])
  return [...groups]
})
</script>

<template>
  <div>
    <span class="kicker">Gulungan perjalanan</span>
    <h1>Riwayat</h1>
    <p class="lede">Setiap kenaikan level, kelas, dan quest, dihitung ulang dari awal.</p>
  </div>
  <StateView :loading="loading" :error="error" :empty="days.length === 0" empty-text="Belum ada riwayat." @retry="reload">
    <div class="days">
      <section v-for="[date, items] in days" :key="date" class="day">
        <div class="date">{{ formatDate(date) }}</div>
        <div class="items">
          <div v-for="item in items" :key="item.text" class="item">
            <span class="kicker" :class="item.kind">{{ kindLabel[item.kind] }}</span>
            <span class="text" :class="{ major: major.has(item.kind) }">{{ item.text }}</span>
          </div>
        </div>
      </section>
    </div>
  </StateView>
</template>

<style scoped src="../styles/history.css"></style>
