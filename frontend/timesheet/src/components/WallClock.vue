<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const time = ref(new Date())
let timer: number | undefined

onMounted(() => (timer = window.setInterval(() => (time.value = new Date()), 1000)))
onUnmounted(() => clearInterval(timer))

const ticks = Array.from({ length: 12 }, (_, i) => i * 30)
const angle = (part: 'h' | 'm' | 's') => {
  const t = time.value
  if (part === 'h') return (t.getHours() % 12) * 30 + t.getMinutes() * 0.5
  if (part === 'm') return t.getMinutes() * 6 + t.getSeconds() * 0.1
  return t.getSeconds() * 6
}
</script>

<template>
  <svg class="wall-clock" viewBox="0 0 100 100" role="img" :aria-label="`Jam ${time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`">
    <circle cx="50" cy="50" r="46" class="wall-face" />
    <line v-for="t in ticks" :key="t" x1="50" y1="8" x2="50" y2="14" class="wall-tick" :transform="`rotate(${t} 50 50)`" />
    <line x1="50" y1="50" x2="50" y2="27" class="wall-hour" :transform="`rotate(${angle('h')} 50 50)`" />
    <line x1="50" y1="50" x2="50" y2="15" class="wall-minute" :transform="`rotate(${angle('m')} 50 50)`" />
    <line x1="50" y1="56" x2="50" y2="13" class="wall-second" :transform="`rotate(${angle('s')} 50 50)`" />
    <circle cx="50" cy="50" r="2.4" class="wall-pin" />
  </svg>
</template>
