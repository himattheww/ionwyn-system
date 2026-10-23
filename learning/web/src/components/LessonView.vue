<script setup lang="ts">
import type { Lesson } from '../types'

defineProps<{ lesson: Lesson }>()

const parts = (text: string) => text.split(/`([^`]+)`/).map((value, i) => ({ value, code: i % 2 === 1 }))
</script>

<template>
  <div class="lesson">
    <p class="lead">
      <template v-for="(p, i) in parts(lesson.overview)" :key="i"><code v-if="p.code">{{ p.value }}</code><template v-else>{{ p.value }}</template></template>
    </p>

    <div v-for="s in lesson.sections" :key="s.heading" class="lesson-section">
      <h3>{{ s.heading }}</h3>
      <p v-for="(paragraph, i) in s.paragraphs" :key="i" class="prose">
        <template v-for="(p, j) in parts(paragraph)" :key="j"><code v-if="p.code">{{ p.value }}</code><template v-else>{{ p.value }}</template></template>
      </p>
    </div>

    <div v-for="e in lesson.examples" :key="e.title" class="lesson-example">
      <div class="row spread">
        <strong>{{ e.title }}</strong>
        <span class="badge outline">{{ e.language }}</span>
      </div>
      <pre><code>{{ e.code }}</code></pre>
      <p class="small muted">
        <template v-for="(p, i) in parts(e.explanation)" :key="i"><code v-if="p.code">{{ p.value }}</code><template v-else>{{ p.value }}</template></template>
      </p>
    </div>

    <div class="card">
      <span class="kicker sage">Yang harus diingat</span>
      <ul class="checks">
        <li v-for="k in lesson.keyPoints" :key="k">
          <template v-for="(p, i) in parts(k)" :key="i"><code v-if="p.code">{{ p.value }}</code><template v-else>{{ p.value }}</template></template>
        </li>
      </ul>
    </div>
  </div>
</template>
