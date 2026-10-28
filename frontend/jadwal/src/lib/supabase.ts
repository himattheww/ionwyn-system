import { createPlannerClient, createSupabaseStore } from '../../../../backend/jadwal/adapters/supabase/store'
import { syncingFetch } from '../../../shared/sync'

const url = import.meta.env.SUPABASE_URL
const key = import.meta.env.SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
export const client = createPlannerClient(url ?? 'http://localhost', key ?? 'missing', syncingFetch)
export const store = createSupabaseStore(client)
