<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { api, formatDate, useLoad } from '../lib/api.ts'
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

const sourceLabels: Record<string, string> = {
  fit: 'Fit Tracker',
  diary: 'Catatan Malam',
  learn: 'Learn',
  timesheet: 'Timesheet',
  schedule: 'Scheduling',
  finance: 'Keuangan',
  stock: 'Saham',
  quest: 'Quest'
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
const { data, loading, error, reload } = useLoad(() => api<LogRow[]>(`/log?${query()}`))
watch(filter, reload)

const days = computed(() => {
  const groups = new Map<string, LogRow[]>()
  for (const row of data.value ?? []) groups.set(row.date, [...(groups.get(row.date) ?? []), row])
  return [...groups].map(([date, rows]) => ({
    date,
    rows,
    total: rows.reduce((sum, r) => sum + r.awarded, 0),
    capped: rows.reduce((sum, r) => sum + r.capped, 0)
  }))
})
</script>

<template>
  <div>
    <span class="kicker">Pembukuan exp</span>
    <h1>Log exp</h1>
    <p class="lede">Dari mana setiap poin datang, dan berapa yang terpotong batas harian.</p>
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
      <label for="log-from">Dari</label>
      <input id="log-from" v-model="filter.from" class="input" type="date" />
    </div>
    <div class="field date">
      <label for="log-to">Sampai</label>
      <input id="log-to" v-model="filter.to" class="input" type="date" />
    </div>
  </div>
  <StateView :loading="loading" :error="error" :empty="days.length === 0" empty-text="Tidak ada exp pada filter ini." @retry="reload">
    <section v-for="day in days" :key="day.date" class="day">
      <div class="head">
        <h4>{{ formatDate(day.date) }}</h4>
        <span class="sum">
          <strong>+{{ day.total }} exp</strong>
          <span v-if="day.capped > 0" class="capped"> · {{ day.capped }} terpotong</span>
        </span>
      </div>
      <div class="table-scroll">
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
    </section>
  </StateView>
</template>

<style scoped src="../styles/log.css"></style>
