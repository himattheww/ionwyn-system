<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { api, formatDate, useLoad, type HistoryItem } from '../lib/api.ts'
import StateView from '../components/StateView.vue'

interface LogRow {
  date: string
  attribute: string
  source: string
  rule: string
  note: string
  raw: number
  awarded: number
  capped: number
}

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

const sourceLabels: Record<string, string> = {
  fit: 'Fit Tracker',
  diary: 'Catatan Malam',
  learn: 'Learn',
  timesheet: 'Timesheet',
  schedule: 'Scheduling',
  finance: 'Keuangan',
  stock: 'Saham',
  quest: 'Quest',
  wish: 'Cita-cita'
}

const attributes = [
  { value: '', label: 'Semua' },
  { value: 'stamina', label: 'Stamina' },
  { value: 'intelek', label: 'Intelek' },
  { value: 'kebijaksanaan', label: 'Kebijaksanaan' },
  { value: 'disiplin', label: 'Disiplin' },
  { value: 'kekayaan', label: 'Kekayaan' }
]

const filter = reactive({ attribute: '', from: '', to: '' })
const query = () => new URLSearchParams(Object.entries(filter).filter(([, value]) => value)).toString()
const { data, loading, error, reload } = useLoad(() =>
  Promise.all([api<HistoryItem[]>('/history'), api<LogRow[]>(`/log?${query()}`)])
)
watch(filter, reload)

const days = computed(() => {
  const [history, log] = data.value ?? [[], []]
  const groups = new Map<string, { moments: HistoryItem[]; rows: LogRow[] }>()
  const day = (date: string) => groups.get(date) ?? groups.set(date, { moments: [], rows: [] }).get(date)!
  for (const row of log) day(row.date).rows.push(row)
  for (const item of history) {
    if (filter.from && item.date < filter.from) continue
    if (filter.to && item.date > filter.to) continue
    if (filter.attribute && !groups.has(item.date)) continue
    day(item.date).moments.push(item)
  }
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, { moments, rows }]) => ({
      date,
      moments,
      rows,
      total: rows.reduce((sum, r) => sum + r.awarded, 0),
      capped: rows.reduce((sum, r) => sum + r.capped, 0)
    }))
})
</script>

<template>
  <div>
    <span class="kicker">Gulungan perjalanan</span>
    <h1>Riwayat</h1>
    <p class="lede">Kenaikan level, kelas, dan quest per hari. Buka harinya untuk melihat dari mana setiap poin exp datang.</p>
  </div>
  <div class="filters">
    <div class="field">
      <label>Atribut</label>
      <div class="seg">
        <label v-for="option in attributes" :key="option.value" class="seg-opt">
          <input v-model="filter.attribute" type="radio" name="attribute" :value="option.value" />
          {{ option.label }}
        </label>
      </div>
    </div>
    <div class="field date">
      <label for="history-from">Dari</label>
      <input id="history-from" v-model="filter.from" class="input" type="date" />
    </div>
    <div class="field date">
      <label for="history-to">Sampai</label>
      <input id="history-to" v-model="filter.to" class="input" type="date" />
    </div>
  </div>
  <StateView :loading="loading" :error="error" :empty="days.length === 0" empty-text="Belum ada riwayat pada filter ini." @retry="reload">
    <div class="days">
      <details v-for="day in days" :key="day.date" class="day">
        <summary>
          <span class="date">{{ formatDate(day.date) }}</span>
          <span class="sum">
            <strong v-if="day.rows.length">+{{ day.total }} exp</strong>
            <span v-if="day.capped > 0" class="capped"> · {{ day.capped }} terpotong</span>
          </span>
          <span v-if="day.moments.length" class="moments">
            <span v-for="item in day.moments" :key="item.kind + item.text" class="item">
              <span class="kicker" :class="item.kind">{{ kindLabel[item.kind] }}</span>
              <span class="text" :class="{ major: major.has(item.kind) }">{{ item.text }}</span>
            </span>
          </span>
        </summary>
        <div v-if="day.rows.length" class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>Atribut</th>
                <th>Sumber</th>
                <th>Aturan</th>
                <th>Detail</th>
                <th class="num">Nilai</th>
                <th class="num">Didapat</th>
                <th class="num">Terpotong</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in day.rows" :key="index">
                <td class="cap">{{ row.attribute }}</td>
                <td>{{ sourceLabels[row.source] ?? row.source }}</td>
                <td>{{ row.rule }}</td>
                <td class="note">{{ row.note }}</td>
                <td class="num">{{ row.raw }}</td>
                <td class="num awarded">{{ row.awarded }}</td>
                <td class="num" :class="row.capped > 0 ? 'capped' : 'none'">{{ row.capped || '–' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="small muted">Tidak ada exp tercatat hari ini.</p>
      </details>
    </div>
  </StateView>
</template>

<style scoped src="../styles/history.css"></style>
