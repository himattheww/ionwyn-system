<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, errorMessage } from '../lib/api'
import type { DraftTopic, Level, PlannedTopic } from '../types'

const router = useRouter()

const form = reactive({
  goal: '',
  currentLevel: 'pemula' as Level,
  hoursPerWeek: 3,
  knownTopics: '',
  domainHint: '',
})

const levelOptions: { value: Level; label: string }[] = [
  { value: 'pemula', label: 'Pemula' },
  { value: 'menengah', label: 'Menengah' },
  { value: 'mahir', label: 'Mahir' },
]

const step = ref<'form' | 'review'>('form')
const topics = ref<DraftTopic[]>([])
const planning = ref(false)
const saving = ref(false)
const error = ref('')
const dragIndex = ref<number | null>(null)

const knownList = computed(() =>
  form.knownTopics
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean),
)

async function plan() {
  error.value = ''
  if (form.goal.trim().length < 2) {
    error.value = 'Tujuan minimal 2 karakter.'
    return
  }
  planning.value = true
  try {
    const result = await api.post<{ topics: PlannedTopic[] }>('/tracks/plan', {
      goal: form.goal,
      currentLevel: form.currentLevel,
      hoursPerWeek: form.hoursPerWeek,
      knownTopics: knownList.value,
      domainHint: form.domainHint,
    })
    topics.value = result.topics.map((t, i) => ({ ...t, key: i, known: false }))
    step.value = 'review'
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    planning.value = false
  }
}

function move(from: number, to: number) {
  if (to < 0 || to >= topics.value.length || from === to) return
  const [item] = topics.value.splice(from, 1)
  topics.value.splice(to, 0, item!)
}

function remove(index: number) {
  topics.value.splice(index, 1)
}

function onDrop(index: number) {
  if (dragIndex.value !== null) move(dragIndex.value, index)
  dragIndex.value = null
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const { id } = await api.post<{ id: number }>('/tracks', {
      goal: form.goal,
      currentLevel: form.currentLevel,
      hoursPerWeek: form.hoursPerWeek,
      domainHint: form.domainHint,
      topics: topics.value.map(({ title, objective, estSessions, prerequisites, sources, known }) => ({
        title,
        objective,
        estSessions,
        prerequisites,
        sources,
        known,
      })),
    })
    router.push(`/tracks/${id}`)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="narrow">
    <div class="steps small">
      <span class="badge" :class="step === 'form' ? 'sedang' : 'selesai'">1 · Tujuan</span>
      <i />
      <span class="badge" :class="step === 'review' ? 'sedang' : ''">2 · Review topik</span>
    </div>

    <template v-if="step === 'form'">
      <div class="head">
        <div>
          <h1>Jalur baru</h1>
          <p class="muted">Tulis tujuanmu. AI menyusun topik berurutan, lalu kamu review sebelum disimpan.</p>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>

      <form class="card card-roomy stack" @submit.prevent="plan">
        <label>
          Apa yang mau kamu pelajari?
          <input v-model="form.goal" class="big" required maxlength="200" placeholder="C#, naik ke senior, bahasa Jerman B1" :disabled="planning" />
        </label>
        <div class="grid-2">
          <div class="field" role="group" aria-label="Level sekarang">
            Level sekarang
            <div class="seg">
              <button
                v-for="l in levelOptions"
                :key="l.value"
                type="button"
                :class="{ on: form.currentLevel === l.value }"
                :disabled="planning"
                @click="form.currentLevel = l.value"
              >
                {{ l.label }}
              </button>
            </div>
          </div>
          <label>
            Target per minggu
            <span class="inline">
              <input v-model.number="form.hoursPerWeek" type="number" min="1" max="80" required :disabled="planning" />
              jam
            </span>
          </label>
        </div>
        <label>
          Topik yang sudah dikuasai
          <span class="hint">Opsional. Pisahkan dengan koma atau baris baru.</span>
          <textarea v-model="form.knownTopics" rows="3" :disabled="planning" />
        </label>
        <label>
          Domain study case
          <span class="hint">Opsional. Contoh: aplikasi logistik, e-commerce, rumah sakit</span>
          <input v-model="form.domainHint" maxlength="200" :disabled="planning" />
        </label>
        <div class="row gap-3">
          <button class="primary" type="submit" :disabled="planning">Susun topik</button>
          <span v-if="planning" class="muted small"><span class="spinner" />AI sedang menyusun topik dan mengecek sumber, bisa 10-30 detik...</span>
        </div>
      </form>
    </template>

    <template v-else>
      <div class="head">
        <div>
          <h1>Review topik</h1>
          <p class="muted">{{ form.goal }} · belum tersimpan sampai kamu tekan "Simpan jalur".</p>
        </div>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <p class="notice small">Seret topik atau pakai tombol naik/turun untuk mengubah urutan. Centang "Sudah bisa" untuk topik yang sudah kamu kuasai. Sumber yang URL-nya gagal dicek sudah dibuang.</p>

      <div v-if="!topics.length" class="card state">
        <p>Semua topik dihapus.</p>
        <button :disabled="planning" @click="plan">{{ planning ? 'Menyusun...' : 'Susun ulang' }}</button>
      </div>

      <div
        v-for="(t, i) in topics"
        :key="t.key"
        class="card card-compact topic draggable"
        :class="{ dragging: dragIndex === i, known: t.known }"
        draggable="true"
        @dragstart="dragIndex = i"
        @dragend="dragIndex = null"
        @dragover.prevent
        @drop.prevent="onDrop(i)"
      >
        <span class="dot sm">{{ i + 1 }}</span>
        <div class="body">
          <strong>{{ t.title }}</strong>
          <span class="muted">{{ t.objective }}</span>
          <span class="muted small">
            ± {{ t.estSessions }} sesi
            <template v-if="t.prerequisites.length"> · Prasyarat: {{ t.prerequisites.join(', ') }}</template>
          </span>
          <ul v-if="t.sources.length" class="small">
            <li v-for="s in t.sources" :key="s.url"><a :href="s.url" target="_blank" rel="noopener">{{ s.title }}</a></li>
          </ul>
          <span v-else class="muted small">Tidak ada sumber yang lolos pengecekan.</span>
          <label class="check mt-1"><input v-model="t.known" type="checkbox" /> Sudah bisa</label>
        </div>
        <div class="row nowrap gap-1">
          <button class="icon" type="button" title="Naik" :disabled="i === 0" @click="move(i, i - 1)">↑</button>
          <button class="icon" type="button" title="Turun" :disabled="i === topics.length - 1" @click="move(i, i + 1)">↓</button>
          <button class="icon danger" type="button" title="Hapus" @click="remove(i)">✕</button>
        </div>
      </div>

      <div class="row mt-5">
        <button class="primary" :disabled="saving || !topics.length" @click="save">
          {{ saving ? 'Menyimpan...' : 'Simpan jalur' }}
        </button>
        <button :disabled="saving" @click="step = 'form'">Kembali ke form</button>
      </div>
    </template>
  </div>
</template>
