<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

onMounted(async () => {
  // Supabase otomatis handle token dari URL hash setelah OAuth redirect
  const { data } = await supabase.auth.getSession()

  if (data.session) {
    await authStore.fetchProfile()
    const isOnboarded = authStore.profile?.onboarding_done
    router.replace(isOnboarded ? '/dashboard' : '/onboarding')
  } else {
    router.replace('/auth/login')
  }
})
</script>

<template>
  <div class="callback-wrap">
    <div class="spinner"></div>
    <p class="callback-text">Memproses login...</p>
  </div>
</template>

<style scoped src="../../styles/views/callback-page.css"></style>
