<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PromptCard from '../components/PromptCard.vue'
import { api, errorMessage } from '../lib/api'
import { formatMinutes, levelLabel, statusLabel, weekPercent } from '../lib/labels'
import { prompts } from '../lib/prompts'
import type { TrackSummary } from '../types'

const tracks = ref<TrackSummary[]>([])
const loading = ref(true)
const error = ref('')

const active = computed(() => tracks.value.filter((t) => t.status === 'aktif'))
const main = computed(() => active.value[0] ?? null)
const lastFinished = computed(() => (main.value ? null : tracks.value.find((t) => t.status === 'selesai') ?? null))
const others = computed(() => tracks.value.filter((t) => t.id !== main.value?.id))
const weekMinutes = computed(() => active.value.reduce((sum, t) => sum + t.minutesThisWeek, 0))
const weekHours = computed(() => active.value.reduce((sum, t) => sum + t.hoursPerWeek, 0))

async function load() {
  loading.value = true
  error.value = ''
  try {
    tracks.value = await api.get<TrackSummary[]>('/tracks')
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="head atlas-head">
    <div>
      <span class="kicker">Atlas belajar</span>
      <h1>Jalur belajar<span class="atlas-dot">.</span></h1>
      <p v-if="active.length" class="muted">Minggu ini {{ formatMinutes(weekMinutes) }} dari {{ weekHours }} jam target, di semua jalur aktif.</p>
      <p v-else class="muted">Progres dihitung Senin sampai Minggu.</p>
    </div>
    <RouterLink to="/tracks/new" class="button primary">Buat jalur</RouterLink>
    <svg class="atlas-route" viewBox="0 0 1000 16" preserveAspectRatio="none" aria-hidden="true">
      <path d="M 0 8 C 160 2, 300 14, 480 9 S 800 2, 1000 10" />
    </svg>
  </div>

  <div v-if="loading" class="state"><span class="spinner" />Memuat jalur...</div>

  <div v-else-if="error" class="error">
    {{ error }}
    <div class="mt-2"><button @click="load">Coba lagi</button></div>
  </div>

  <div v-else-if="!tracks.length" class="card state">
    <p>Belum ada jalur belajar. Minta Claude menyusunkannya untukmu.</p>
    <RouterLink to="/tracks/new" class="button primary">Buat jalur pertama</RouterLink>
  </div>

  <template v-else>
    <section v-if="main" class="card hero">
      <div class="ring" :style="{ '--p': weekPercent(main.minutesThisWeek, main.hoursPerWeek) }">
        <div>
          <strong>{{ weekPercent(main.minutesThisWeek, main.hoursPerWeek) }}%</strong>
          <span class="small muted">{{ formatMinutes(main.minutesThisWeek) }}</span>
        </div>
      </div>
      <div>
        <span class="kicker">Lanjutkan</span>
        <h2>{{ main.goal }}</h2>
        <p class="mb-4">
          {{ levelLabel[main.currentLevel] }} · {{ main.topicsDone }}/{{ main.topicCount }} topik selesai · target {{ main.hoursPerWeek }} jam/minggu
        </p>
        <div class="row">
          <RouterLink :to="`/tracks/${main.id}`" class="button primary">Lanjutkan</RouterLink>
        </div>
      </div>
    </section>

    <PromptCard
      v-if="lastFinished"
      title="Semua jalur aktif sudah selesai. Mau belajar apa berikutnya?"
      :prompt="prompts.finished(lastFinished.goal)"
    />

    <section v-if="others.length" class="section">
      <h2>{{ main ? 'Jalur lain' : 'Semua jalur' }}</h2>
      <div class="cards">
        <RouterLink
          v-for="t in others"
          :key="t.id"
          :to="`/tracks/${t.id}`"
          class="card"
          :class="{ dim: t.status !== 'aktif' }"
        >
          <div class="row spread top nowrap">
            <h3 class="title-sm">{{ t.goal }}</h3>
            <span class="badge" :class="t.status">{{ statusLabel[t.status] }}</span>
          </div>
          <span class="muted small">{{ levelLabel[t.currentLevel] }} · {{ t.topicsDone }}/{{ t.topicCount }} topik selesai</span>
          <div class="small">
            Minggu ini: {{ formatMinutes(t.minutesThisWeek) }} dari {{ t.hoursPerWeek }} jam
            <div class="progress"><div :style="{ width: `${weekPercent(t.minutesThisWeek, t.hoursPerWeek)}%` }" /></div>
          </div>
        </RouterLink>
      </div>
    </section>
  </template>
</template>
