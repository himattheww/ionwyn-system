import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { dbFromUnsafe, parsers } from '../src/db.ts'
import { parseRules, type Rules } from '../src/rules.ts'
import type { SourceEvent } from '../src/types.ts'

export const rulesText = readFileSync(new URL('../config/rules.json', import.meta.url), 'utf8')

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

const migrations = ['20261020100000_catatan_malam.sql', '20261020101000_fitness.sql', '20261020102000_leveling.sql'].map(name =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8')
)

export async function testDb() {
  const pg = new PGlite({ parsers: { 20: parsers.int8, 1082: parsers.date, 1184: parsers.timestamptz } })
  await pg.exec('create role anon; create role authenticated;')
  for (const sql of migrations) await pg.exec(sql)
  type Runner = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> }
  const unsafeOf = (runner: Runner) => async (text: string, params: never[]) => {
    const result = await runner.query(text, params)
    return Object.assign(result.rows, { count: result.affectedRows ?? result.rows.length }) as never
  }
  return dbFromUnsafe(unsafeOf(pg), work => pg.transaction(tx => work(unsafeOf(tx))))
}
