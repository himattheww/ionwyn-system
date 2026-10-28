<script setup lang="ts">
import { computed } from 'vue'

export type IconName =
  | 'login' | 'logout' | 'hourglass' | 'calendar' | 'calendar-check' | 'calendar-alert'
  | 'clock' | 'alarm' | 'timer' | 'sunrise' | 'sun' | 'sunset' | 'moon'
  | 'gear' | 'chevron-left' | 'chevron-right' | 'check'

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 })

const PATHS: Record<IconName, string> = {
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  hourglass: 'M6 2h12M6 22h12M7 2c0 5 10 5 10 10S7 17 7 22M17 2c0 5-10 5-10 10s10 5 10 10',
  calendar: 'M5 4.5h14a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM3 9.5h18M8 2.5v4M16 2.5v4',
  'calendar-check': 'M5 4.5h14a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM3 9.5h18M8.5 15l2.5 2.5 4.5-4.5',
  'calendar-alert': 'M5 4.5h14a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM3 9.5h18M12 13v3M12 18.5v.01',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  alarm: 'M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 9v4l3 2M5 3L2 6M19 3l3 3',
  timer: 'M20 13a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM12 9v4l2.5 1.5M9 2h6M12 2v3',
  sunrise: 'M12 2v6M4.9 10.9l1.4 1.4M2 18h2M20 18h2M17.7 12.3l1.4-1.4M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0',
  sun: 'M12 4V2M12 22v-2M4.9 4.9L3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  sunset: 'M12 10V2M4.9 10.9l1.4 1.4M2 18h2M20 18h2M17.7 12.3l1.4-1.4M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  gear: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
}

const d = computed(() => PATHS[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="d" />
  </svg>
</template>
