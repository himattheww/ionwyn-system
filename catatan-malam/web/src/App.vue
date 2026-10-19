<script setup lang="ts">
import { computed } from 'vue'
import { formatClock, writingWindow } from './lib/dates'
import { useNow } from './composables/useNow'

const links = [
  { to: '/', label: 'Malam ini', icon: 'moon' },
  { to: '/kalender', label: 'Kalender', icon: 'calendar-blank' },
  { to: '/pelajaran', label: 'Pelajaran', icon: 'lightbulb' },
  { to: '/hal-baik', label: 'Hal baik', icon: 'sun' },
  { to: '/cari', label: 'Cari', icon: 'magnifying-glass' },
]

const now = useNow()
const clock = computed(() => formatClock(now.value))
const windowText = computed(() =>
  writingWindow(now.value).open ? 'Jendela menulis terbuka sampai 02.00' : 'Jendela menulis dibuka pukul 18.00',
)
</script>

<template>
  <div class="shell">
    <aside class="side">
      <header class="topbar">
        <RouterLink to="/" class="brand"><i class="ph-fill ph-moon" />Catatan Malam</RouterLink>
        <span class="clock">{{ clock }} WIB</span>
      </header>
      <nav class="tabbar">
        <RouterLink v-for="link in links" :key="link.to" v-slot="{ href, navigate, isExactActive }" :to="link.to" custom>
          <a
            :href="href"
            class="tab"
            :class="{ 'tab-active': isExactActive }"
            :aria-current="isExactActive ? 'page' : undefined"
            @click="navigate"
          >
            <i :class="[isExactActive ? 'ph-fill' : 'ph', `ph-${link.icon}`]" />
            {{ link.label }}
          </a>
        </RouterLink>
      </nav>
      <p class="side-status">{{ windowText }}</p>
    </aside>
    <main class="page">
      <RouterView :key="$route.fullPath" />
    </main>
  </div>
</template>
