<script setup lang="ts">
const beat = (x: number) => `L ${x} 40 L ${x + 18} 40 L ${x + 24} 34 L ${x + 30} 40 L ${x + 38} 40 L ${x + 44} 8 L ${x + 52} 58 L ${x + 58} 40 L ${x + 66} 40 L ${x + 74} 30 L ${x + 82} 40`
const path = `M 0 40 ${[60, 300, 540, 780].map(beat).join(' ')} L 1000 40`
</script>

<template>
  <svg class="heartline" viewBox="0 0 1000 64" preserveAspectRatio="none" aria-hidden="true">
    <path :d="path" class="heartline-base" />
    <path :d="path" class="heartline-live" pathLength="100" />
  </svg>
</template>
