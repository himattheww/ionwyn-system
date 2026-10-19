import { onMounted, onUnmounted, ref } from 'vue'

export function useNow(intervalMs = 30_000) {
  const now = ref(new Date())
  let timer: number | undefined
  onMounted(() => {
    timer = window.setInterval(() => (now.value = new Date()), intervalMs)
  })
  onUnmounted(() => window.clearInterval(timer))
  return now
}
