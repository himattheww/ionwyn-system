<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { login, loading, error, clearError } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)

async function handleLogin() {
  clearError()
  const result = await login(email.value, password.value)
  if (result.success) {
    router.push('/dashboard')
  }
}
</script>

<template>
  <div class="login-wrap">
    <div class="form-header">
      <h2 class="form-title">Selamat datang kembali</h2>
      <p class="form-sub">Masuk ke akun FinTrack kamu</p>
    </div>

    <!-- Tab switcher -->
    <div class="tab-row">
      <RouterLink to="/auth/login" class="tab active">Masuk</RouterLink>
      <RouterLink to="/auth/register" class="tab">Daftar</RouterLink>
    </div>

    <!-- Error message -->
    <div v-if="error" class="error-box">
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ error }}
    </div>

    <form @submit.prevent="handleLogin" novalidate>
      <!-- Email -->
      <div class="field">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          placeholder="nama@email.com"
          autocomplete="email"
          required
        />
      </div>

      <!-- Password -->
      <div class="field">
        <label for="password">
          Password
          <RouterLink to="/auth/forgot" class="forgot-link">Lupa password?</RouterLink>
        </label>
        <div class="input-wrap">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
          <button
            type="button"
            class="eye-btn"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
          >
            <svg v-if="!showPassword" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Submit -->
      <button type="submit" class="btn-main" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        <span v-else>Masuk</span>
      </button>
    </form>

    <p class="switch-link">
      Belum punya akun?
      <RouterLink to="/auth/register">Daftar sekarang</RouterLink>
    </p>
  </div>
</template>

<style scoped src="../../styles/views/login-page.css"></style>
