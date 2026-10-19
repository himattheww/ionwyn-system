<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { api, type Entry, type EntryInput } from '../lib/api'
import { formatClock } from '../lib/dates'

const props = withDefaults(defineProps<{ date: string; entry: Entry | null; mode?: 'steps' | 'all' }>(), { mode: 'all' })
const emit = defineEmits<{ saved: [entry: Entry] }>()

const draftKey = `catatan-malam:draft:${props.date}`

function readDraft(): EntryInput | null {
  try {
    const raw = localStorage.getItem(draftKey)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const draft = readDraft()
const form = reactive({
  happened: draft?.happened ?? props.entry?.happened ?? '',
  goodThings: draft?.goodThings ?? props.entry?.goodThings ?? '',
  lessons: draft?.lessons ?? props.entry?.lessons ?? '',
  freeText: draft?.freeText ?? props.entry?.freeText ?? '',
})
const restored = ref(draft !== null)
const saving = ref(false)
const error = ref<string | null>(null)
const savedAt = ref<string | null>(null)
const step = ref(0)

watch(form, () => {
  savedAt.value = null
  try {
    localStorage.setItem(draftKey, JSON.stringify(form))
  } catch {}
})

const questions = [
  { key: 'happened', label: 'Apa yang terjadi hari ini?', short: 'Terjadi', hint: 'Ceritakan saja apa adanya — kejadian, orang, perasaan.', max: 4000, required: true },
  { key: 'goodThings', label: 'Hal baik apa yang bisa diambil?', short: 'Hal baik', hint: 'Sekecil apa pun. Secangkir kopi juga boleh.', max: 4000, required: true },
  { key: 'lessons', label: 'Pelajaran apa yang bisa diambil?', short: 'Pelajaran', hint: 'Apa yang mau kamu lakukan berbeda besok?', max: 4000, required: true },
  { key: 'freeText', label: 'Catatan bebas', short: 'Bebas', hint: 'Apa saja yang masih mengganjal. Boleh dilewati.', max: 10000, required: false },
] as const

type Key = (typeof questions)[number]['key']

const filled = (key: Key) => form[key].trim().length > 0
const current = computed(() => questions[step.value])
const isLast = computed(() => step.value === questions.length - 1)
const missing = computed(() => questions.filter((q) => q.required && !filled(q.key)).map((q) => q.short.toLowerCase()))
const complete = computed(() => missing.value.length === 0)
const saveLabel = computed(() => (saving.value ? 'Menyimpan…' : props.entry ? 'Simpan perubahan' : 'Simpan catatan'))

async function discardDraft() {
  form.happened = props.entry?.happened ?? ''
  form.goodThings = props.entry?.goodThings ?? ''
  form.lessons = props.entry?.lessons ?? ''
  form.freeText = props.entry?.freeText ?? ''
  restored.value = false
  step.value = 0
  await nextTick()
  try {
    localStorage.removeItem(draftKey)
  } catch {}
}

async function save() {
  if (!complete.value) return
  saving.value = true
  error.value = null
  try {
    const entry = await api.saveEntry(props.date, { ...form, freeText: form.freeText || null })
    try {
      localStorage.removeItem(draftKey)
    } catch {}
    restored.value = false
    savedAt.value = formatClock()
    emit('saved', entry)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="editor" @submit.prevent="save">
    <div v-if="restored" class="notice" role="status">
      <i class="ph ph-clock-counter-clockwise" />
      <span>Draf yang belum tersimpan dipulihkan.</span>
      <button type="button" class="btn btn-ghost btn-sm" @click="discardDraft">Buang draf</button>
    </div>

    <template v-if="mode === 'steps'">
      <div class="steps">
        <button
          v-for="(q, i) in questions"
          :key="q.key"
          type="button"
          class="step"
          :class="{ 'step-active': i === step, 'step-done': filled(q.key) }"
          @click="step = i"
        >
          <span class="step-bar" />
          <span class="step-label"><i v-if="filled(q.key)" class="ph ph-check" />{{ q.short }}</span>
        </button>
      </div>

      <label class="prompt">
        <span class="prompt-count">
          Pertanyaan {{ step + 1 }} dari {{ questions.length }}<template v-if="!current.required"> · opsional</template>
        </span>
        <span class="prompt-title">{{ current.label }}</span>
        <span class="prompt-hint">{{ current.hint }}</span>
        <textarea
          v-model="form[current.key]"
          class="input input-lg"
          :maxlength="current.max"
          rows="7"
          placeholder="Tulis pelan-pelan…"
        />
      </label>
      <div class="editor-meta">
        <span><i class="ph ph-floppy-disk" /> Draf tersimpan otomatis</span>
        <span>{{ form[current.key].length }}/{{ current.max }}</span>
      </div>
    </template>

    <template v-else>
      <label v-for="(q, i) in questions" :key="q.key" class="field-q">
        <span class="field-q-label">
          <span class="field-q-num">0{{ i + 1 }}</span>
          {{ q.label }}
          <small v-if="!q.required">(opsional)</small>
        </span>
        <textarea
          v-model="form[q.key]"
          class="input"
          :required="q.required"
          :maxlength="q.max"
          :rows="q.key === 'freeText' ? 6 : 5"
        />
        <small class="counter">{{ form[q.key].length }}/{{ q.max }}</small>
      </label>
    </template>

    <div v-if="error" class="alert" role="alert"><i class="ph ph-warning-circle" /><span>{{ error }}</span></div>
    <p v-if="savedAt" class="saved" role="status"><i class="ph-fill ph-check-circle" /> Tersimpan pukul {{ savedAt }}.</p>
    <p v-if="mode === 'steps' && isLast && missing.length" class="muted">Belum diisi: {{ missing.join(', ') }}.</p>

    <div class="actions">
      <slot name="before-save" />
      <template v-if="mode === 'steps'">
        <button v-if="step > 0" type="button" class="btn btn-secondary" @click="step--">
          <i class="ph ph-arrow-left" />Kembali
        </button>
        <button
          v-if="!isLast"
          type="button"
          class="btn btn-primary btn-grow"
          :disabled="current.required && !filled(current.key)"
          @click="step++"
        >
          Lanjut<i class="ph ph-arrow-right" />
        </button>
        <button v-else class="btn btn-primary btn-grow" :disabled="saving || !complete">{{ saveLabel }}</button>
      </template>
      <button v-else class="btn btn-primary btn-grow" :disabled="saving || !complete">{{ saveLabel }}</button>
    </div>
  </form>
</template>
