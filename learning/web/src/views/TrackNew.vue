<script setup lang="ts">
import PromptCard from '../components/PromptCard.vue'
import { prompts } from '../lib/prompts'
</script>

<template>
  <div class="narrow">
    <RouterLink to="/" class="back">← Semua jalur</RouterLink>
    <h1>Buat jalur lewat Claude</h1>
    <p class="lead">
      Jalur baru dibuat dengan mengobrol di Claude, dari laptop maupun HP. Claude menyusun topik, penjelasan singkat, dan latihannya, lalu
      menyimpannya langsung ke sini.
    </p>
    <p class="small muted">
      Pastikan konektor Ionwyn Learn sudah terpasang di Claude (Settings → Connectors). Salin salah satu prompt, ganti bagian dalam kurung,
      lalu kirim di Claude.
    </p>
    <div class="stack">
      <PromptCard title="Jalur coding" :prompt="prompts.coding" />
      <PromptCard title="Jalur non-coding (praktik)" :prompt="prompts.praktik" />
      <PromptCard title="Belum tahu mau belajar apa" :prompt="prompts.next" />
    </div>
  </div>
</template>
