export async function sessionState() {
  try {
    const response = await fetch('/hub/api/session', { credentials: 'same-origin' })
    if (response.status === 404) return 'local'
    return response.ok ? 'signed-in' : 'signed-out'
  } catch {
    return 'local'
  }
}

export async function signIn(email, password) {
  const response = await fetch('/hub/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'Tidak bisa masuk. Coba lagi.')
  localStorage.setItem(body.storageKey, JSON.stringify(body.session))
}

export async function signOut() {
  const response = await fetch('/hub/api/session', { method: 'DELETE' })
  const body = await response.json().catch(() => ({}))
  if (body.storageKey) localStorage.removeItem(body.storageKey)
}
