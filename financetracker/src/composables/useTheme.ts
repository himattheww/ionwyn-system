import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'fintrack-theme'

// Global state — shared across all components
const theme = ref<Theme>((localStorage.getItem(STORAGE_KEY) as Theme) || 'system')

function applyTheme(t: Theme) {
  const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
}

// Apply immediately on load
applyTheme(theme.value)

// React to system theme changes if mode is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') applyTheme('system')
})

// Persist + apply whenever theme changes
watch(theme, (t) => {
  localStorage.setItem(STORAGE_KEY, t)
  applyTheme(t)
})

export function useTheme() {
  function setTheme(t: Theme) {
    theme.value = t
  }

  function toggle() {
    // Simple toggle: light <-> dark (skip system for quick toggle)
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'light' : 'dark')
  }

  return { theme, setTheme, toggle }
}