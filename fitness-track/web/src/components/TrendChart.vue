<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '../lib/format';

const props = withDefaults(
  defineProps<{
    points: { label: string; value: number | null }[];
    kind?: 'line' | 'bar';
    unit?: string;
    target?: number | null;
    zeroBased?: boolean;
  }>(),
  { kind: 'line', unit: '', target: null, zeroBased: false },
);

const width = 600;
const height = 220;
const pad = { top: 20, right: 12, bottom: 32, left: 52 };
const innerW = width - pad.left - pad.right;
const innerH = height - pad.top - pad.bottom;

const scale = computed(() => {
  const values = props.points.map((p) => p.value).filter((v): v is number => v != null);
  if (props.target != null) values.push(props.target);
  let min = props.zeroBased || props.kind === 'bar' ? 0 : Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 2) {
    const mid = (min + max) / 2;
    min = Math.max(0, mid - 1);
    max = min + 2;
  }
  const margin = (max - min) * 0.1;
  if (!(props.zeroBased || props.kind === 'bar')) min -= margin;
  max += margin;
  return { min, max };
});

const y = (v: number) => pad.top + innerH - ((v - scale.value.min) / (scale.value.max - scale.value.min)) * innerH;
const step = computed(() => innerW / Math.max(props.points.length, 1));
const x = (i: number) => pad.left + step.value * i + step.value / 2;

const linePath = computed(() => {
  let path = '';
  let drawing = false;
  props.points.forEach((p, i) => {
    if (p.value == null) {
      drawing = false;
      return;
    }
    path += `${drawing ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)} `;
    drawing = true;
  });
  return path;
});

const ticks = computed(() => {
  const { min, max } = scale.value;
  return [0, 0.5, 1].map((t) => min + (max - min) * t);
});

const labelAnchor = (i: number) => (i === 0 && props.points.length > 1 ? 'start' : i === props.points.length - 1 && i > 0 ? 'end' : 'middle');

const labelIndexes = computed(() => {
  const n = props.points.length;
  if (n <= 8) return new Set(props.points.map((_, i) => i));
  return new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1]);
});
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="chart" role="img">
    <g v-for="tick in ticks" :key="tick">
      <line :x1="pad.left" :x2="width - pad.right" :y1="y(tick)" :y2="y(tick)" class="grid" />
      <text :x="pad.left - 8" :y="y(tick) + 4" text-anchor="end" class="axis">{{ formatNumber(tick) }}</text>
    </g>
    <line :x1="pad.left" :x2="pad.left" :y1="pad.top" :y2="pad.top + innerH" class="axis-line" />
    <line :x1="pad.left" :x2="width - pad.right" :y1="pad.top + innerH" :y2="pad.top + innerH" class="axis-line" />

    <template v-if="kind === 'bar'">
      <rect
        v-for="(p, i) in points"
        :key="i"
        :x="x(i) - step * 0.35"
        :width="step * 0.7"
        :y="y(p.value ?? 0)"
        :height="Math.max(0, y(scale.min) - y(p.value ?? 0))"
        :class="['bar', { last: i === points.length - 1 }]"
        :style="{ animationDelay: `${i * 70}ms` }"
      >
        <title>{{ p.label }}: {{ formatNumber(p.value) }} {{ unit }}</title>
      </rect>
    </template>
    <template v-else>
      <path :d="linePath" class="line" pathLength="100" />
      <template v-for="(p, i) in points" :key="i">
        <circle v-if="p.value != null" :cx="x(i)" :cy="y(p.value)" r="4" class="dot">
          <title>{{ p.label }}: {{ formatNumber(p.value) }} {{ unit }}</title>
        </circle>
      </template>
    </template>

    <g v-if="target != null">
      <line :x1="pad.left" :x2="width - pad.right" :y1="y(target)" :y2="y(target)" class="target" />
      <text :x="width - pad.right" :y="y(target) - 6" text-anchor="end" class="target-label">TARGET {{ formatNumber(target) }} {{ unit }}</text>
    </g>

    <template v-for="(p, i) in points" :key="`l${i}`">
      <text v-if="labelIndexes.has(i)" :x="x(i)" :y="height - 6" :text-anchor="labelAnchor(i)" class="axis">{{ p.label }}</text>
    </template>
  </svg>
</template>

<style scoped src="../styles/trend-chart.css"></style>
