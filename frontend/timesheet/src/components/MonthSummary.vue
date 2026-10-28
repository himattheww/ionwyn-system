<script setup lang="ts">
import { computed } from 'vue'
import { dayKind } from '../lib/day'
import { dayOfMonth, duration, monthName } from '../lib/format'
import type { Count, DayRow } from '../types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ days: DayRow[]; count: Count; month: number; today: string }>()

const totalWorked = computed(() => props.days.reduce((sum, day) => sum + (day.worked ?? 0), 0))

const lastDay = computed(() => {
  const last = props.days.filter((day) => day.date <= props.today).at(-1)
  return last ? dayOfMonth(last.date) : null
})

const dots = computed(() =>
  props.days.map((day) => ({
    date: day.date,
    kind: dayKind(day, props.today),
    today: day.date === props.today,
  })),
)
</script>

<template>
  <section class="card summary" aria-labelledby="summary-title">
    <div class="summary-head">
      <h2 id="summary-title">{{ monthName(month) }} {{ lastDay ? 'sejauh ini' : '' }}</h2>
      <span v-if="lastDay" class="muted">s.d. tanggal {{ lastDay }}</span>
    </div>

    <div class="summary-total">
      <span class="summary-total-icon"><AppIcon name="timer" :size="22" /></span>
      <div>
        <strong class="mono">{{ duration(totalWorked) }}</strong>
        <span class="muted">total jam kerja bersih</span>
      </div>
    </div>

    <dl class="summary-stats">
      <div>
        <AppIcon name="calendar-check" class="ico-accent" />
        <dt>Hadir</dt>
        <dd>{{ count.hadir }} <span class="muted">/ {{ count.workdays }}</span></dd>
      </div>
      <div class="stat-warn">
        <AppIcon name="calendar-alert" />
        <dt>Belum diisi</dt>
        <dd>{{ count.kosong }} hari</dd>
      </div>
      <div>
        <AppIcon name="alarm" class="ico-late" />
        <dt>Masuk lewat 09.00</dt>
        <dd>{{ count.late }}</dd>
      </div>
      <div>
        <AppIcon name="clock" class="ico-accent" />
        <dt>Lebih dari 8 jam</dt>
        <dd>{{ count.over }}</dd>
      </div>
    </dl>

    <div class="dots" role="img" :aria-label="'Status ' + days.length + ' hari di bulan ' + monthName(month)">
      <span v-for="dot in dots" :key="dot.date" class="dot" :class="['dot-' + dot.kind, { 'dot-today': dot.today }]"></span>
    </div>
    <div class="legend">
      <span><i class="dot dot-present"></i>Hadir</span>
      <span><i class="dot dot-absent"></i>Tidak hadir</span>
      <span><i class="dot dot-empty"></i>Belum diisi</span>
      <span><i class="dot dot-weekend"></i>Libur</span>
    </div>

    <details class="summary-more">
      <summary>Rekap lengkap</summary>
      <dl>
        <dt>Sakit</dt><dd>{{ count.sakit }}</dd>
        <dt>Izin</dt><dd>{{ count.izin }}</dd>
        <dt>Cuti</dt><dd>{{ count.cuti }}</dd>
        <dt>Kurang dari 8 jam</dt><dd>{{ count.short }}</dd>
      </dl>
    </details>
  </section>
</template>
