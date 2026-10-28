import { toDate } from '../dates.ts'
import type { SourceEvent } from '../types.ts'
import { supabaseRows, type SupabaseConfig } from './supabase.ts'

export async function readStock(config: SupabaseConfig, table: string, dateColumn: string): Promise<SourceEvent[]> {
  const rows = await supabaseRows(config, table, `select=id,${dateColumn}&order=${dateColumn}`)
  return rows.flatMap(row => {
    const date = toDate(row[dateColumn])
    if (!date) return []
    return [{ id: `stock:${table}:${row.id}`, source: 'stock', type: 'activity', date, value: 1, meta: {} }]
  })
}
