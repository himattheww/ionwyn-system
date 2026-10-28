import { isoWeekday, toDate } from '../dates.ts'
import type { Rules } from '../rules.ts'
import type { SourceEvent } from '../types.ts'
import type { Db } from '../db.ts'

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

export async function readFit(db: Db, rules: Rules): Promise<SourceEvent[]> {
  const types = rules.stamina.activityTypes
  const [setting, activities, sleeps, meals] = await Promise.all([
    db.one<{ value: string }>(`select value from fit_settings where key = 'run_pattern'`),
    db.all<ActivityRow>(
      `select a.garmin_id, a.type, a.date, a.distance_m,
        (select count(*)::int from fit_strength_sets s where s.activity_garmin_id = a.garmin_id) as strength_sets
       from fit_activities a order by a.start_time`
    ),
    db.all<{ date: string; sleep_min: number }>('select date, sleep_min from fit_recovery_daily where sleep_min is not null'),
    db.all<{ date: string }>('select date from fit_meals where protein_met = 1')
  ])
  const runDays = parseRunPattern(setting?.value)

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

  for (const row of sleeps) {
    const hours = Math.round((row.sleep_min / 60) * 100) / 100
    events.push({ id: `fit:sleep:${row.date}`, source: 'fit', type: 'sleep', date: row.date, value: hours, meta: {} })
  }

  for (const row of meals) {
    events.push({ id: `fit:protein:${row.date}`, source: 'fit', type: 'protein', date: row.date, value: 1, meta: {} })
  }
  return events
}
