import { ref } from 'vue'

const PREFIX = 'cache:'

type QueryResult<T> = { data: T | null; error: unknown; status: number }

export const isOffline = ref(!navigator.onLine)

export function writeCache(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export async function cachedQuery<T>(key: string, query: PromiseLike<QueryResult<T>>) {
  const res = await query
  if (!res.error) {
    isOffline.value = false
    writeCache(key, res.data)
    return { data: res.data }
  }
  if (res.status === 0) {
    isOffline.value = true
    const value = localStorage.getItem(PREFIX + key)
    return { data: value ? (JSON.parse(value) as T | null) : null }
  }
  return { data: res.data }
}

export function clearCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k))
}
