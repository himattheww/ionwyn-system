<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchMonth, loadSettings, saveSettings, sendEntry, viaHub } from './lib/api'
import AppIcon from './components/AppIcon.vue'
import DayList from './components/DayList.vue'
import MonthSummary from './components/MonthSummary.vue'
import SettingsForm from './components/SettingsForm.vue'
import TodayCard from './components/TodayCard.vue'
import { clock, firstOfMonth, isoOf, monthName, nowMinutes, shiftMonth } from './lib/format'
import type { Entry, MonthData, Settings } from './types'

const settings = ref<Settings>(loadSettings())
const connected = computed(() => viaHub || (settings.value.url !== '' && settings.value.apiKey !== ''))
const showSettings = ref(!connected.value)

const today = ref(isoOf(new Date()))
const selected = ref(today.value)
const month = ref<MonthData | null>(null)
const busy = ref(false)
const notice = ref('')
const failure = ref('')
const now = ref(nowMinutes())

const view = ref({ year: Number(today.value.slice(0, 4)), month: Number(today.value.slice(5, 7)) })

const currentRow = computed(() => month.value?.days.find((day) => day.date === selected.value))

let ticker: number | undefined
let noticeTimer: number | undefined

function flash(message: string) {
  notice.value = message
  clearTimeout(noticeTimer)
  if (message) noticeTimer = window.setTimeout(() => (notice.value = ''), 4000)
}

async function run(task: () => Promise<void>) {
  busy.value = true
  failure.value = ''
  try {
    await task()
  } catch (err) {
    failure.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function load(date: string) {
  return run(async () => {
    const result = await fetchMonth(date)
    month.value = result.month
    today.value = result.today
  })
}

function goToMonth(year: number, monthNumber: number) {
  view.value = { year, month: monthNumber }
  const isCurrent = today.value.startsWith(firstOfMonth(year, monthNumber).slice(0, 7))
  selected.value = isCurrent ? today.value : firstOfMonth(year, monthNumber)
  flash('')
  load(selected.value)
}

function step(delta: number) {
  const next = shiftMonth(view.value.year, view.value.month, delta)
  goToMonth(next.year, next.month)
}

function selectDate(date: string) {
  selected.value = date
  flash('')
}

function backToToday() {
  if (today.value.slice(0, 7) === selected.value.slice(0, 7)) {
    selectDate(today.value)
    return
  }
  goToMonth(Number(today.value.slice(0, 4)), Number(today.value.slice(5, 7)))
}

function submit(entry: Entry) {
  return run(async () => {
    const result = await sendEntry(selected.value, entry)
    month.value = result.month
    today.value = result.today
    flash(result.message ?? 'Tersimpan ke Sheets')
  })
}

function applySettings(next: Settings) {
  saveSettings(next)
  settings.value = next
  showSettings.value = false
  load(selected.value)
}

onMounted(() => {
  ticker = window.setInterval(() => (now.value = nowMinutes()), 30000)
  if (!showSettings.value) load(selected.value)
})

onUnmounted(() => {
  clearInterval(ticker)
  clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <svg class="brand-mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
          <rect width="34" height="34" rx="9" />
          <circle cx="17" cy="17" r="10" fill="none" stroke="#fff" stroke-width="2" />
          <path d="M17 17V10.5" stroke="#fff" stroke-width="2" stroke-linecap="round" />
          <path d="M17 17l4.5 2.5" stroke="#7f9bea" stroke-width="2" stroke-linecap="round" />
          <circle cx="17" cy="17" r="1.6" fill="#fff" />
        </svg>
        <div class="brand-text">
          <strong>Timesheet</strong>
          <span>Absensi harian · Google Sheets</span>
        </div>
      </div>

      <div class="month-nav">
        <button class="icon-btn" :disabled="busy" aria-label="Bulan sebelumnya" @click="step(-1)"><AppIcon name="chevron-left" /></button>
        <h1><AppIcon name="calendar" class="muted" />{{ monthName(view.month) }} {{ view.year }}</h1>
        <button class="icon-btn" :disabled="busy" aria-label="Bulan berikutnya" @click="step(1)"><AppIcon name="chevron-right" /></button>
      </div>

      <div class="topbar-end">
        <span class="now-chip mono"><AppIcon name="clock" :size="16" />{{ clock(now) }} WIB</span>
        <button
          class="icon-btn"
          :aria-label="connected ? 'Pengaturan koneksi, terhubung' : 'Pengaturan koneksi, belum terhubung'"
          :aria-expanded="showSettings"
          @click="showSettings = !showSettings"
        >
          <AppIcon name="gear" />
          <span class="status-dot" :class="{ off: !connected }"></span>
        </button>
      </div>
    </header>

    <SettingsForm v-if="showSettings" :initial="settings" @save="applySettings" @cancel="showSettings = false" />

    <p v-if="failure" class="banner error" role="alert">{{ failure }}</p>
    <p v-else-if="notice" class="banner" role="status"><AppIcon name="check" />{{ notice }}</p>

    <main v-if="!showSettings || connected" class="layout">
      <div class="side">
        <TodayCard :date="selected" :row="currentRow" :today="today" :now="now" :busy="busy" @submit="submit" @back="backToToday" />
        <MonthSummary v-if="month" :days="month.days" :count="month.count" :month="month.month" :today="today" />
      </div>

      <DayList v-if="month" :days="month.days" :selected="selected" :today="today" :now="now" @select="selectDate" />
      <p v-else-if="busy" class="card empty">Memuat data bulan ini…</p>
      <p v-else-if="!failure" class="card empty">Belum ada data.</p>
    </main>
  </div>
</template>
