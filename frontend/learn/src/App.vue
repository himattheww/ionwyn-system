<template>
  <nav class="subnav" aria-label="Halaman Learn">
    <RouterLink v-slot="{ href, navigate, isExactActive }" to="/" custom>
      <a :href="href" :aria-current="isExactActive || $route.path.startsWith('/tracks/') && $route.path !== '/tracks/new' || $route.path.startsWith('/topics/') ? 'page' : undefined" @click="navigate">Jalur</a>
    </RouterLink>
    <RouterLink v-slot="{ href, navigate, isExactActive }" to="/tracks/new" custom>
      <a :href="href" :aria-current="isExactActive ? 'page' : undefined" @click="navigate">Buat jalur</a>
    </RouterLink>
  </nav>
  <main class="page">
    <RouterView :key="$route.fullPath" />
  </main>
</template>
