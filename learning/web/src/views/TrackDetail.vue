<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '../lib/api'
import { difficultyLabel, formatDate, formatMinutes, levelLabel, statusLabel, weekPercent } from '../lib/labels'
import type { TrackDetail, TrackStatus } from '../types'

const props = defineProps<{ id: string }>()

const track = ref<TrackDetail | null>(null)
const loading = ref(true)
const error = ref('')
const statusError = ref('')
const confirmingDelete = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const router = useRouter()

const statuses: { value: TrackStatus; label: string }[] = [
  { value: 'aktif', label: 'Aktif' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'arsip', label: 'Arsip' },
]

const doneCount = computed(
  () => track.value?.topics.filter((t) => t.status === 'selesai' || t.status === 'sudah_bisa').length ?? 0,
)
const currentId = computed(
  () => track.value?.topics.find((t) => t.status === 'sedang')?.id ?? track.value?.topics.find((t) => t.status === 'belum')?.id,
)
const isDone = (status: string) => status === 'selesai' || status === 'sudah_bisa'

async function load() {
  loading.value = true
  error.value = ''
  try {
    track.value = await api.get<TrackDetail>(`/tracks/${props.id}`)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function changeStatus(status: TrackStatus) {
  if (!track.value || track.value.status === status) return
  const previous = track.value.status
  statusError.value = ''
  track.value.status = status
  try {
    await api.patch(`/tracks/${props.id}`, { status })
  } catch (err) {
    track.value.status = previous
    statusError.value = errorMessage(err)
  }
}

async function remove() {
  deleting.value = true
  deleteError.value = ''
  try {
    await api.delete(`/tracks/${props.id}`)
    router.push('/')
  } catch (err) {
    deleteError.value = errorMessage(err)
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="state"><span class="spinner" />Memuat jalur...</div>

  <div v-else-if="error" class="error">
    {{ error }}
    <div class="row mt-2">
      <button @click="load">Coba lagi</button>
      <RouterLink to="/">Kembali ke daftar</RouterLink>
    </div>
  </div>

  <template v-else-if="track">
    <RouterLink to="/" class="back">← Semua jalur</RouterLink>
    <div class="head">
      <div>
        <h1>{{ track.goal }}</h1>
        <div class="row">
          <span class="badge">{{ levelLabel[track.currentLevel] }}</span>
          <span class="badge">Target {{ track.hoursPerWeek }} jam/minggu</span>
          <span v-if="track.domainHint" class="badge">Domain: {{ track.domainHint }}</span>
        </div>
      </div>
      <div class="row">
        <div class="seg">
          <button
            v-for="s in statuses"
            :key="s.value"
            :class="{ on: track.status === s.value }"
            :disabled="track.status === s.value"
            @click="changeStatus(s.value)"
          >
            {{ s.label }}
          </button>
        </div>
        <RouterLink :to="`/sessions/new?trackId=${track.id}`" class="button primary">Catat sesi</RouterLink>
      </div>
    </div>

    <div v-if="statusError" class="error">{{ statusError }}</div>

    <div class="layout">
      <section>
        <h2>Urutan topik</h2>
        <div v-if="!track.topics.length" class="card state">Jalur ini belum punya topik.</div>
        <div v-else class="path">
          <div
            v-for="t in track.topics"
            :key="t.id"
            class="path-item"
            :class="{ done: isDone(t.status), current: t.id === currentId, known: t.status === 'sudah_bisa' }"
          >
            <div class="path-rail">
              <span class="dot" :class="t.status">{{ isDone(t.status) ? '✓' : t.order }}</span>
            </div>
            <RouterLink :to="`/topics/${t.id}`" class="path-body">
              <div class="shrink">
                <strong>{{ t.title }}</strong>
                <span class="muted small">{{ t.objective }}</span>
                <span v-if="t.studyCase" class="case-line">
                  Study case: {{ difficultyLabel[t.studyCase.difficulty] }} · {{ statusLabel[t.studyCase.status] }}
                </span>
              </div>
              <span class="badge" :class="t.status">{{ statusLabel[t.status] }}</span>
            </RouterLink>
          </div>
        </div>
      </section>

      <aside>
        <div class="card">
          <span class="kicker sage">Progres minggu ini</span>
          <div class="row nowrap gap-4 week-row">
            <div class="ring sm" :style="{ '--p': weekPercent(track.minutesThisWeek, track.hoursPerWeek) }">
              <div><strong>{{ weekPercent(track.minutesThisWeek, track.hoursPerWeek) }}%</strong></div>
            </div>
            <div>
              <strong class="figure">{{ formatMinutes(track.minutesThisWeek) }}</strong>
              <div class="muted small">dari {{ track.hoursPerWeek }} jam</div>
            </div>
          </div>
          <span class="small">{{ doneCount }} dari {{ track.topics.length }} topik selesai</span>
        </div>

        <div class="card">
          <span class="kicker sage">Riwayat sesi</span>
          <div v-if="!track.sessions.length" class="muted small">
            Belum ada sesi tercatat.
            <div class="mt-2"><RouterLink :to="`/sessions/new?trackId=${track.id}`">Catat sesi pertama</RouterLink></div>
          </div>
          <div v-else class="sessions">
            <div v-for="s in track.sessions" :key="s.id">
              <div class="meta"><span>{{ formatDate(s.occurredAt) }}</span><strong>{{ formatMinutes(s.durationMin) }}</strong></div>
              <span class="small">{{ s.summary }}</span>
              <span v-if="s.topicTitle" class="t">{{ s.topicTitle }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <span class="kicker">Hapus jalur</span>
          <template v-if="!confirmingDelete">
            <span class="small muted">Menghapus jalur beserta topik, study case, dan riwayat sesinya.</span>
            <button class="danger" @click="confirmingDelete = true">Hapus jalur</button>
          </template>
          <template v-else>
            <span class="small">
              Hapus "{{ track.goal }}"?
              <template v-if="track.sessions.length">
                {{ track.sessions.length }} sesi ikut terhapus, dan exp Leveling dari sesi itu hilang saat dihitung ulang.
              </template>
              Tidak bisa dibatalkan.
            </span>
            <div class="row">
              <button class="danger" :disabled="deleting" @click="remove">{{ deleting ? 'Menghapus...' : 'Ya, hapus' }}</button>
              <button :disabled="deleting" @click="confirmingDelete = false">Batal</button>
            </div>
          </template>
          <div v-if="deleteError" class="error">{{ deleteError }}</div>
        </div>
      </aside>
    </div>
  </template>
</template>
