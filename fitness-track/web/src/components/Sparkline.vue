<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ values: (number | null)[] }>();

const points = computed(() => {
  const nums = props.values.filter((v): v is number => v != null);
  if (nums.length < 2) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const last = props.values.length - 1;
  return props.values
    .map((v, i) => (v == null ? null : `${((i / last) * 120).toFixed(1)},${(28 - ((v - min) / range) * 26).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
});
</script>

<template>
  <svg class="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
    <polyline v-if="points" :points="points" fill="none" stroke="var(--color-accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
    <line v-else x1="0" x2="120" y1="15" y2="15" stroke="var(--color-divider)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" />
  </svg>
</template>
