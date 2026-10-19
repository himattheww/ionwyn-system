<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, errorMessage } from '../lib/api'
import { difficultyLabel, statusLabel } from '../lib/labels'
import type { Difficulty, StudyCase, TopicDetail } from '../types'

const props = defineProps<{ id: string }>()

const topic = ref<TopicDetail | null>(null)
const loading = ref(true)
const loadError = ref('')
const generating = ref<Difficulty | null>(null)
const completing = ref(false)
const actionError = ref('')
const resultLink = ref('')

const levels: Difficulty[] = ['mudah', 'sedang', 'sulit']
const studyCase = computed(() => topic.value?.studyCase ?? null)
const levelIndex = computed(() => (studyCase.value ? levels.indexOf(studyCase.value.difficulty) : -1))
const isDoneCase = computed(() => studyCase.value?.status === 'selesai')

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function canPick(i: number) {
  return !generating.value && !isDoneCase.value && Math.abs(i - levelIndex.value) === 1
}

async function generate(difficulty: Difficulty) {
  if (!topic.value) return
  if (studyCase.value && !confirm('Study case sekarang akan diganti. Lanjut?')) return
  actionError.value = ''
  generating.value = difficulty
  try {
    topic.value.studyCase = await api.post<StudyCase>(`/topics/${props.id}/study-case`, { difficulty })
    topic.value.status = 'sedang'
  } catch (err) {
    actionError.value = errorMessage(err)
  } finally {
    generating.value = null
  }
}

async function complete() {
  if (!topic.value) return
  actionError.value = ''
  completing.value = true
  try {
    topic.value.studyCase = await api.post<StudyCase>(`/topics/${props.id}/study-case/complete`, {
      resultLink: resultLink.value.trim(),
    })
    topic.value.status = 'selesai'
  } catch (err) {
    actionError.value = errorMessage(err)
  } finally {
    completing.value = false
  }
}

onMounted(load)

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

    <section class="section">
      <div class="step"><span class="dot sage">1</span><h2>Pahami dari sumber resmi</h2></div>
      <p class="muted small mb-3">Materi tidak ditulis AI. Semua tautan sudah dicek dan bisa dibuka.</p>
      <p v-if="!topic.sources.length" class="muted">Tidak ada sumber yang lolos pengecekan.</p>
      <div v-else class="sources">
        <a v-for="s in topic.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="card">
          <span class="host">{{ hostOf(s.url) }} ↗</span>
          <strong>{{ s.title }}</strong>
        </a>
      </div>
      <div v-if="topic.prerequisites.length" class="row small mt-4">
        <span class="muted">Prasyarat:</span>
        <span v-for="p in topic.prerequisites" :key="p" class="badge outline">{{ p }}</span>
      </div>
    </section>

    <section class="section">
      <div class="step"><span class="dot accent">2</span><h2>Kerjakan study case</h2></div>
      <div v-if="actionError" class="error">{{ actionError }}</div>
      <div v-if="generating" class="notice">
        <span class="spinner" />AI sedang membuat study case ({{ difficultyLabel[generating] }}), bisa 10-30 detik...
      </div>

      <div v-if="!studyCase" class="card state">
        <p>Belum ada study case untuk topik ini.</p>
        <button class="primary" :disabled="!!generating" @click="generate('sedang')">Buat study case</button>
      </div>

      <div v-else class="card card-roomy">
        <div class="row spread top gap-4">
          <div>
            <h3>{{ studyCase.title }}</h3>
            <span class="muted small">± {{ studyCase.estSessions }} sesi · {{ statusLabel[studyCase.status] }}</span>
          </div>
          <div class="stack-tight">
            <span class="muted small">Tingkat kesulitan</span>
            <div class="seg">
              <button
                v-for="(l, i) in levels"
                :key="l"
                :class="{ on: studyCase.difficulty === l }"
                :disabled="studyCase.difficulty === l || !canPick(i)"
                @click="generate(l)"
              >
                {{ difficultyLabel[l] }}
              </button>
            </div>
          </div>
        </div>

        <div class="block">
          <span class="kicker">Skenario</span>
          <p class="prose">{{ studyCase.scenario }}</p>
        </div>

        <div class="block">
          <span class="kicker">Requirement</span>
          <ol><li v-for="r in studyCase.requirements" :key="r">{{ r }}</li></ol>
        </div>

        <div class="block">
          <span class="kicker sage">Kriteria selesai</span>
          <ul class="checks"><li v-for="a in studyCase.acceptanceCriteria" :key="a">{{ a }}</li></ul>
        </div>

        <div v-if="studyCase.stretchGoals.length" class="block stretch">
          <span class="kicker kicker-muted">Tantangan tambahan</span>
          <ul class="small"><li v-for="s in studyCase.stretchGoals" :key="s">{{ s }}</li></ul>
        </div>
      </div>
    </section>

    <section v-if="studyCase" class="section">
      <div class="step"><span class="dot">3</span><h2>Tandai selesai</h2></div>
      <div v-if="isDoneCase" class="success">
        ✓ Study case selesai.
        <template v-if="studyCase.resultLink">
          Hasil: <a :href="studyCase.resultLink" target="_blank" rel="noopener">{{ studyCase.resultLink }}</a>
        </template>
      </div>
      <form v-else class="row bottom gap-3" @submit.prevent="complete">
        <label class="grow">
          Link hasil
          <span class="hint">Opsional. Contoh: repo GitHub, dokumen, rekaman.</span>
          <input v-model="resultLink" type="url" placeholder="https://github.com/..." :disabled="completing" />
        </label>
        <button class="primary" type="submit" :disabled="completing || !!generating">
          {{ completing ? 'Menyimpan...' : 'Selesai' }}
        </button>
      </form>
    </section>
  </div>
</template>
