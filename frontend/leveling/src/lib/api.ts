import { ref } from 'vue'

export type { CharacterState, HistoryItem, Quest } from '../../../../backend/leveling/src/types.ts'

export async function api<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${import.meta.env.BASE_URL}api${path}`, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error ?? `Server membalas ${response.status}`)
  return body as T
}

export function useLoad<T>(load: () => Promise<T>) {
  const data = ref<T | null>(null)
  const loading = ref(true)
  const error = ref('')
  async function reload() {
    loading.value = true
    error.value = ''
    try {
      data.value = await load()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }
  reload()
  return { data, loading, error, reload }
}

export const refreshEvent = 'leveling:refresh'

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
