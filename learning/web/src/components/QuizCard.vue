<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, errorMessage } from '../lib/api'
import type { Attempt, Lesson, QuizResult, TopicDetail } from '../types'

const props = defineProps<{ topicId: number; quiz: Lesson['quiz']; last: Attempt | null }>()
const emit = defineEmits<{ attempts: [value: TopicDetail['attempts']] }>()

const answers = ref<number[]>(props.quiz.map(() => -1))
const result = ref<QuizResult | null>(null)
const sending = ref(false)
const error = ref('')

const complete = computed(() => answers.value.every((a) => a >= 0))

async function submit() {
  sending.value = true
  error.value = ''
  try {
    result.value = await api.post<QuizResult>(`/topics/${props.topicId}/quiz`, { answers: answers.value })
    emit('attempts', result.value.attempts)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    sending.value = false
  }
}

function retry() {
  answers.value = props.quiz.map(() => -1)
  result.value = null
}

function optionClass(q: number, o: number) {
  if (!result.value) return { picked: answers.value[q] === o }
  const right = result.value.review[q]!.answer
  return { right: o === right, wrong: answers.value[q] === o && o !== right }
}
</script>

<template>
  <div class="quiz">
    <p v-if="last && !result" class="small muted">
      Percobaan terakhir: {{ last.score }}/{{ last.total }} {{ last.passed ? '· lulus' : '· belum lulus' }}
    </p>

    <fieldset v-for="(q, i) in quiz" :key="i" class="quiz-question" :disabled="!!result || sending">
      <legend>{{ i + 1 }}. {{ q.question }}</legend>
      <label v-for="(option, o) in q.options" :key="o" class="quiz-option" :class="optionClass(i, o)">
        <input v-model="answers[i]" type="radio" :name="`q${i}`" :value="o" />
        <span>{{ option }}</span>
      </label>
      <p v-if="result" class="small" :class="answers[i] === result.review[i]!.answer ? 'ok-text' : 'bad-text'">
        {{ answers[i] === result.review[i]!.answer ? 'Benar.' : 'Salah.' }} {{ result.review[i]!.explanation }}
      </p>
    </fieldset>

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="result" class="row" :class="result.passed ? 'success' : 'notice'">
      Skor {{ result.score }}/{{ result.total }}. {{ result.passed ? 'Lulus.' : 'Butuh minimal 80% untuk lulus.' }}
      <button @click="retry">Ulangi quiz</button>
    </div>
    <button v-else class="primary" :disabled="!complete || sending" @click="submit">
      {{ sending ? 'Memeriksa...' : complete ? 'Periksa jawaban' : 'Jawab semua soal dulu' }}
    </button>
  </div>
</template>
