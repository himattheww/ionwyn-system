<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'

const route  = useRoute()
const router = useRouter()
const { user, isLoggedIn } = useAuth()

const state   = ref<'checking' | 'confirm' | 'success' | 'error' | 'expired'>('checking')
const error   = ref('')
const tgUsername = ref('')
const linking = ref(false)

const token = route.query.token as string

onMounted(async () => {
  if (!token) { state.value = 'error'; error.value = 'Token tidak ditemukan.'; return }

  if (!isLoggedIn.value) {
    // Simpan token di sessionStorage, redirect ke login, balik lagi ke sini setelah login
    sessionStorage.setItem('telegram_link_token', token)
    router.push({ name: 'login', query: { redirect: `/telegram-link?token=${token}` } })
    return
  }

  const { data, error: err } = await supabase.rpc('telegram_link_info', { p_token: token })
  const info = data?.[0]
  if (err || !info || info.expired) {
    state.value = 'expired'
    return
  }

  tgUsername.value = info.telegram_username ?? 'akun Telegram kamu'
  state.value = 'confirm'
})

async function confirmLink() {
  linking.value = true
  try {
    const { error: linkErr } = await supabase.rpc('link_telegram', { p_token: token })
    if (linkErr) {
      if (linkErr.code === 'P0002') state.value = 'expired'
      else { error.value = linkErr.message; state.value = 'error' }
      return
    }
    state.value = 'success'
  } catch (err: any) {
    error.value = err.message
    state.value = 'error'
  } finally {
    linking.value = false
  }
}
</script>

<template>
  <div class="wrap">
    <div class="card">
      <div class="tg-icon">
        <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path fill="#229ED9" d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.64 6.8l-1.6 7.55c-.12.55-.44.68-.88.42l-2.44-1.8-1.18 1.13c-.13.13-.24.24-.5.24l.18-2.5 4.55-4.11c.2-.18-.04-.28-.31-.1l-5.63 3.54-2.42-.76c-.53-.16-.54-.53.11-.79l9.47-3.65c.44-.16.83.1.69.79z"/></svg>
      </div>

      <template v-if="state === 'checking'">
        <div class="spinner"></div>
        <p class="msg">Memeriksa link...</p>
      </template>

      <template v-else-if="state === 'confirm'">
        <h2 class="title">Hubungkan Telegram?</h2>
        <p class="desc">Kamu akan menghubungkan akun FinTrack ke <strong>@{{ tgUsername }}</strong>. Setelah terhubung, kamu bisa input transaksi dan tanya AI Analyst langsung dari Telegram.</p>
        <button class="btn-confirm" @click="confirmLink" :disabled="linking">
          <span v-if="linking" class="spinner-sm"></span>
          <span v-else>Ya, hubungkan</span>
        </button>
        <RouterLink to="/dashboard" class="btn-cancel">Batal</RouterLink>
      </template>

      <template v-else-if="state === 'success'">
        <div class="success-icon">✅</div>
        <h2 class="title">Berhasil terhubung!</h2>
        <p class="desc">Sekarang kamu bisa kembali ke Telegram dan mulai pakai bot FinTrack.</p>
        <RouterLink to="/dashboard" class="btn-confirm link-block">
          Kembali ke Dashboard
        </RouterLink>
      </template>

      <template v-else-if="state === 'expired'">
        <div class="error-icon">⏱️</div>
        <h2 class="title">Link sudah kedaluwarsa</h2>
        <p class="desc">Link ini berlaku 10 menit. Buka bot Telegram dan ketik <code>/login</code> lagi untuk dapat link baru.</p>
      </template>

      <template v-else>
        <div class="error-icon">⚠️</div>
        <h2 class="title">Terjadi kesalahan</h2>
        <p class="desc">{{ error || 'Silakan coba lagi.' }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped src="../styles/views/telegram-link-view.css"></style>
