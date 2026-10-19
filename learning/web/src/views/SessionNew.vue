<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, errorMessage } from '../lib/api'
import { todayLocal } from '../lib/labels'
import type { TrackDetail, TrackSummary } from '../types'

const route = useRoute()
const router = useRouter()

const tracks = ref<TrackSummary[]>([])
const topics = ref<TrackDetail['topics']>([])
const loading = ref(true)
const loadingTopics = ref(false)
const saving = ref(false)
const error = ref('')

const presets = [30, 45, 60, 90]

const form = reactive({
  occurredAt: todayLocal(),
  trackId: Number(route.query.trackId) || 0,
  topicId: 0,
  durationMin: 60,
  summary: '',
})

async function loadTracks() {
  loading.value = true
  error.value = ''
  try {
    tracks.value = await api.get<TrackSummary[]>('/tracks')
    if (!tracks.value.some((t) => t.id === form.trackId)) form.trackId = tracks.value.find((t) => t.status === 'aktif')?.id ?? 0
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadTopics(trackId: number) {
  form.topicId = 0
  topics.value = []
  if (!trackId) return
  loadingTopics.value = true
  try {
    topics.value = (await api.get<TrackDetail>(`/tracks/${trackId}`)).topics
    form.topicId = topics.value.find((t) => t.status === 'sedang')?.id ?? 0
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loadingTopics.value = false
  }
}

watch(() => form.trackId, loadTopics)

async function save() {
  error.value = ''
  saving.value = true
  try {
    await api.post('/sessions', {
      trackId: form.trackId,
      topicId: form.topicId || null,
      occurredAt: form.occurredAt,
      durationMin: form.durationMin,
      summary: form.summary,
    })
    router.push(`/tracks/${form.trackId}`)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const initial = form.trackId
  await loadTracks()
  if (form.trackId === initial) await loadTopics(form.trackId)
})
</script>

<template>
  <div class="narrow narrow-sm">
    <div class="head">
      <div>
        <h1>Catat sesi</h1>
        <p class="muted">Durasi masuk ke progres minggu dari tanggal sesi.</p>
      </div>
    </div>

    <div v-if="loading" class="state"><span class="spinner" />Memuat jalur...</div>

    <template v-else>
      <div v-if="error" class="error">{{ error }}</div>

      <div v-if="!tracks.length && !error" class="card state">
        <p>Belum ada jalur. Buat jalur dulu sebelum mencatat sesi.</p>
        <RouterLink to="/tracks/new" class="button primary">Jalur baru</RouterLink>
      </div>

      <form v-else-if="tracks.length" class="card card-roomy stack" @submit.prevent="save">
        <div class="field" role="group" aria-label="Durasi">
          Berapa lama?
          <span class="row">
            <button
              v-for="m in presets"
              :key="m"
              type="button"
              :class="{ primary: form.durationMin === m }"
              @click="form.durationMin = m"
            >
              {{ m }} mnt
            </button>
            <span class="inline">
              <input v-model.number="form.durationMin" type="number" min="1" max="1440" required aria-label="Durasi dalam menit" />
              menit
            </span>
          </span>
        </div>
        <div class="grid-2">
          <label>
            Tanggal
            <input v-model="form.occurredAt" type="date" required :max="todayLocal()" />
          </label>
          <label>
            Jalur
            <select v-model.number="form.trackId" required>
              <option :value="0" disabled>Pilih jalur</option>
              <option v-for="t in tracks" :key="t.id" :value="t.id">{{ t.goal }}{{ t.status === 'aktif' ? '' : ` (${t.status})` }}</option>
            </select>
          </label>
        </div>
        <label>
          Topik
          <span class="hint">Opsional</span>
          <select v-model.number="form.topicId" :disabled="loadingTopics || !form.trackId">
            <option :value="0">{{ loadingTopics ? 'Memuat topik...' : 'Tanpa topik' }}</option>
            <option v-for="t in topics" :key="t.id" :value="t.id">{{ t.order }}. {{ t.title }}</option>
          </select>
        </label>
        <label>
          <span class="row spread"><span>Ringkasan</span><span class="hint">{{ form.summary.length }}/200</span></span>
          <input v-model="form.summary" required maxlength="200" placeholder="Apa yang kamu kerjakan hari ini?" />
        </label>
        <div>
          <button class="primary" type="submit" :disabled="saving || !form.trackId">
            {{ saving ? 'Menyimpan...' : 'Simpan sesi' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
