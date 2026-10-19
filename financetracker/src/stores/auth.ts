import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase, readStoredSession } from '@/lib/supabase'
import { cachedQuery, clearCache, writeCache } from '@/lib/offlineCache'
import type { Profile, Currency } from '@/lib/database.types'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  // ─── State ──────────────────────────────────────────────────────
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const profile = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ─── Getters ────────────────────────────────────────────────────
  const isLoggedIn = computed(() => !!user.value)
  const isOnboarded = computed(() => profile.value?.onboarding_done ?? false)
  const displayName = computed(
    () => profile.value?.full_name ?? user.value?.email ?? 'User'
  )
  const currency = computed(() => profile.value?.currency ?? 'IDR')
  const monthlyIncome = computed(() => profile.value?.monthly_income ?? 0)

  // ─── Actions ────────────────────────────────────────────────────

  // Initialize: cek session yang sudah ada di localStorage
  async function initialize() {
    loading.value = true
    try {
      const { data, error: sessionError } = await supabase.auth.getSession()
      const offlineSession = !data.session && sessionError && isAuthRetryableFetchError(sessionError)
        ? readStoredSession()
        : null
      session.value = data.session ?? offlineSession
      user.value = session.value?.user ?? null

      if (user.value) {
        await fetchProfile()
      }

      // Listen ke perubahan auth (login, logout, token refresh)
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!newSession && event !== 'SIGNED_OUT') return
        session.value = newSession
        user.value = newSession?.user ?? null

        if (event === 'SIGNED_IN' && user.value) {
          await fetchProfile()
        }
        if (event === 'SIGNED_OUT') {
          profile.value = null
        }
      })
    } finally {
      loading.value = false
    }
  }

  // Register dengan email + password
  async function register(email: string, password: string, fullName: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }, // Disimpan di auth.users.raw_user_meta_data
        },
      })

      if (authError) throw authError

      // Profile dibuat otomatis oleh Supabase trigger (lihat SQL setup)
      return { success: true, needsVerification: !data.session }
    } catch (err: any) {
      error.value = err.message
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  // Login dengan email + password
  async function login(email: string, password: string) {
    loading.value = true
    error.value = null
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) throw authError
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  // Login dengan Google OAuth
  async function loginWithGoogle() {
    loading.value = true
    error.value = null
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
        },
      })
      if (authError) throw authError
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  // Logout
  async function logout() {
    loading.value = true
    try {
      await supabase.auth.signOut()
      clearCache()
    } finally {
      loading.value = false
    }
  }

  // Fetch profile dari tabel profiles
  async function fetchProfile() {
    if (!user.value) return
    try {
      const { data } = await cachedQuery(
        `${user.value.id}:profile`,
        supabase.from('profiles').select('*').eq('id', user.value.id).single(),
      )
      if (data) profile.value = data
    } catch (err: any) {
      console.error('Failed to fetch profile:', err.message)
    }
  }

  // Update profile (nama, foto, currency, income)
  async function updateProfile(updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'currency' | 'monthly_income' | 'onboarding_done'>>) {
    if (!user.value) return { success: false }
    loading.value = true
    error.value = null
    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.value.id)
        .select()
        .single()

      if (updateError) throw updateError
      profile.value = data
      writeCache(`${user.value.id}:profile`, data)
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  // Upload foto profil ke Supabase Storage
  async function uploadAvatar(file: File) {
    if (!user.value) return { success: false }
    loading.value = true
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.value.id}/avatar.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true }) // upsert: replace kalau sudah ada

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      await updateProfile({ avatar_url: urlData.publicUrl })
      return { success: true }
    } catch (err: any) {
      error.value = err.message
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  // Update currency
  async function setCurrency(newCurrency: Currency) {
    return updateProfile({ currency: newCurrency })
  }

  // Hapus error
  function clearError() {
    error.value = null
  }

  return {
    // State
    user,
    session,
    profile,
    loading,
    error,
    // Getters
    isLoggedIn,
    isOnboarded,
    displayName,
    currency,
    monthlyIncome,
    // Actions
    initialize,
    register,
    login,
    loginWithGoogle,
    logout,
    fetchProfile,
    updateProfile,
    uploadAvatar,
    setCurrency,
    clearError,
  }
})
