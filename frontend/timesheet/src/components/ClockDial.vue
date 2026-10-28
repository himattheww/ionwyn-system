<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  windowStart: number | null
  windowEnd: number | null
  fillEnd: number | null
  marker: number | null
  label: string
  warn: boolean
  description: string
}>()

const C = 88
const R = 72

function point(min: number, radius: number): [number, number] {
  const a = ((min % 720) / 720) * Math.PI * 2
  return [C + radius * Math.sin(a), C - radius * Math.cos(a)]
}

function arc(from: number | null, to: number | null): string {
  if (from === null || to === null || to <= from) return ''
  const span = Math.min(to - from, 719)
  const [x1, y1] = point(from, R)
  const [x2, y2] = point(from + span, R)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${span > 360 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function ticks(major: boolean): string {
  let path = ''
  for (let i = 0; i < 60; i++) {
    if ((i % 5 === 0) !== major) continue
    const [x1, y1] = point(i * 12, major ? 53 : 58)
    const [x2, y2] = point(i * 12, 62)
    path += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  return path
}

const minorTicks = ticks(false)
const majorTicks = ticks(true)

const windowPath = computed(() => arc(props.windowStart, props.windowEnd))
const fillPath = computed(() => arc(props.windowStart, props.fillEnd))
const markerPoint = computed(() => (props.marker === null ? null : point(props.marker, R)))
</script>

<template>
  <svg class="dial" :class="{ warn }" viewBox="0 0 176 176" role="img" :aria-label="description">
    <circle class="dial-face" cx="88" cy="88" r="86" />
    <circle class="dial-track" cx="88" cy="88" r="72" />
    <path class="dial-window" :d="windowPath" />
    <path class="dial-fill" :d="fillPath" />
    <path class="dial-minor" :d="minorTicks" />
    <path class="dial-major" :d="majorTicks" />
    <text class="dial-num" x="88" y="49">12</text>
    <text class="dial-num" x="88" y="134">6</text>
    <text class="dial-value" x="88" y="92">{{ label }}</text>
    <text class="dial-caption" x="88" y="110">dari 8 jam</text>
    <template v-if="markerPoint">
      <circle class="dial-glow" :cx="markerPoint[0]" :cy="markerPoint[1]" r="11" />
      <circle class="dial-marker" :cx="markerPoint[0]" :cy="markerPoint[1]" r="7" />
    </template>
  </svg>
</template>
