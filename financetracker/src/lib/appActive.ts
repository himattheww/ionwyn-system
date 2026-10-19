import { onScopeDispose } from 'vue'

export function onAppActive(callback: () => void) {
  const onVisible = () => {
    if (document.visibilityState === 'visible') callback()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', callback)
  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', callback)
  })
}
