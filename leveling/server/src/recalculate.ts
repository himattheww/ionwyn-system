import type { Db } from './db.ts'
import { changesBetween } from './engine/diff.ts'
import { buildExp } from './engine/exp.ts'
import { buildProgress } from './engine/progress.ts'
import { parseRules, type Rules } from './rules.ts'
import type { Adapter, CharacterState, SourceEvent } from './types.ts'

export interface RecalculateInput {
  rulesText: string
  adapters: (rules: Rules) => Adapter[]
  today: string
  targetLongRunKm?: number
  notify?: (lines: string[]) => void
}

async function readSource(adapter: Adapter) {
  if (!adapter.enabled) return { adapter, events: null, error: null }
  try {
    return { adapter, events: await adapter.read(), error: null }
  } catch (error) {
    return { adapter, events: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function recalculate(db: Db, input: RecalculateInput) {
  const { rules, hash } = parseRules(input.rulesText)
  const results = await Promise.all(input.adapters(rules).map(readSource))
  const now = new Date().toISOString()

  await db.transaction(async tx => {
    for (const [position, { adapter, events, error }] of results.entries()) {
      await tx.run(
        `insert into leveling_sources (name, position, label, enabled, last_read_at, last_error, event_count)
         values (?, ?, ?, ?, ?, ?, ?)
         on conflict (name) do update set
           position = excluded.position,
           label = excluded.label,
           enabled = excluded.enabled,
           last_read_at = coalesce(excluded.last_read_at, leveling_sources.last_read_at),
           last_error = excluded.last_error,
           event_count = coalesce(excluded.event_count, leveling_sources.event_count)`,
        [adapter.name, position, adapter.label, adapter.enabled, events ? now : null, error, events ? events.length : null]
      )
      if (!events) continue
      await tx.run('delete from leveling_events where source = ?', [adapter.name])
      await tx.run(
        `insert into leveling_events (id, source, type, date, value, meta)
         select id, source, type, date::date, value, meta from jsonb_to_recordset(?::text::jsonb)
           as e(id text, source text, type text, date text, value double precision, meta jsonb)
         on conflict (id) do update set source = excluded.source, type = excluded.type, date = excluded.date, value = excluded.value, meta = excluded.meta`,
        [JSON.stringify(events)]
      )
    }
  })

  const events = await db.all<SourceEvent>('select id, source, type, date, value, meta from leveling_events order by date, id')
  const { entries, quests } = buildExp(events, rules, input.today)
  const { state, history } = buildProgress(entries, events, quests, rules, input.today, input.targetLongRunKm)

  const previous = await db.one<{ rules_hash: string; state: CharacterState }>('select rules_hash, state from leveling_snapshot where id = 1')
  const silent = !previous || previous.rules_hash !== hash
  const lines = silent ? [] : changesBetween(previous.state, state, rules)

  await db.transaction(async tx => {
    await tx.run('delete from leveling_exp_entries')
    await tx.run('delete from leveling_history')
    await tx.run(
      `insert into leveling_exp_entries (date, attribute, source, rule, grp, event_id, note, raw, awarded, capped)
       select date::date, attribute, source, rule, "group", "eventId", note, raw, awarded, capped from jsonb_to_recordset(?::text::jsonb)
         as e(date text, attribute text, source text, rule text, "group" text, "eventId" text, note text, raw double precision, awarded double precision, capped double precision)`,
      [JSON.stringify(entries)]
    )
    await tx.run(
      `insert into leveling_history (date, kind, text)
       select date::date, kind, text from jsonb_to_recordset(?::text::jsonb) as h(date text, kind text, text text)`,
      [JSON.stringify(history)]
    )
    await tx.run(
      `insert into leveling_snapshot (id, rules_hash, state, created_at) values (1, ?, ?::text::jsonb, ?)
       on conflict (id) do update set rules_hash = excluded.rules_hash, state = excluded.state, created_at = excluded.created_at`,
      [hash, JSON.stringify(state), now]
    )
    if (lines.length > 0) await tx.run('insert into leveling_notifications (created_at, lines) values (?, ?::text::jsonb)', [now, JSON.stringify(lines)])
  })

  if (lines.length > 0) input.notify?.(lines)
  return { state, lines, silent, events: events.length }
}
