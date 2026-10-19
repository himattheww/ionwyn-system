<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { register, loading, error, clearError } = useAuth()

const fullName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const registered = ref(false) // Tampilkan pesan "cek email" setelah register

// Validasi password strength
const passwordStrength = computed(() => {
  const p = password.value
  if (!p) return null
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score <= 1) return { label: 'Lemah', color: '#E24B4A', width: '25%' }
  if (score === 2) return { label: 'Cukup', color: '#EF9F27', width: '50%' }
  if (score === 3) return { label: 'Baik', color: 'var(--color-accent)', width: '75%' }
  return { label: 'Kuat', color: 'var(--color-accent-700)', width: '100%' }
})

async function handleRegister() {
  clearError()
  if (password.value.length < 8) return
  const result = await register(email.value, password.value, fullName.value)
  if (result?.success) {
    if (result.needsVerification) {
      registered.value = true // Tampilkan "cek email"
    } else {
      router.push('/onboarding')
    }
  }
}

// Import computed dari Vue (lupa diimport di atas)
import { computed } from 'vue'
</script>

<template>
  <div class="register-wrap">
    <!-- Success state: cek email -->
    <div v-if="registered" class="verify-state">
      <div class="verify-icon">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--color-accent)" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
        </svg>
      </div>
      <h2 class="form-title">Cek emailmu</h2>
      <p class="form-sub">
        Kami kirim link verifikasi ke <strong>{{ email }}</strong>.<br>
        Klik link tersebut untuk mengaktifkan akun.
      </p>
      <RouterLink to="/auth/login" class="btn-main" style="display:block;text-align:center;text-decoration:none;margin-top:24px;">
        Kembali ke login
      </RouterLink>
    </div>

    <!-- Register form -->
    <template v-else>
      <div class="form-header">
        <h2 class="form-title">Buat akun baru</h2>
        <p class="form-sub">Mulai perjalanan finansialmu hari ini</p>
      </div>

      <div class="tab-row">
        <RouterLink to="/auth/login" class="tab">Masuk</RouterLink>
        <RouterLink to="/auth/register" class="tab active">Daftar</RouterLink>
      </div>

      <div v-if="error" class="error-box">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ error }}
      </div>

      <form @submit.prevent="handleRegister" novalidate>
        <div class="field">
          <label for="fullName">Nama lengkap</label>
          <input
            id="fullName"
            v-model="fullName"
            type="text"
            placeholder="Nama kamu"
            autocomplete="name"
            required
          />
        </div>

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

        <div class="field">
          <label for="password">Password</label>
          <div class="input-wrap">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Min. 8 karakter"
              autocomplete="new-password"
              required
              minlength="8"
            />
            <button type="button" class="eye-btn" @click="showPassword = !showPassword" :aria-label="showPassword ? 'Sembunyikan' : 'Tampilkan'">
              <svg v-if="!showPassword" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>

          <!-- Password strength bar -->
          <div v-if="password" class="strength-wrap">
            <div class="strength-bar">
              <div
                class="strength-fill"
                :style="{ width: passwordStrength?.width, background: passwordStrength?.color }"
              ></div>
            </div>
            <span class="strength-label" :style="{ color: passwordStrength?.color }">
              {{ passwordStrength?.label }}
            </span>
          </div>
        </div>

        <button type="submit" class="btn-main" :disabled="loading || password.length < 8">
          <span v-if="loading" class="spinner"></span>
          <span v-else>Buat akun</span>
        </button>
      </form>


      <p class="switch-link">
        Sudah punya akun?
        <RouterLink to="/auth/login">Masuk</RouterLink>
      </p>
    </template>
  </div>
</template>

<style scoped src="../../styles/views/register-page.css"></style>
