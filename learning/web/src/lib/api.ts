type ErrorBody = { message?: string; errors?: Record<string, string[]> }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${import.meta.env.BASE_URL}api${path}`, { ...init, headers: { 'content-type': 'application/json' } })
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Pastikan server berjalan.')
  }

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (res.ok) return body as T

  const error = body as ErrorBody | null
  if (!error?.message) throw new Error(`Server tidak merespons dengan benar (${res.status}). Pastikan server berjalan.`)
  const details = Object.entries(error.errors ?? {}).map(([field, messages]) => `${field}: ${messages.join(', ')}`)
  throw new Error(details.length ? `${error.message} (${details.join('; ')})` : error.message)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Terjadi kesalahan')
