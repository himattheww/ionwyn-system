<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { fetchMonth, loadSettings, saveSettings, sendEntry, viaHub } from './lib/api'
import AppIcon from './components/AppIcon.vue'
import DayList from './components/DayList.vue'
import MonthSummary from './components/MonthSummary.vue'
import WallClock from './components/WallClock.vue'
import SettingsForm from './components/SettingsForm.vue'
import TodayCard from './components/TodayCard.vue'
import { firstOfMonth, isoOf, monthName, nowMinutes, shiftMonth } from './lib/format'
import type { Entry, MonthData, Settings } from './types'

const settings = ref<Settings>(loadSettings())
const connected = computed(() => viaHub || (settings.value.url !== '' && settings.value.apiKey !== ''))
const showSettings = ref(!connected.value)
const tab = ref<'today' | 'harian'>('today')
const openTab = (next: 'today' | 'harian') => {
  tab.value = next
  showSettings.value = false
}

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
  tab.value = 'today'
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
  ticker = window.setInterval(() => {
    now.value = nowMinutes()
    today.value = isoOf(new Date())
  }, 30000)
  if (!showSettings.value) load(selected.value)
})

onUnmounted(() => {
  clearInterval(ticker)
  clearTimeout(noticeTimer)
})
</script>

<template>
  <div class="app">
    <nav class="subnav" aria-label="Halaman Timesheet">
      <a href="#hari-ini" :aria-current="!showSettings && tab === 'today' ? 'page' : undefined" @click.prevent="openTab('today')">Hari ini</a>
      <a href="#harian" :aria-current="!showSettings && tab === 'harian' ? 'page' : undefined" @click.prevent="openTab('harian')">Harian</a>
      <a href="#koneksi" :aria-current="showSettings ? 'page' : undefined" @click.prevent="showSettings = true">
        Koneksi<span class="status-dot" :class="{ off: !connected }" :aria-label="connected ? 'terhubung' : 'belum terhubung'"></span>
      </a>
    </nav>

    <div class="page">
      <header v-if="showSettings" class="hero">
        <div>
          <p class="eyebrow">Penghubung data</p>
          <h1>Koneksi</h1>
        </div>
      </header>
      <header v-else-if="tab === 'today'" class="hero">
        <div>
          <p class="eyebrow">Kartu absen · {{ monthName(view.month) }} {{ view.year }}</p>
          <h1>Timesheet</h1>
        </div>
        <WallClock />
      </header>
      <header v-else class="hero">
        <div>
          <p class="eyebrow">Rekap kartu absen</p>
          <h1>{{ monthName(view.month) }} {{ view.year }}</h1>
        </div>
        <div class="month-nav">
          <button class="icon-btn" :disabled="busy" aria-label="Bulan sebelumnya" @click="step(-1)"><AppIcon name="chevron-left" /></button>
          <button class="icon-btn" :disabled="busy" aria-label="Bulan berikutnya" @click="step(1)"><AppIcon name="chevron-right" /></button>
        </div>
      </header>

      <SettingsForm v-if="showSettings" :initial="settings" @save="applySettings" @cancel="showSettings = false" />

      <p v-if="failure" class="banner error" role="alert">{{ failure }}</p>
      <p v-else-if="notice" class="banner" role="status"><AppIcon name="check" />{{ notice }}</p>

      <main v-if="!showSettings && tab === 'today'" class="layout">
        <TodayCard :date="selected" :row="currentRow" :today="today" :now="now" :busy="busy" @submit="submit" @back="backToToday" />
        <MonthSummary v-if="month" :days="month.days" :count="month.count" :month="month.month" :today="today" />
        <p v-else-if="busy" class="card empty">Memuat data bulan ini…</p>
      </main>

      <main v-else-if="!showSettings" class="stack-page">
        <MonthSummary v-if="month" :days="month.days" :count="month.count" :month="month.month" :today="today" />
        <DayList v-if="month" :days="month.days" :selected="selected" :today="today" :now="now" @select="selectDate" />
        <p v-else-if="busy" class="card empty">Memuat data bulan ini…</p>
        <p v-else-if="!failure" class="card empty">Belum ada data.</p>
      </main>
    </div>
  </div>
</template>
