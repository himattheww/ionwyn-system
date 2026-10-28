<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: { name: string; level: number }[] }>()

const center = 150
const radius = 110

const maxLevel = computed(() => Math.max(5, ...props.items.map(i => i.level)))

function point(index: number, ratio: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / props.items.length
  return [center + Math.cos(angle) * radius * ratio, center + Math.sin(angle) * radius * ratio]
}

const rings = computed(() => [0.25, 0.5, 0.75, 1].map(ratio => props.items.map((_, i) => point(i, ratio).join(',')).join(' ')))
const shape = computed(() => props.items.map((item, i) => point(i, item.level / maxLevel.value).join(',')).join(' '))
const labels = computed(() => props.items.map((item, i) => ({ ...item, at: point(i, 1.24) })))
</script>

<template>
  <svg viewBox="-30 -10 360 320" class="radar" role="img" aria-label="Grafik radar atribut">
    <polygon v-for="ring in rings" :key="ring" :points="ring" class="ring" />
    <line v-for="(_, i) in items" :key="i" :x1="center" :y1="center" :x2="point(i, 1)[0]" :y2="point(i, 1)[1]" class="ring" />
    <polygon :points="shape" class="shape" />
    <template v-for="label in labels" :key="label.name">
      <text :x="label.at[0]" :y="label.at[1] - 3" text-anchor="middle">{{ label.name }}</text>
      <text :x="label.at[0]" :y="label.at[1] + 13" text-anchor="middle" class="level">Lv {{ label.level }}</text>
    </template>
  </svg>
</template>

<style scoped src="../styles/radar-chart.css"></style>
