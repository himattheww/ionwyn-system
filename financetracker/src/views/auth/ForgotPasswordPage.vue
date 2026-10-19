<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

const email   = ref('')
const loading = ref(false)
const sent    = ref(false)
const error   = ref('')

async function handleReset() {
  if (!email.value) { error.value = 'Masukkan email kamu'; return }
  loading.value = true; error.value = ''
  const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/reset-password`,
  })
  if (err) { error.value = err.message; loading.value = false; return }
  sent.value    = true
  loading.value = false
}
</script>

<template>
  <div class="wrap">
    <!-- Success state -->
    <div v-if="sent" class="success-state">
      <div class="success-icon">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--color-accent)" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      </div>
      <h2 class="form-title">Cek emailmu</h2>
      <p class="form-sub">Link reset password sudah dikirim ke <strong>{{ email }}</strong>. Klik link tersebut untuk membuat password baru.</p>
      <RouterLink to="/auth/login" class="btn-main" style="display:block;text-align:center;text-decoration:none;margin-top:24px;">
        Kembali ke login
      </RouterLink>
    </div>

    <!-- Form -->
    <template v-else>
      <RouterLink to="/auth/login" class="back-link">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
        Kembali
      </RouterLink>

      <h2 class="form-title">Lupa password?</h2>
      <p class="form-sub">Masukkan emailmu dan kami akan kirimkan link untuk reset password.</p>

      <div v-if="error" class="error-box">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {{ error }}
      </div>

      <div class="field">
        <label>Email</label>
        <input type="email" v-model="email" placeholder="nama@email.com" @keyup.enter="handleReset" autofocus />
      </div>

      <button class="btn-main" @click="handleReset" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        <span v-else>Kirim link reset</span>
      </button>
    </template>
  </div>
</template>

<style scoped src="../../styles/views/forgot-password-page.css"></style>
