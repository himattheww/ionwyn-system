import { toDate } from '../dates.ts'
import type { SourceEvent } from '../types.ts'
import { supabaseRows, type SupabaseConfig } from './supabase.ts'

const isLinked = (activityType: unknown, linked: string[]) =>
  typeof activityType === 'string' && linked.some(type => (type.endsWith(':') ? activityType.startsWith(type) : activityType === type))

export function scheduleEvents(rows: Record<string, unknown>[], linkedActivityTypes: string[] = []): SourceEvent[] {
  return rows.flatMap(row => {
    const date = toDate(row.completed_at) ?? toDate(row.date)
    if (row.status !== 'selesai' || !date || isLinked(row.activity_type, linkedActivityTypes)) return []
    return [{ id: `schedule:item:${row.item_id}`, source: 'schedule', type: 'item_done', date, value: 1, meta: { module: row.module ?? null } }]
  })
}

export async function readSchedule(config: SupabaseConfig, linkedActivityTypes: string[]) {
  const rows = await supabaseRows(config, 'exp_events', 'select=item_id,module,activity_type,date,status,completed_at&status=eq.selesai&order=date')
  return scheduleEvents(rows, linkedActivityTypes)
}
