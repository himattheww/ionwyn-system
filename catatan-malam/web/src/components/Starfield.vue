<script setup lang="ts">
const stars = Array.from({ length: 46 }, (_, i) => {
  const seed = Math.sin(i * 12.9898) * 43758.5453
  const r = seed - Math.floor(seed)
  const s = Math.sin(i * 78.233) * 12543.123
  const q = s - Math.floor(s)
  return { x: (r * 100).toFixed(2), y: (q * 100).toFixed(2), size: q > 0.85 ? 1.6 : 1, delay: ((r + q) * 4).toFixed(2), slow: i % 3 === 0 }
})
</script>

<template>
  <svg class="starfield" aria-hidden="true" preserveAspectRatio="none">
    <circle
      v-for="(star, i) in stars"
      :key="i"
      :cx="`${star.x}%`"
      :cy="`${star.y}%`"
      :r="star.size"
      :class="{ twinkle: star.slow }"
      :style="{ animationDelay: `${star.delay}s` }"
    />
  </svg>
</template>
