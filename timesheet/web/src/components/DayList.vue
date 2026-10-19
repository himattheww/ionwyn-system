<script setup lang="ts">
import { computed } from 'vue'
import { ABSENCE_LABEL, absenceOf, dayKind, isLate, WORKDAY, workedSoFar } from '../lib/day'
import { clock, dayName, dayOfMonth, duration } from '../lib/format'
import type { DayRow } from '../types'

const props = defineProps<{ days: DayRow[]; selected: string; today: string; now: number }>()
const emit = defineEmits<{ select: [date: string] }>()

const AXIS_START = 420
const AXIS_SPAN = 780
const AXIS = [
  { label: '07', at: 0 },
  { label: '09', at: 15.4, late: true },
  { label: '12', at: 38.5 },
  { label: '15', at: 61.5 },
  { label: '18', at: 84.6 },
]

function pct(min: number): number {
  return Math.max(0, Math.min(100, ((min - AXIS_START) / AXIS_SPAN) * 100))
}

function span(from: number, to: number) {
  return { left: pct(from) + '%', width: pct(to) - pct(from) + '%' }
}

const STATUS: Record<string, string> = {
  weekend: 'Libur',
  future: '',
  empty: 'Belum diisi',
  present: 'Hadir',
  today: 'Hari ini',
}

const rows = computed(() =>
  props.days.map((day) => {
    const kind = dayKind(day, props.today)
    const absence = absenceOf(day)
    const live = kind === 'today' && day.start !== null && day.end === null
    const until = day.end ?? (live ? props.now : null)
    const worked = day.start === null ? null : until === null ? null : workedSoFar(day, props.now)
    const overStart = day.start === null ? null : day.start + WORKDAY + (day.lunch ?? 60)
    const status = absence ? ABSENCE_LABEL[absence] : day.holiday && kind === 'weekend' ? 'Libur' : STATUS[kind] ?? ''
    return {
      day,
      kind,
      live,
      label: dayOfMonth(day.date) + ' ' + dayName(day.weekday),
      status,
      late: isLate(day),
      times: day.start === null ? '' : clock(day.start),
      endTime: day.start === null ? '' : day.end === null ? '…' : clock(day.end),
      worked: worked === null ? '' : duration(worked),
      over: worked !== null && worked > WORKDAY && !live ? '+' + duration(worked - WORKDAY) : '',
      bar: day.start !== null && until !== null ? span(day.start, until) : null,
      overBar: overStart !== null && until !== null && overStart < until ? span(overStart, until) : null,
      aria:
        dayOfMonth(day.date) + ' ' + dayName(day.weekday) + ', ' + (status || 'belum ada data') +
        (day.start !== null ? ', masuk ' + clock(day.start) : '') +
        (day.end !== null ? ', keluar ' + clock(day.end) : ''),
    }
  }),
)
</script>

<template>
  <section class="card day-list" aria-labelledby="day-list-title">
    <div class="day-list-head">
      <h2 id="day-list-title">Harian</h2>
      <div class="legend">
        <span><i class="legend-bar"></i>Jam kerja</span>
        <span><i class="legend-late"></i>Batas telat 09.00</span>
      </div>
    </div>
    <div class="day-scroll">
      <div class="day-grid">
        <div class="day-row day-header" aria-hidden="true">
          <span>Tanggal</span>
          <span>Status</span>
          <span>Jam</span>
          <span class="axis">
            <span v-for="tick in AXIS" :key="tick.label" :class="{ late: tick.late }" :style="{ left: tick.at + '%' }">{{ tick.label }}</span>
            <span class="axis-end">20</span>
          </span>
          <span>Durasi</span>
          <span>Kegiatan</span>
        </div>
        <button
          v-for="row in rows"
          :key="row.day.date"
          class="day-row"
          :class="['kind-' + row.kind, { selected: row.day.date === selected }]"
          :aria-label="row.aria"
          :aria-current="row.day.date === selected ? 'date' : undefined"
          @click="emit('select', row.day.date)"
        >
          <span class="cell-date">{{ row.label }}</span>
          <span class="cell-status"><span v-if="row.status" class="chip" :class="'chip-' + (row.kind === 'absent' ? 'absent' : row.kind)">{{ row.status }}</span></span>
          <span class="cell-times mono">
            <template v-if="row.times"><span :class="{ late: row.late }">{{ row.times }}</span>–{{ row.endTime }}</template>
            <template v-else-if="row.kind === 'empty'">—</template>
          </span>
          <span class="cell-track" :class="{ empty: row.kind === 'empty', off: row.kind === 'weekend' || row.kind === 'absent' }">
            <i class="track-late"></i>
            <i v-if="row.bar" class="track-bar" :class="{ live: row.live }" :style="row.bar"></i>
            <i v-if="row.overBar" class="track-over" :style="row.overBar"></i>
          </span>
          <span class="cell-worked mono">
            {{ row.worked }}
            <span v-if="row.over" class="badge">{{ row.over }}</span>
          </span>
          <span class="cell-note">{{ row.kind === 'absent' ? '' : row.day.note }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
