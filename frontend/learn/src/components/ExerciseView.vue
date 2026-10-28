<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, errorMessage } from '../lib/api'
import { runTests } from '../lib/runTests'
import type { Exercise, TestOutcome, TopicDetail } from '../types'

const props = defineProps<{ topicId: number; exercise: Exercise; last: TopicDetail['lastAttempt'] }>()
const emit = defineEmits<{ ready: [value: boolean] }>()

const runnable = computed(() => props.exercise.type === 'code' && props.exercise.language === 'javascript' && props.exercise.tests.length > 0)
const checklist = computed(() => props.exercise.checklist)
const starter = computed(() => (props.exercise.type === 'code' ? props.exercise.starter : ''))

const code = ref(props.last?.code ?? starter.value)
const outcomes = ref<TestOutcome[] | null>(null)
const checked = ref<boolean[]>(checklist.value.map(() => false))
const busy = ref(false)
const error = ref('')

const testsPassed = computed(() => (outcomes.value ? outcomes.value.every((o) => o.passed) : !!props.last?.passed))
const ready = computed(() => (runnable.value ? testsPassed.value : checked.value.every(Boolean)))
watch(ready, (value) => emit('ready', value), { immediate: true })

function indent(event: KeyboardEvent) {
  const area = event.target as HTMLTextAreaElement
  const { selectionStart: start, selectionEnd: end } = area
  code.value = code.value.slice(0, start) + '  ' + code.value.slice(end)
  requestAnimationFrame(() => area.setSelectionRange(start + 2, start + 2))
}

async function run() {
  if (props.exercise.type !== 'code') return
  busy.value = true
  error.value = ''
  try {
    outcomes.value = await runTests(code.value, props.exercise.tests)
    const passed = outcomes.value.filter((o) => o.passed).length
    await api.post(`/topics/${props.topicId}/code`, { code: code.value, results: { passed, total: outcomes.value.length } })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="exercise">
    <div class="row spread">
      <h3>{{ exercise.title }}</h3>
      <span class="badge outline">{{ exercise.type === 'code' ? exercise.language : 'praktik' }}</span>
    </div>
    <p class="prose pre-line">{{ exercise.prompt }}</p>

    <template v-if="runnable">
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
        <button class="primary" :disabled="busy" @click="run">{{ busy ? 'Menjalankan tes...' : 'Jalankan tes' }}</button>
        <button :disabled="busy" @click="code = starter">Kembalikan kerangka awal</button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <ul v-if="outcomes" class="test-list">
        <li v-for="o in outcomes" :key="o.name" :class="o.passed ? 'ok-text' : 'bad-text'">
          <strong>{{ o.passed ? '✓' : '✗' }} {{ o.name }}</strong>
          <span v-if="o.error" class="small"> {{ o.error }}</span>
          <span v-else-if="!o.passed" class="small"> hasil: <code>{{ o.actual }}</code></span>
        </li>
      </ul>
      <p v-else-if="last" class="small muted">Percobaan terakhir: {{ last.score }}/{{ last.total }} tes lulus.</p>
    </template>

    <template v-else>
      <pre v-if="starter"><code>{{ starter }}</code></pre>
      <p class="small muted">
        {{ exercise.type === 'code' ? 'Kerjakan di editor atau IDE-mu, lalu cek sendiri:' : 'Kerjakan praktiknya, lalu cek sendiri:' }}
      </p>
      <label v-for="(item, i) in checklist" :key="item" class="check-item">
        <input v-model="checked[i]" type="checkbox" />
        <span>{{ item }}</span>
      </label>
    </template>
  </div>
</template>
