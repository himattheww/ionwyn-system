<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import { dayParts, formatDate, jakartaNight, monthRange, weekRange } from '../lib/dates'
import { useLoad } from '../composables/useLoad'

const props = defineProps<{ kind: 'lessons' | 'good-things' }>()

const title = props.kind === 'lessons' ? 'Pelajaran' : 'Hal baik'
const icon = props.kind === 'lessons' ? 'ph-lightbulb' : 'ph-sun'
const tonight = jakartaNight()

type Filter = 'all' | 'week' | 'month' | 'range'
const filter = ref<Filter>('month')
const rangeFrom = ref('')
const rangeTo = ref('')
const filters: { value: Filter; label: string }[] = [
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'range', label: 'Rentang' },
  { value: 'all', label: 'Semua' },
]

const range = computed(() => {
  if (filter.value === 'week') return weekRange(tonight)
  if (filter.value === 'month') return monthRange(tonight)
  if (filter.value === 'range') return { from: rangeFrom.value || undefined, to: rangeTo.value || undefined }
  return { from: undefined, to: undefined }
})

const { data, loading, error, reload } = useLoad(() => {
  const { from, to } = range.value
  return props.kind === 'lessons' ? api.lessons(from, to) : api.goodThings(from, to)
})
onMounted(reload)

function pick(value: Filter) {
  filter.value = value
  if (value !== 'range') reload()
}

const subtitle = computed(() => {
  const { from, to } = range.value
  const span = from && to ? `${formatDate(from)} – ${formatDate(to)}` : 'Semua catatan'
  return data.value ? `${span} · ${data.value.length} catatan` : span
})

const emptyText = computed(() => {
  const what = props.kind === 'lessons' ? 'pelajaran' : 'hal baik'
  if (filter.value === 'week') return `Belum ada ${what} minggu ini.`
  if (filter.value === 'month') return `Belum ada ${what} bulan ini.`
  if (filter.value === 'range') return `Tidak ada ${what} di rentang tanggal ini.`
  return `Belum ada ${what}.`
})
</script>

<template>
  <div class="stack">
    <div class="hero">
      <h1 class="title-icon"><i class="ph" :class="icon" />{{ title }}</h1>
      <p class="muted">{{ subtitle }}</p>
    </div>

    <div class="seg" role="group" aria-label="Filter">
      <button
        v-for="f in filters"
        :key="f.value"
        class="seg-opt"
        :class="{ 'seg-active': filter === f.value }"
        :aria-pressed="filter === f.value"
        @click="pick(f.value)"
      >
        {{ f.label }}
      </button>
    </div>

    <form v-if="filter === 'range'" class="range" @submit.prevent="reload">
      <label class="field">Dari <input v-model="rangeFrom" class="input" type="date" /></label>
      <label class="field">Sampai <input v-model="rangeTo" class="input" type="date" :min="rangeFrom || undefined" /></label>
      <button class="btn btn-primary">Terapkan</button>
    </form>

    <AsyncState :loading="loading" :error="error" :empty="!data?.length" :empty-text="emptyText" @retry="reload">
      <ul class="list list-loose">
        <li v-for="item in data" :key="item.date">
          <RouterLink :to="`/entri/${item.date}`" class="dated">
            <span class="dated-chip">
              <span class="dated-day">{{ dayParts(item.date).day }}</span>
              <span class="dated-month">{{ dayParts(item.date).month }}</span>
            </span>
            <span class="dated-body">
              <small>{{ dayParts(item.date).weekday }}</small>
              <span class="prose">{{ item.text }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </AsyncState>
  </div>
</template>
