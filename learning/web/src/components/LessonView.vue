<script setup lang="ts">
const props = defineProps<{ summary: string }>()

const paragraphs = props.summary.split(/\n{2,}/).filter((p) => p.trim())
const parts = (text: string) => text.split(/`([^`]+)`/).map((value, i) => ({ value, code: i % 2 === 1 }))
</script>

<template>
  <div class="lesson">
    <p v-for="(paragraph, i) in paragraphs" :key="i" class="prose">
      <template v-for="(p, j) in parts(paragraph)" :key="j"><code v-if="p.code">{{ p.value }}</code><template v-else>{{ p.value }}</template></template>
    </p>
  </div>
</template>
