let pending: ReturnType<typeof setTimeout> | undefined

export function requestSync() {
  clearTimeout(pending)
  pending = setTimeout(() => {
    fetch('/hub/api/sync', { method: 'POST' }).catch(() => undefined)
  }, 1500)
}

export const syncingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  const method = (init?.method ?? 'GET').toUpperCase()
  const url = input instanceof Request ? input.url : String(input)
  if (res.ok && method !== 'GET' && method !== 'HEAD' && url.includes('/rest/v1/') && !url.includes('/rpc/')) requestSync()
  return res
}
