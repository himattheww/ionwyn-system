<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ date: string; size?: number }>(), { size: 180 })

const synodic = 29.530588853
const reference = Date.UTC(2000, 0, 6, 18, 14)

const phase = computed(() => {
  const days = (Date.parse(`${props.date}T12:00:00Z`) - reference) / 86_400_000
  return (((days % synodic) + synodic) % synodic) / synodic
})

const shadow = computed(() => {
  const p = phase.value
  const r = 40
  const k = Math.cos(p * 2 * Math.PI) * r
  const waxing = p < 0.5
  const outer = waxing ? 0 : 1
  const inner = waxing === k > 0 ? 0 : 1
  return `M 50 10 A ${r} ${r} 0 0 ${outer} 50 90 A ${Math.abs(k)} ${r} 0 0 ${inner} 50 10 Z`
})
</script>

<template>
  <svg class="moon" :width="size" :height="size" viewBox="0 0 100 100" role="img" aria-label="Fase bulan malam ini">
    <circle cx="50" cy="50" r="47" class="moon-ring" />
    <circle cx="50" cy="50" r="40" class="moon-face" />
    <circle cx="62" cy="34" r="4" class="moon-crater" />
    <circle cx="70" cy="52" r="5" class="moon-crater" />
    <circle cx="58" cy="66" r="7" class="moon-crater" />
    <circle cx="40" cy="44" r="3" class="moon-crater" />
    <path :d="shadow" class="moon-shadow" />
  </svg>
</template>
