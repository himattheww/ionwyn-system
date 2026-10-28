import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const read = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0
  } catch {
    return 0
  }
}

const write = (key: string, seconds: number) => {
  try {
    localStorage.setItem(key, String(seconds))
  } catch {
    return
  }
}

export function useStudyTimer(topicId: string) {
  const key = `learn.timer:${topicId}`
  const seconds = ref(read(key))
  const paused = ref(false)
  const running = ref(true)
  let tick: number | undefined

  const step = () => {
    if (paused.value || !running.value || document.hidden) return
    seconds.value += 1
    write(key, seconds.value)
  }

  onMounted(() => {
    tick = window.setInterval(step, 1000)
  })
  onBeforeUnmount(() => window.clearInterval(tick))

  const minutes = computed(() => Math.floor(seconds.value / 60))
  const clock = computed(() => {
    const m = Math.floor(seconds.value / 60)
    const s = seconds.value % 60
    return `${m}:${String(s).padStart(2, '0')}`
  })

  function reset() {
    seconds.value = 0
    write(key, 0)
  }

  function stop() {
    running.value = false
  }

  return { minutes, clock, paused, reset, stop }
}
