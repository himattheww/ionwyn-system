<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router   = useRouter()
const password = ref('')
const confirm  = ref('')
const loading  = ref(false)
const error    = ref('')
const ready    = ref(false)

onMounted(async () => {
  // Supabase otomatis handle token dari URL hash
  const { data } = await supabase.auth.getSession()
  ready.value = !!data.session
  if (!data.session) {
    error.value = 'Link reset tidak valid atau sudah expired. Minta link baru.'
  }
})

async function handleReset() {
  if (!password.value || password.value.length < 8) { error.value = 'Password minimal 8 karakter'; return }
  if (password.value !== confirm.value) { error.value = 'Password tidak cocok'; return }
  loading.value = true; error.value = ''
  const { error: err } = await supabase.auth.updateUser({ password: password.value })
  if (err) { error.value = err.message; loading.value = false; return }
  await supabase.auth.signOut()
  router.push('/auth/login?reset=success')
}
</script>

<template>
  <div class="wrap">
    <h2 class="form-title">Buat password baru</h2>
    <p class="form-sub">Masukkan password baru untuk akunmu.</p>

    <div v-if="error" class="error-box">
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ error }}
    </div>

    <template v-if="ready">
      <div class="field">
        <label>Password baru</label>
        <input type="password" v-model="password" placeholder="Min. 8 karakter" autofocus />
      </div>
      <div class="field">
        <label>Konfirmasi password</label>
        <input type="password" v-model="confirm" placeholder="Ulangi password" @keyup.enter="handleReset" />
      </div>
      <button class="btn-main" @click="handleReset" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        <span v-else>Simpan password baru</span>
      </button>
    </template>

    <RouterLink v-else to="/auth/forgot" class="btn-main link-block mt-2">
      Minta link baru
    </RouterLink>
  </div>
</template>

<style scoped src="../../styles/views/reset-password-page.css"></style>
