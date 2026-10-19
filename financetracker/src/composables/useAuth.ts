// Composable ini adalah shortcut untuk pakai auth store di komponen Vue.
// Pakai ini di komponen, bukan langsung import store.

import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

export function useAuth() {
  const store = useAuthStore()

  // storeToRefs: supaya reactive saat destructure dari store
  const {
    user,
    profile,
    loading,
    error,
    isLoggedIn,
    isOnboarded,
    displayName,
    currency,
    monthlyIncome,
  } = storeToRefs(store)

  return {
    // Reactive state
    user,
    profile,
    loading,
    error,
    isLoggedIn,
    isOnboarded,
    displayName,
    currency,
    monthlyIncome,

    // Actions (tidak perlu storeToRefs karena functions)
    initialize: store.initialize,
    login: store.login,
    loginWithGoogle: store.loginWithGoogle,
    register: store.register,
    logout: store.logout,
    updateProfile: store.updateProfile,
    uploadAvatar: store.uploadAvatar,
    setCurrency: store.setCurrency,
    clearError: store.clearError,
  }
}
