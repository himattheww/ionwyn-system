<script setup lang="ts">
import { ref } from 'vue'
import { claudeUrl, copyText } from '../lib/prompts'

const props = defineProps<{ title: string; prompt: string }>()
const copied = ref(false)

async function copy() {
  copied.value = await copyText(props.prompt)
}
</script>

<template>
  <div class="card prompt-card">
    <strong>{{ title }}</strong>
    <p class="prompt-text">{{ prompt }}</p>
    <div class="row">
      <button @click="copy">{{ copied ? 'Tersalin' : 'Salin prompt' }}</button>
      <a :href="claudeUrl" target="_blank" rel="noopener" class="button primary">Buka Claude ↗</a>
    </div>
  </div>
</template>
