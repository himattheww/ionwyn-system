import type { Db } from '../db.ts'
import type { SourceEvent } from '../types.ts'

export async function readWishes(db: Db): Promise<SourceEvent[]> {
  const rows = await db.all<{ id: number; title: string; size: string; attribute: string; achieved_on: string }>(
    'select id, title, size, attribute, achieved_on::text as achieved_on from leveling_wishes where achieved_on is not null order by achieved_on'
  )
  return rows.map(row => ({
    id: `wish:${row.id}`,
    source: 'wish',
    type: 'achieved',
    date: row.achieved_on,
    value: 1,
    meta: { title: row.title, size: row.size, attribute: row.attribute }
  }))
}
