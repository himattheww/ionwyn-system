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

  const saveSource = db.prepare(`
    insert into sources (name, label, enabled, last_read_at, last_error, event_count)
    values (@name, @label, @enabled, @lastReadAt, @lastError, @eventCount)
    on conflict (name) do update set
      label = excluded.label,
      enabled = excluded.enabled,
      last_read_at = coalesce(excluded.last_read_at, sources.last_read_at),
      last_error = excluded.last_error,
      event_count = coalesce(excluded.event_count, sources.event_count)
  `)
  const insertEvent = db.prepare('insert or replace into events (id, source, type, date, value, meta) values (?, ?, ?, ?, ?, ?)')
  db.transaction(() => {
    for (const { adapter, events, error } of results) {
      saveSource.run({
        name: adapter.name,
        label: adapter.label,
        enabled: adapter.enabled ? 1 : 0,
        lastReadAt: events ? now : null,
        lastError: error,
        eventCount: events ? events.length : null
      })
      if (!events) continue
      db.prepare('delete from events where source = ?').run(adapter.name)
      for (const e of events) insertEvent.run(e.id, e.source, e.type, e.date, e.value, JSON.stringify(e.meta))
    }
  })()

  const events = (db.prepare('select * from events order by date, id').all() as (Omit<SourceEvent, 'meta'> & { meta: string })[]).map(row => ({
    ...row,
    meta: JSON.parse(row.meta) as Record<string, unknown>
  }))
  const { entries, quests } = buildExp(events, rules, input.today)
  const { state, history } = buildProgress(entries, events, quests, rules, input.today, input.targetLongRunKm)

  const previous = db.prepare('select rules_hash, state from snapshot where id = 1').get() as { rules_hash: string; state: string } | undefined
  const silent = !previous || previous.rules_hash !== hash
  const lines = silent ? [] : changesBetween(JSON.parse(previous.state) as CharacterState, state, rules)

  const insertEntry = db.prepare(`
    insert into exp_entries (date, attribute, source, rule, grp, event_id, note, raw, awarded, capped)
    values (@date, @attribute, @source, @rule, @group, @eventId, @note, @raw, @awarded, @capped)
  `)
  const insertHistory = db.prepare('insert into history (date, kind, text) values (@date, @kind, @text)')
  db.transaction(() => {
    db.exec('delete from exp_entries; delete from history;')
    for (const entry of entries) insertEntry.run(entry)
    for (const item of history) insertHistory.run(item)
    db.prepare(`
      insert into snapshot (id, rules_hash, state, created_at) values (1, ?, ?, ?)
      on conflict (id) do update set rules_hash = excluded.rules_hash, state = excluded.state, created_at = excluded.created_at
    `).run(hash, JSON.stringify(state), now)
    if (lines.length > 0) db.prepare('insert into notifications (created_at, lines) values (?, ?)').run(now, JSON.stringify(lines))
  })()

  if (lines.length > 0) input.notify?.(lines)
  return { state, lines, silent, events: events.length }
}
