import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type Saved = { startedAt: number | null; banked: number }

const read = (key: string): Saved => {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (typeof raw === 'number') return { startedAt: null, banked: raw }
    if (raw && typeof raw === 'object') return { startedAt: raw.startedAt ?? null, banked: raw.banked ?? 0 }
  } catch {
    return { startedAt: null, banked: 0 }
  }
  return { startedAt: null, banked: 0 }
}

const write = (key: string, saved: Saved) => {
  try {
    localStorage.setItem(key, JSON.stringify(saved))
  } catch {
    return
  }
}

export function useStudyTimer(topicId: string) {
  const key = `learn.timer:${topicId}`
  const saved = ref(read(key))
  const now = ref(Date.now())
  let tick: number | undefined

  onMounted(() => {
    tick = window.setInterval(() => (now.value = Date.now()), 1000)
  })
  onBeforeUnmount(() => window.clearInterval(tick))

  const running = computed(() => saved.value.startedAt !== null)
  const seconds = computed(() => {
    const live = saved.value.startedAt === null ? 0 : (now.value - saved.value.startedAt) / 1000
    return Math.max(0, Math.floor(saved.value.banked + live))
  })
  const minutes = computed(() => Math.floor(seconds.value / 60))
  const clock = computed(() => {
    const h = Math.floor(seconds.value / 3600)
    const m = Math.floor((seconds.value % 3600) / 60)
    const s = seconds.value % 60
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`
  })

  function save(next: Saved) {
    saved.value = next
    now.value = Date.now()
    write(key, next)
  }

  function start() {
    if (!running.value) save({ startedAt: Date.now(), banked: saved.value.banked })
  }

  function pause() {
    if (running.value) save({ startedAt: null, banked: seconds.value })
  }

  function reset() {
    save({ startedAt: null, banked: 0 })
  }

  return { minutes, clock, running, start, pause, reset }
}
