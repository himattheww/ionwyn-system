import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

export const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export class NotFoundError extends Error {}

export function unwrap<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error) throw error
  if (data === null || data === undefined) throw new NotFoundError('Data tidak ditemukan')
  return data
}
