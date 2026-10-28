<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ExerciseView from '../components/ExerciseView.vue'
import LessonView from '../components/LessonView.vue'
import PromptCard from '../components/PromptCard.vue'
import { api, errorMessage } from '../lib/api'
import { statusLabel } from '../lib/labels'
import { prompts } from '../lib/prompts'
import { useStudyTimer } from '../lib/timer'
import type { CompleteResult, TopicDetail } from '../types'

const props = defineProps<{ id: string }>()

const topic = ref<TopicDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const ready = ref(false)
const durationMin = ref(60)
const completing = ref(false)
const completeError = ref('')
const result = ref<CompleteResult | null>(null)
const durationEdited = ref(false)
const logging = ref(false)
const logged = ref('')
const timer = useStudyTimer(props.id)

const done = computed(() => topic.value?.status === 'selesai' || topic.value?.status === 'sudah_bisa')
const next = computed(() => result.value?.nextTopic ?? topic.value?.nextTopic ?? null)

watch(
  timer.minutes,
  (minutes) => {
    if (!durationEdited.value) durationMin.value = Math.min(600, Math.max(1, minutes))
  },
  { immediate: true },
)

watch(done, (value) => value && timer.pause())

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    topic.value = await api.get<TopicDetail>(`/topics/${props.id}`)
  } catch (err) {
    loadError.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function complete() {
  if (!topic.value) return
  completing.value = true
  completeError.value = ''
  try {
    result.value = await api.post<CompleteResult>(`/topics/${props.id}/complete`, { durationMin: durationMin.value })
    topic.value.status = 'selesai'
    timer.reset()
  } catch (err) {
    completeError.value = errorMessage(err)
  } finally {
    completing.value = false
  }
}

async function logSession() {
  completing.value = true
  logging.value = true
  completeError.value = ''
  logged.value = ''
  try {
    await api.post(`/topics/${props.id}/session`, { durationMin: durationMin.value })
    logged.value = `${durationMin.value} menit tercatat. Item belajar di Jadwal hari ini ikut selesai dalam 10 menit.`
    timer.reset()
    durationEdited.value = false
    durationMin.value = 1
  } catch (err) {
    completeError.value = errorMessage(err)
  } finally {
    completing.value = false
    logging.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="state"><span class="spinner" />Memuat topik...</div>

  <div v-else-if="loadError" class="error">
    {{ loadError }}
    <div class="row mt-2">
      <button @click="load">Coba lagi</button>
      <RouterLink to="/">Kembali ke daftar</RouterLink>
    </div>
  </div>

  <div v-else-if="topic" class="narrow">
    <RouterLink :to="`/tracks/${topic.track.id}`" class="back">← {{ topic.track.goal }}</RouterLink>
    <span class="kicker">Topik {{ topic.order }}</span>
    <h1>{{ topic.title }}</h1>
    <div class="row">
      <span class="badge" :class="topic.status">{{ statusLabel[topic.status] }}</span>
      <span class="badge">± {{ topic.estSessions }} sesi 60 menit</span>
    </div>
    <p class="lead">{{ topic.objective }}</p>

    <template v-if="topic.summary && topic.exercise">
      <section class="section">
        <div class="step"><span class="dot sage">1</span><h2>Pahami</h2></div>
        <LessonView :summary="topic.summary" />
        <div v-if="topic.sources.length" class="sources mt-4">
          <a v-for="s in topic.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="card">
            <span class="host">{{ hostOf(s.url) }} ↗</span>
            <strong>{{ s.title }}</strong>
          </a>
        </div>
      </section>

      <section class="section">
        <div class="step"><span class="dot accent">2</span><h2>Latihan</h2></div>
        <ExerciseView :topic-id="topic.id" :exercise="topic.exercise" :last="topic.lastAttempt" @ready="ready = $event" />
      </section>
    </template>

    <section v-else class="section">
      <p class="muted">Topik ini belum punya penjelasan dan latihan. Minta Claude melengkapinya:</p>
      <PromptCard title="Lengkapi topik ini" :prompt="prompts.fill(topic.title, topic.track.goal, topic.id)" />
    </section>

    <section class="section">
      <div class="step"><span class="dot">3</span><h2>Selesai</h2></div>
      <div v-if="done" class="success">
        ✓ Topik selesai.
        <template v-if="result?.trackDone">Semua topik di jalur ini sudah selesai.</template>
      </div>
      <template v-else>
        <div class="timer row gap-3">
          <span class="figure">{{ timer.clock.value }}</span>
          <span class="small muted">{{ timer.running.value ? 'Tetap berjalan walau halaman ditutup, termasuk saat di Claude atau editor' : 'Timer berhenti' }}</span>
          <button v-if="timer.running.value" type="button" @click="timer.pause">Jeda</button>
          <button v-else type="button" @click="timer.start">{{ timer.minutes.value ? 'Lanjut' : 'Mulai belajar' }}</button>
        </div>
        <form class="row bottom gap-3" @submit.prevent="complete">
          <label>
            Lama belajar (menit)
            <input v-model.number="durationMin" type="number" min="1" max="600" required @input="durationEdited = true" />
          </label>
          <button type="button" :disabled="completing" @click="logSession">
            {{ logging ? 'Menyimpan...' : 'Catat sesi' }}
          </button>
          <button class="primary" type="submit" :disabled="completing || (!!topic.exercise && !ready)">
            {{ completing && !logging ? 'Menyimpan...' : 'Tandai selesai' }}
          </button>
        </form>
        <div v-if="logged" class="success">✓ {{ logged }}</div>
      </template>
      <p v-if="!done && topic.exercise && !ready" class="small muted">
        {{ topic.exercise.type === 'code' && topic.exercise.language === 'javascript' ? 'Bisa ditandai selesai setelah semua tes lulus.' : 'Centang semua daftar cek dulu.' }}
      </p>
      <div v-if="completeError" class="error">{{ completeError }}</div>

      <div v-if="done" class="row mt-4">
        <RouterLink v-if="next" :to="`/topics/${next.id}`" class="button primary">Topik berikutnya: {{ next.title }} →</RouterLink>
        <RouterLink v-else :to="`/tracks/${topic.track.id}`" class="button primary">Lihat jalur →</RouterLink>
      </div>
    </section>
  </div>
</template>
