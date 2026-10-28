import { ref, shallowRef } from 'vue'

export function useLoad<T>(load: () => Promise<T>) {
  const data = shallowRef<T | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function reload() {
    loading.value = true
    error.value = null
    try {
      data.value = await load()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, reload }
}
