import express, { type NextFunction, type Request, type Response, Router } from 'express'

const supabaseUrl = (process.env.SUPABASE_AUTH_URL ?? process.env.FINANCE_SUPABASE_URL ?? '').replace(/\/$/, '')
const anonKey = process.env.SUPABASE_AUTH_KEY ?? process.env.FINANCE_SUPABASE_KEY ?? ''
const ownerId = process.env.OWNER_USER_ID ?? ''
const internalSecret = process.env.INTERNAL_SECRET ?? ''

const ACCESS = 'ionwyn_access'
const REFRESH = 'ionwyn_refresh'
const storageKey = supabaseUrl ? `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token` : ''

interface Session {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in: number
  user: { id: string; email?: string }
}

const verified = new Map<string, { id: string; until: number }>()

function cookies(req: Request) {
  return Object.fromEntries(
    (req.headers.cookie ?? '')
      .split(';')
      .map(part => part.trim().split('='))
      .filter(([key]) => key)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join('='))])
  ) as Record<string, string>
}

function setSession(res: Response, session: Session) {
  const base = 'Path=/; HttpOnly; Secure; SameSite=Lax'
  res.append('Set-Cookie', `${ACCESS}=${encodeURIComponent(session.access_token)}; Max-Age=${session.expires_in}; ${base}`)
  res.append('Set-Cookie', `${REFRESH}=${encodeURIComponent(session.refresh_token)}; Max-Age=${60 * 60 * 24 * 60}; ${base}`)
}

function clearSession(res: Response) {
  for (const name of [ACCESS, REFRESH]) res.append('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`)
}

async function grant(type: 'password' | 'refresh_token', body: object) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=${type}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) return null
  return (await response.json()) as Session
}

async function ownerFromToken(token: string) {
  const cached = verified.get(token)
  if (cached && cached.until > Date.now()) return cached.id
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: anonKey, authorization: `Bearer ${token}` } })
  if (!response.ok) return null
  const user = (await response.json()) as { id: string }
  if (user.id !== ownerId) return null
  verified.set(token, { id: user.id, until: Date.now() + 5 * 60_000 })
  return user.id
}

async function authorize(req: Request, res: Response) {
  if (internalSecret && req.headers['x-ionwyn-internal'] === internalSecret) return true
  const jar = cookies(req)
  if (jar[ACCESS] && (await ownerFromToken(jar[ACCESS]))) return true
  if (!jar[REFRESH]) return false
  const session = await grant('refresh_token', { refresh_token: jar[REFRESH] })
  if (!session || session.user.id !== ownerId) return false
  setSession(res, session)
  return true
}

export function authRoutes() {
  const router = Router()

  router.post('/hub/api/session', express.json(), async (req, res) => {
    const { email, password } = req.body ?? {}
    if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Isi email dan password.' })
    const session = await grant('password', { email, password })
    if (!session) return res.status(401).json({ error: 'Email atau password salah.' })
    if (session.user.id !== ownerId) return res.status(403).json({ error: 'Akun ini tidak punya akses ke Ionwyn.' })
    setSession(res, session)
    res.json({ storageKey, session: { ...session, expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in } })
  })

  router.get('/hub/api/session', async (req, res) => {
    if (!(await authorize(req, res))) return res.status(401).json({ error: 'Perlu login.' })
    res.json({ ok: true, storageKey })
  })

  router.delete('/hub/api/session', (_req, res) => {
    clearSession(res)
    res.json({ ok: true, storageKey })
  })

  return router
}

export const isOwner = (req: Request, res: Response) => authorize(req, res)

export async function requireOwner(req: Request, res: Response, next: NextFunction) {
  try {
    if (await authorize(req, res)) return next()
    res.status(401).json({ error: 'Perlu login.', message: 'Perlu login.' })
  } catch (error) {
    next(error)
  }
}
