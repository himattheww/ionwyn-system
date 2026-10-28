import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { root } from './apps.mjs'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL belum diisi di .env root')

const sources = {
  catatan: resolve(root, 'backend/catatan/data/catatan.db'),
  fit: resolve(root, 'backend/fitness/data/fitness.db')
}

const plan = [
  {
    db: 'catatan',
    from: 'select entry_date, happened, good_things, lessons, free_text, is_backfilled = 1 as is_backfilled, created_at, updated_at from entries',
    into: 'catatan_entries',
    conflict: 'entry_date'
  },
  { db: 'fit', from: 'select * from activities', into: 'fit_activities', conflict: 'garmin_id' },
  { db: 'fit', from: 'select * from strength_sets', into: 'fit_strength_sets', conflict: 'activity_garmin_id, set_order' },
  { db: 'fit', from: 'select * from recovery_daily', into: 'fit_recovery_daily', conflict: 'date' },
  { db: 'fit', from: 'select * from condition_daily', into: 'fit_condition_daily', conflict: 'date' },
  { db: 'fit', from: 'select * from weights', into: 'fit_weights', conflict: 'date' },
  { db: 'fit', from: 'select * from meals', into: 'fit_meals', conflict: 'date' },
  { db: 'fit', from: 'select kind, ref, fetched_at, payload from garmin_raw', into: 'fit_garmin_raw', conflict: null },
  { db: 'fit', from: 'select key, value from settings', into: 'fit_settings', conflict: 'key', update: 'value' },
  { db: 'fit', from: 'select id, last_success_at, last_error_at, last_error from sync_status', into: 'fit_sync_status', conflict: 'id', update: 'last_success_at, last_error_at, last_error' }
]

const sql = postgres(url, { prepare: false, max: 1 })
const opened = Object.fromEntries(Object.entries(sources).filter(([, path]) => existsSync(path)).map(([name, path]) => [name, new DatabaseSync(path, { readOnly: true })]))

try {
  const [{ count }] = await sql`select count(*)::int as count from fit_garmin_raw`
  for (const step of plan) {
    const source = opened[step.db]
    if (!source) {
      console.log(`lewati  ${step.into}: file ${sources[step.db]} tidak ada`)
      continue
    }
    if (step.into === 'fit_garmin_raw' && count > 0) {
      console.log(`lewati  ${step.into}: sudah berisi ${count} baris`)
      continue
    }
    const rows = source.prepare(step.from).all().map(row => ({ ...row }))
    if (!rows.length) {
      console.log(`kosong  ${step.into}`)
      continue
    }
    const columns = Object.keys(rows[0])
    for (const row of rows) for (const key of columns) if (key === 'is_backfilled') row[key] = Boolean(row[key])
    const onConflict = step.conflict
      ? step.update
        ? sql`on conflict (${sql.unsafe(step.conflict)}) do update set ${sql.unsafe(step.update.split(', ').map(c => `${c} = excluded.${c}`).join(', '))}`
        : sql`on conflict (${sql.unsafe(step.conflict)}) do nothing`
      : sql``
    for (let i = 0; i < rows.length; i += 500) {
      await sql`insert into ${sql('public.' + step.into)} ${sql(rows.slice(i, i + 500), columns)} ${onConflict}`
    }
    console.log(`ok      ${step.into}: ${rows.length} baris`)
  }
} finally {
  await sql.end()
  for (const db of Object.values(opened)) db.close()
}
