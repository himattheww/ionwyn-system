<script setup lang="ts">
</script>

<template>
  <div class="auth-shell">
    <div class="auth-left">
      <div class="brand">
        <div class="brand-icon">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
          </svg>
        </div>
        <span class="brand-name">FinTrack</span>
      </div>

      <div class="left-content">
        <h1 class="tagline">
          Kendalikan<br>keuanganmu,<br>
          <span class="tagline-accent">capai tujuanmu.</span>
        </h1>
        <p class="tagline-sub">
          Lacak pemasukan, kelola pengeluaran, dan raih goals finansialmu dengan bantuan AI.
        </p>
      </div>

      <div class="left-stats">
        <div class="stat-pill">
          <span class="stat-dot green"></span>
          <span class="stat-label">Tabungan bulan ini</span>
          <span class="stat-value">Rp 2.400.000</span>
        </div>
        <div class="stat-pill">
          <span class="stat-dot amber"></span>
          <span class="stat-label">Dana darurat</span>
          <span class="stat-value">68% tercapai</span>
        </div>
        <div class="stat-pill">
          <span class="stat-dot blue"></span>
          <span class="stat-label">Goals aktif</span>
          <span class="stat-value">3 goals</span>
        </div>
      </div>
    </div>

    <div class="auth-right">
      <RouterView />
    </div>
  </div>
</template>

<style scoped src="../styles/views/auth-view.css"></style>
