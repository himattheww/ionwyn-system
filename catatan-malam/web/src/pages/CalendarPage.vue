<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import { addMonths, formatMonth, jakartaNight, monthGrid } from '../lib/dates'
import { useLoad } from '../composables/useLoad'

const route = useRoute()
const router = useRouter()
const tonight = jakartaNight()
const month = computed(() => {
  const value = String(route.query.bulan ?? '')
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : tonight.slice(0, 7)
})

const { data, loading, error, reload } = useLoad(() => api.month(month.value))
onMounted(reload)

const filled = computed(() => new Map((data.value ?? []).map((d) => [d.date, d.isBackfilled])))
const days = computed(() => monthGrid(month.value))
const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const countText = computed(() => (data.value?.length ? `${data.value.length} malam tercatat` : 'Belum ada catatan di bulan ini.'))

const goTo = (offset: number) => router.push({ query: { bulan: addMonths(month.value, offset) } })
</script>

<template>
  <div class="stack">
    <div class="month-nav">
      <h1>{{ formatMonth(month) }}</h1>
      <button class="btn btn-secondary btn-icon" aria-label="Bulan sebelumnya" @click="goTo(-1)">
        <i class="ph ph-caret-left" />
      </button>
      <button class="btn btn-secondary btn-icon" aria-label="Bulan berikutnya" @click="goTo(1)">
        <i class="ph ph-caret-right" />
      </button>
    </div>

    <AsyncState :loading="loading" :error="error" @retry="reload">
      <p class="muted month-count">{{ countText }}</p>
      <div class="calendar">
        <span v-for="w in weekdays" :key="w" class="weekday">{{ w }}</span>
        <template v-for="day in days" :key="day">
          <RouterLink
            v-if="filled.has(day)"
            :to="`/entri/${day}`"
            class="day day-filled"
            :class="{ 'day-late': filled.get(day), 'day-today': day === tonight, 'day-outside': !day.startsWith(month) }"
          >
            {{ Number(day.slice(8)) }}<span class="day-dot" />
          </RouterLink>
          <span v-else class="day" :class="{ 'day-outside': !day.startsWith(month), 'day-today': day === tonight }">
            {{ Number(day.slice(8)) }}<span class="day-dot" />
          </span>
        </template>
      </div>
      <div class="legend">
        <span><i class="swatch swatch-filled" /> Terisi</span>
        <span><i class="swatch swatch-late" /> Diisi belakangan</span>
        <span><i class="swatch swatch-today" /> Malam ini</span>
      </div>
    </AsyncState>
  </div>
</template>
