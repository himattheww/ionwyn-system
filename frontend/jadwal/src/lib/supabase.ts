import { createPlannerClient, createSupabaseStore } from '../../../../backend/jadwal/adapters/supabase/store'

const url = import.meta.env.SUPABASE_URL
const key = import.meta.env.SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
export const client = createPlannerClient(url ?? 'http://localhost', key ?? 'missing')
export const store = createSupabaseStore(client)
