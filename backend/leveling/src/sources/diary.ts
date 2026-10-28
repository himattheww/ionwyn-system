import { toDate } from '../dates.ts'
import type { Db } from '../db.ts'
import type { SourceEvent } from '../types.ts'

export async function readDiary(db: Db): Promise<SourceEvent[]> {
  const rows = await db.all<{ id: number; entry_date: string; is_backfilled: boolean }>(
    'select id, entry_date::text as entry_date, is_backfilled from catatan_entries order by entry_date'
  )
  return rows.flatMap(row => {
    const date = toDate(row.entry_date)
    if (!date) return []
    return [{ id: `diary:entry:${row.id}`, source: 'diary', type: 'entry', date, value: 1, meta: { backfilled: row.is_backfilled } }]
  })
}
