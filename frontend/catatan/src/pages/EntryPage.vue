<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, ApiError, type Entry } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import EntryEditor from '../components/EntryEditor.vue'
import { formatDate } from '../lib/dates'
import { useLoad } from '../composables/useLoad'

const props = defineProps<{ date: string }>()
const router = useRouter()

const { data, loading, error, reload } = useLoad(async () => {
  const [entry, today] = await Promise.all([
    api.entry(props.date).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null
      throw err
    }),
    api.today(),
  ])
  return { entry, today }
})
onMounted(reload)

const editing = ref(false)
const justSaved = ref(false)

const canCreate = computed(() => {
  const today = data.value?.today
  if (!today?.isOpen) return false
  return props.date === today.tonight || (props.date === today.yesterday && today.yesterdayEmpty)
})

const sections = computed(() => {
  const entry = data.value?.entry
  if (!entry) return []
  return [
    { label: 'Apa yang terjadi hari ini?', icon: 'ph-notebook', text: entry.happened },
    { label: 'Hal baik apa yang bisa diambil?', icon: 'ph-sun', text: entry.goodThings },
    { label: 'Pelajaran apa yang bisa diambil?', icon: 'ph-lightbulb', text: entry.lessons },
    ...(entry.freeText ? [{ label: 'Catatan bebas', icon: 'ph-pen-nib', text: entry.freeText }] : []),
  ]
})

function onSaved(entry: Entry) {
  if (data.value) data.value = { ...data.value, entry }
  editing.value = false
  justSaved.value = true
}

const back = () => (window.history.state?.back ? router.back() : router.push('/'))
</script>

<template>
  <div class="stack">
    <button class="btn btn-ghost back" @click="back"><i class="ph ph-caret-left" />Kembali</button>
    <div class="hero">
      <p class="eyebrow">Catatan</p>
      <h1>{{ formatDate(date) }}</h1>
      <span v-if="data?.entry?.isBackfilled" class="tag tag-outline">Diisi belakangan</span>
    </div>

    <AsyncState :loading="loading" :error="error" @retry="reload">
      <template v-if="data?.entry && !editing">
        <p v-if="justSaved" class="saved" role="status"><i class="ph-fill ph-check-circle" /> Catatan tersimpan.</p>
        <article v-for="s in sections" :key="s.label" class="detail">
          <h2><i class="ph" :class="s.icon" />{{ s.label }}</h2>
          <p class="prose">{{ s.text }}</p>
        </article>
        <div class="actions">
          <button class="btn btn-primary" @click="editing = true; justSaved = false">
            <i class="ph ph-pencil-simple" />Edit catatan
          </button>
        </div>
      </template>

      <EntryEditor v-else-if="data?.entry" :date="date" :entry="data.entry" @saved="onSaved">
        <template #before-save>
          <button type="button" class="btn btn-secondary" @click="editing = false">Batal</button>
        </template>
      </EntryEditor>

      <template v-else-if="canCreate">
        <div v-if="date !== data?.today.tonight" class="notice">
          <i class="ph ph-info" />
          <span>Catatan ini akan ditandai <strong>diisi belakangan</strong>.</span>
        </div>
        <EntryEditor :date="date" :entry="null" @saved="onSaved" />
      </template>

      <div v-else class="state state-left">
        <i class="ph ph-moon-stars" />
        Belum ada catatan untuk tanggal ini.
      </div>
    </AsyncState>
  </div>
</template>
