import { isoWeekday, toDate } from '../dates.ts'
import type { Rules } from '../rules.ts'
import type { SourceEvent } from '../types.ts'
import { openReadOnly } from './sqlite.ts'

interface ActivityRow {
  garmin_id: number
  type: string
  date: string
  distance_m: number | null
  strength_sets: number
}

export function parseRunPattern(value: string | undefined) {
  if (!value) return new Set<number>()
  const pattern = JSON.parse(value) as Record<string, unknown>
  return new Set(Object.keys(pattern).filter(key => pattern[key]).map(Number))
}

export function readFit(path: string | undefined, rules: Rules): SourceEvent[] {
  const db = openReadOnly(path)
  try {
    const types = rules.stamina.activityTypes
    const setting = db.prepare(`select value from settings where key = 'run_pattern'`).get() as { value: string } | undefined
    const runDays = parseRunPattern(setting?.value)
    const activities = db
      .prepare(
        `select a.garmin_id, a.type, a.date, a.distance_m,
          (select count(*) from strength_sets s where s.activity_garmin_id = a.garmin_id) as strength_sets
         from activities a order by a.start_time`
      )
      .all() as ActivityRow[]

    const events: SourceEvent[] = []
    for (const row of activities) {
      const date = toDate(row.date)
      if (!date || types.ignore.includes(row.type)) continue
      const id = `fit:activity:${row.garmin_id}`
      if (types.run.includes(row.type)) {
        const km = Math.round(((row.distance_m ?? 0) / 1000) * 100) / 100
        events.push({ id, source: 'fit', type: 'run', date, value: km, meta: { scheduled: runDays.has(isoWeekday(date)) } })
      } else if (types.strength.includes(row.type) || row.strength_sets > 0) {
        events.push({ id, source: 'fit', type: 'strength', date, value: 1, meta: { activityType: row.type } })
      } else {
        const sport = types.swim.includes(row.type) ? 'swim' : 'other'
        events.push({ id, source: 'fit', type: 'sport', date, value: 1, meta: { sport, activityType: row.type } })
      }
    }

    const sleeps = db.prepare('select date, sleep_min from recovery_daily where sleep_min is not null').all() as { date: string; sleep_min: number }[]
    for (const row of sleeps) {
      const hours = Math.round((row.sleep_min / 60) * 100) / 100
      events.push({ id: `fit:sleep:${row.date}`, source: 'fit', type: 'sleep', date: row.date, value: hours, meta: {} })
    }

    const meals = db.prepare('select date from meals where protein_met = 1').all() as { date: string }[]
    for (const row of meals) {
      events.push({ id: `fit:protein:${row.date}`, source: 'fit', type: 'protein', date: row.date, value: 1, meta: {} })
    }
    return events
  } finally {
    db.close()
  }
}
