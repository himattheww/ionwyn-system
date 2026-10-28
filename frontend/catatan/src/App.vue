<script setup lang="ts">
import Starfield from './components/Starfield.vue'

const links = [
  { to: '/', label: 'Malam ini' },
  { to: '/kalender', label: 'Kalender' },
  { to: '/pelajaran', label: 'Pelajaran' },
  { to: '/hal-baik', label: 'Hal baik' },
  { to: '/cari', label: 'Cari' },
]
</script>

<template>
  <Starfield />
  <nav class="subnav" aria-label="Halaman Catatan">
    <RouterLink v-for="link in links" :key="link.to" v-slot="{ href, navigate, isExactActive }" :to="link.to" custom>
      <a :href="href" :aria-current="isExactActive ? 'page' : undefined" @click="navigate">{{ link.label }}</a>
    </RouterLink>
  </nav>
  <main class="page">
    <RouterView :key="$route.fullPath" />
  </main>
</template>
