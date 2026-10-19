import Database from 'better-sqlite3'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRules, type Rules } from '../src/rules.ts'
import type { SourceEvent } from '../src/types.ts'

export const rulesText = readFileSync(new URL('../../config/rules.json', import.meta.url), 'utf8')

export function testRules(change: (rules: Rules) => void = () => {}) {
  const rules = parseRules(rulesText).rules
  change(rules)
  return rules
}

export function event(source: string, type: string, date: string, value = 1, meta: Record<string, unknown> = {}, id?: string): SourceEvent {
  return { id: id ?? `${source}:${type}:${date}:${value}:${Math.random()}`, source, type, date, value, meta }
}

export const run = (date: string, km: number, scheduled = false) => event('fit', 'run', date, km, { scheduled })
export const session = (date: string, minutes: number, trackName = 'C#', category = 'pemrograman') =>
  event('learn', 'session', date, minutes, { trackId: '1', trackName, category })
export const entry = (date: string, backfilled = false) => event('diary', 'entry', date, 1, { backfilled })

function tempDb(name: string, sql: string) {
  const path = join(mkdtempSync(join(tmpdir(), 'leveling-')), name)
  const db = new Database(path)
  db.exec(sql)
  return { db, path }
}

export function fitFixture() {
  return tempDb(
    'fitness.db',
    `create table activities (garmin_id integer primary key, type text not null, name text, start_time text not null, date text not null, duration_sec real, distance_m real, avg_hr real, avg_pace_sec_per_km real, calories real);
     create table strength_sets (activity_garmin_id integer not null, set_order integer not null, exercise_name text not null, reps integer, weight_kg real, duration_sec real, primary key (activity_garmin_id, set_order));
     create table recovery_daily (date text primary key, sleep_min real, sleep_score integer, rhr integer, source text not null);
     create table meals (date text primary key, protein_met integer not null, rice_portions real not null);
     create table settings (key text primary key, value text not null);
     insert into settings values ('run_pattern', '{"1":"easy","3":"tempo","5":"easy","7":"long run"}');`
  )
}

export function diaryFixture() {
  return tempDb(
    'catatan.db',
    `create table entries (id integer primary key autoincrement, entry_date text not null unique, happened text not null, good_things text not null, lessons text not null, free_text text, is_backfilled integer not null default 0, created_at text not null, updated_at text not null);`
  )
}
