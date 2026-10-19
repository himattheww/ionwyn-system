<template>
  <header class="topbar">
    <RouterLink to="/" class="brand">Learn</RouterLink>
    <nav>
      <RouterLink to="/">Jalur</RouterLink>
      <RouterLink to="/sessions/new">Catat sesi</RouterLink>
    </nav>
  </header>
  <main class="page">
    <RouterView :key="$route.fullPath" />
  </main>
</template>
