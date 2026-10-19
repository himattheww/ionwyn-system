import { toDate } from '../dates.ts'
import type { SourceEvent } from '../types.ts'
import { openReadOnly } from './sqlite.ts'

export function readDiary(path: string | undefined): SourceEvent[] {
  const db = openReadOnly(path)
  try {
    const rows = db.prepare('select id, entry_date, is_backfilled from entries order by entry_date').all() as {
      id: number
      entry_date: string
      is_backfilled: number
    }[]
    return rows.flatMap(row => {
      const date = toDate(row.entry_date)
      if (!date) return []
      return [{ id: `diary:entry:${row.id}`, source: 'diary', type: 'entry', date, value: 1, meta: { backfilled: row.is_backfilled === 1 } }]
    })
  } finally {
    db.close()
  }
}
