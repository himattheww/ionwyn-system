<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, errorMessage } from '../lib/api'
import { runTests } from '../lib/runTests'
import type { Attempt, CodeResult, Lesson, TestOutcome } from '../types'

const props = defineProps<{ topicId: number; exercise: Lesson['exercise']; last: Attempt | null }>()
const emit = defineEmits<{ attempt: [value: Attempt | null] }>()

const code = ref(props.last?.code ?? props.exercise.starter)
const outcomes = ref<TestOutcome[] | null>(null)
const result = ref<CodeResult | null>(null)
const busy = ref(false)
const error = ref('')

const runnable = computed(() => props.exercise.language === 'javascript' && props.exercise.tests.length > 0)
const passedCount = computed(() => outcomes.value?.filter((o) => o.passed).length ?? 0)

function indent(event: KeyboardEvent) {
  const area = event.target as HTMLTextAreaElement
  const { selectionStart: start, selectionEnd: end } = area
  code.value = code.value.slice(0, start) + '  ' + code.value.slice(end)
  requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2))
}

async function check() {
  busy.value = true
  error.value = ''
  result.value = null
  try {
    let results: { passed: number; total: number } | undefined
    if (runnable.value) {
      outcomes.value = await runTests(code.value, props.exercise.tests)
      results = { passed: passedCount.value, total: outcomes.value.length }
    }
    result.value = await api.post<CodeResult>(`/topics/${props.topicId}/code`, { code: code.value, results })
    emit('attempt', result.value.lastAttempt)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}

function reset() {
  code.value = props.exercise.starter
  outcomes.value = null
  result.value = null
}
</script>

<template>
  <div class="exercise">
    <div class="row spread">
      <h3>{{ exercise.title }}</h3>
      <span class="badge outline">{{ exercise.language }}</span>
    </div>
    <p class="prose">{{ exercise.prompt }}</p>
    <ul v-if="exercise.rubric.length" class="small">
      <li v-for="r in exercise.rubric" :key="r">{{ r }}</li>
    </ul>

    <label class="code-label">
      Kode
      <textarea
        v-model="code"
        class="code-editor"
        spellcheck="false"
        autocapitalize="off"
        autocomplete="off"
        :rows="Math.max(10, code.split('\n').length + 2)"
        @keydown.tab.prevent="indent"
      />
    </label>

    <div class="row">
      <button class="primary" :disabled="busy" @click="check">
        {{ busy ? (runnable ? 'Menjalankan tes...' : 'AI sedang menilai...') : runnable ? 'Jalankan tes' : 'Nilai dengan AI' }}
      </button>
      <button :disabled="busy" @click="reset">Kembalikan kerangka awal</button>
    </div>
    <p v-if="!runnable" class="small muted">Bahasa ini tidak bisa dijalankan di browser, jadi dinilai AI. Penilaian AI hanya jalan dari laptop.</p>

    <div v-if="error" class="error">{{ error }}</div>

    <ul v-if="outcomes" class="test-list">
      <li v-for="o in outcomes" :key="o.name" :class="o.passed ? 'ok-text' : 'bad-text'">
        <strong>{{ o.passed ? '✓' : '✗' }} {{ o.name }}</strong>
        <span v-if="o.error" class="small"> {{ o.error }}</span>
        <span v-else-if="!o.passed" class="small"> hasil: <code>{{ o.actual }}</code></span>
      </li>
    </ul>

    <div v-if="result" :class="result.passed ? 'success' : 'notice'">
      <template v-if="runnable">{{ result.score }}/{{ result.total }} tes lulus. {{ result.passed ? 'Latihan selesai.' : 'Perbaiki lalu jalankan lagi.' }}</template>
      <template v-else>
        Nilai {{ result.score }}/100. {{ result.passed ? 'Lulus.' : 'Belum lulus.' }}
        <p class="prose small pre-line">{{ result.feedback }}</p>
      </template>
    </div>
    <p v-else-if="last" class="small muted">
      Percobaan terakhir: {{ last.score }}/{{ last.total }} {{ last.passed ? '· lulus' : '· belum lulus' }}
    </p>
  </div>
</template>
