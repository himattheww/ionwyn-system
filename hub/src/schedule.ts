import { randomUUID } from 'node:crypto'
import { createPlannerClient, createSupabaseStore } from '../../reminder-and-scheduling/adapters/supabase/store.ts'
import type { Store } from '../../reminder-and-scheduling/core/src/index.ts'
import { config } from './config.ts'

export const newId = () => randomUUID()

let cached: { store: Store; expiresAt: number } | null = null

export async function scheduleStore() {
  const { url, key, email, password } = config.schedule
  if (!url || !key || !email || !password) throw new Error('SCHEDULE_SUPABASE_URL, SCHEDULE_SUPABASE_KEY, SCHEDULE_EMAIL, atau SCHEDULE_PASSWORD belum diisi')
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.store
  const client = createPlannerClient(url, key)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login Scheduling gagal: ${error.message}`)
  cached = { store: createSupabaseStore(client), expiresAt: (data.session?.expires_at ?? 0) * 1000 }
  return cached.store
}
