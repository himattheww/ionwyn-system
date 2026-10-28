import { createClient, type Session } from '@supabase/supabase-js'
import { syncingFetch } from '../../../shared/sync'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: authStorageKey,
  },
  global: { fetch: syncingFetch },
})

export function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(authStorageKey)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}
