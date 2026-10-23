<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ABSENCE_LABEL, absenceOf, isLate, targetEnd, WORKDAY, workedSoFar } from '../lib/day'
import { clock, dayLong, duration, monthName, nowClock, partOfDay, toMinutes } from '../lib/format'
import type { AbsenceKind, DayRow, Entry } from '../types'
import AppIcon, { type IconName } from './AppIcon.vue'
import ClockDial from './ClockDial.vue'

const props = defineProps<{ date: string; row: DayRow | undefined; today: string; now: number; busy: boolean }>()
const emit = defineEmits<{ submit: [entry: Entry]; back: [] }>()

const PART_ICON: Record<string, IconName> = { Pagi: 'sunrise', Siang: 'sun', Sore: 'sunset', Malam: 'moon' }

const isToday = computed(() => props.date === props.today)
const absence = computed(() => (props.row ? absenceOf(props.row) : null))
const start = computed(() => props.row?.start ?? null)
const end = computed(() => props.row?.end ?? null)
const live = computed(() => isToday.value && start.value !== null && end.value === null)
const worked = computed(() => (props.row ? workedSoFar(props.row, props.now) : 0))
const target = computed(() => (props.row ? targetEnd(props.row) : null))
const short = computed(() => end.value !== null && worked.value < WORKDAY)

const text = ref('')
const time = ref(nowClock())
const manual = ref(false)
const kind = ref<'masuk' | 'keluar'>('masuk')
const confirming = ref<AbsenceKind | null>(null)

watch(
  () => [props.date, props.row?.note, props.row?.hadir] as const,
  () => {
    text.value = props.row?.hadir === 'N' ? '' : (props.row?.note ?? '')
  },
  { immediate: true },
)

watch(
  () => props.date,
  () => {
    time.value = nowClock()
    manual.value = !isToday.value
    confirming.value = null
  },
  { immediate: true },
)

watch(
  () => [props.date, start.value] as const,
  () => {
    kind.value = start.value === null ? 'masuk' : 'keluar'
  },
  { immediate: true },
)

const title = computed(() => {
  if (!props.row) return 'Tanggal tidak ada di sheet'
  return dayLong(props.row.weekday) + ', ' + Number(props.date.slice(8, 10)) + ' ' + monthName(Number(props.date.slice(5, 7)))
})

const part = computed(() => partOfDay(props.now))
const eyebrowIcon = computed<IconName>(() => (isToday.value ? PART_ICON[part.value] ?? 'clock' : 'calendar'))
const eyebrow = computed(() => (isToday.value ? part.value + ' · WIB' : 'Ubah hari'))

const pill = computed(() => {
  if (absence.value) return { text: ABSENCE_LABEL[absence.value], tone: 'absent' }
  if (isToday.value && start.value === null) return { text: 'Belum masuk', tone: 'idle' }
  if (live.value) return { text: 'Sedang bekerja', tone: 'live' }
  if (start.value !== null) return { text: isToday.value ? 'Selesai' : 'Hadir', tone: 'done' }
  if (props.date < props.today) return { text: 'Belum diisi', tone: 'warn' }
  return { text: 'Belum tiba', tone: 'idle' }
})

const third = computed(() => {
  if (isToday.value && start.value === null) return { label: 'Pulang paling cepat', value: clock(props.now + WORKDAY + 60) }
  if (live.value) return { label: 'Target pulang', value: clock(target.value) }
  return { label: 'Durasi bersih', value: duration(start.value === null ? null : worked.value) }
})

const hint = computed(() => {
  if (start.value === null) return isToday.value ? 'Masuk sebelum 09.00 agar tidak tercatat telat' : 'Belum ada jam tercatat'
  if (live.value) return 'Sisa ' + duration(Math.max(0, (target.value ?? props.now) - props.now)) + ' lagi sampai 8 jam'
  if (end.value === null) return 'Jam keluar belum diisi'
  return worked.value >= WORKDAY ? 'Lembur +' + duration(worked.value - WORKDAY) : 'Kurang ' + duration(WORKDAY - worked.value) + ' dari 8 jam'
})

const hintTone = computed(() => (short.value ? 'warn' : worked.value > WORKDAY && end.value !== null ? 'accent' : ''))

const dialStart = computed(() => (start.value ?? (isToday.value ? props.now : null)))
const dialEnd = computed(() => (dialStart.value === null ? null : dialStart.value + WORKDAY + (props.row?.lunch ?? 60)))
const dialFill = computed(() => (start.value === null ? null : (end.value ?? (live.value ? props.now : null))))
const dialMarker = computed(() => (isToday.value ? (end.value ?? props.now) : end.value))
const dialAria = computed(() => 'Jam kerja ' + duration(worked.value) + ' dari 8 jam')

const primary = computed(() => {
  if (!isToday.value || absence.value || manual.value) return null
  if (start.value === null) return { type: 'masuk' as const, label: 'Catat masuk · ' + clock(props.now) }
  if (end.value === null) return { type: 'keluar' as const, label: 'Catat keluar · ' + clock(props.now) }
  return null
})

const timeValid = computed(() => toMinutes(time.value) !== null)
const disabled = computed(() => props.busy || !props.row)

function sendPrimary() {
  if (primary.value) emit('submit', { type: primary.value.type, time: props.now })
}

function sendTime() {
  const value = toMinutes(time.value)
  if (value !== null) emit('submit', { type: kind.value, time: value })
}

function sendText() {
  const value = text.value.trim()
  if (value) emit('submit', { type: 'kegiatan', text: value })
}

function askAbsence(kind: AbsenceKind) {
  if (start.value !== null) {
    confirming.value = kind
    return
  }
  emit('submit', { type: 'absen', kind })
}

function confirmAbsence() {
  if (confirming.value) emit('submit', { type: 'absen', kind: confirming.value })
  confirming.value = null
}
</script>

<template>
  <section class="clock-card" aria-labelledby="clock-card-title">
    <div class="clock-card-top">
      <span class="clock-eyebrow" :class="'part-' + part.toLowerCase()">
        <AppIcon :name="eyebrowIcon" />
        {{ eyebrow }}
      </span>
      <span class="pill" :class="'pill-' + pill.tone"><span class="pill-dot"></span>{{ pill.text }}</span>
    </div>

    <div class="clock-card-head">
      <h2 id="clock-card-title">{{ title }}</h2>
      <span v-if="isToday" class="clock-now">{{ clock(now) }}</span>
    </div>

    <div v-if="row && !absence" class="clock-body">
      <ClockDial
        :window-start="dialStart"
        :window-end="dialEnd"
        :fill-end="dialFill"
        :marker="dialMarker"
        :label="duration(worked)"
        :warn="short"
        :description="dialAria"
      />
      <dl class="clock-facts">
        <div>
          <span class="fact-icon"><AppIcon name="login" :size="16" /></span>
          <dt>Masuk</dt>
          <dd :class="{ late: row && isLate(row) }">{{ clock(start) }}</dd>
        </div>
        <div>
          <span class="fact-icon"><AppIcon name="logout" :size="16" /></span>
          <dt>Keluar</dt>
          <dd>{{ clock(end) }}</dd>
        </div>
        <div class="accent">
          <span class="fact-icon"><AppIcon name="hourglass" :size="16" /></span>
          <dt>{{ third.label }}</dt>
          <dd>{{ third.value }}</dd>
        </div>
      </dl>
    </div>
    <p v-if="row && !absence" class="clock-hint" :class="hintTone">{{ hint }}</p>

    <button v-if="primary" class="dbtn dbtn-primary dbtn-lg" :disabled="disabled" @click="sendPrimary">
      <AppIcon name="clock" />
      {{ busy ? 'Menyimpan…' : primary.label }}
    </button>

    <div v-if="manual" class="manual">
      <div class="segmented" role="radiogroup" aria-label="Jenis jam">
        <button type="button" role="radio" :aria-checked="kind === 'masuk'" @click="kind = 'masuk'">Masuk</button>
        <button type="button" role="radio" :aria-checked="kind === 'keluar'" @click="kind = 'keluar'">Keluar</button>
      </div>
      <label class="dlabel">
        Jam
        <input v-model="time" class="dinput" type="time" />
      </label>
      <button class="dbtn dbtn-primary" type="button" :disabled="disabled || !timeValid" @click="sendTime">
        {{ busy ? 'Menyimpan…' : 'Simpan jam ' + kind }}
      </button>
    </div>
    <button v-else-if="row && !absence" class="dbtn dbtn-ghost" @click="manual = true">Atur jam manual</button>

    <div class="clock-field">
      <label class="dlabel" for="kegiatan">Kegiatan</label>
      <textarea id="kegiatan" v-model="text" class="dinput" rows="3" placeholder="Tulis kegiatan hari ini…"></textarea>
      <div class="clock-field-actions">
        <button class="dbtn" :disabled="disabled || text.trim() === ''" @click="sendText">Simpan kegiatan</button>
      </div>
    </div>

    <div class="clock-field clock-absence">
      <span class="dlabel">Tidak hadir?</span>
      <div class="segmented" role="group" aria-label="Tidak hadir">
        <button :disabled="disabled" @click="askAbsence('sakit')">Sakit</button>
        <button :disabled="disabled" @click="askAbsence('izin')">Izin</button>
        <button :disabled="disabled" @click="askAbsence('cuti')">Cuti</button>
      </div>
      <div v-if="confirming" class="confirm" role="alertdialog" aria-label="Konfirmasi tidak hadir">
        <p>Sudah ada jam masuk {{ clock(start) }}. Ganti jadi {{ ABSENCE_LABEL[confirming] }}? Jam masuk dan keluar akan dihapus.</p>
        <div class="confirm-actions">
          <button class="dbtn dbtn-warn" :disabled="busy" @click="confirmAbsence">Ya, ganti</button>
          <button class="dbtn" @click="confirming = null">Batal</button>
        </div>
      </div>
    </div>

    <button v-if="!isToday" class="dbtn dbtn-ghost" @click="emit('back')">← Kembali ke hari ini</button>
  </section>
</template>
