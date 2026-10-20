import postgres from 'postgres'

export interface RelationStatus {
  id: string
  label: string
  lastRunAt: string | null
  lastOkAt: string | null
  lastError: string | null
  lastResult: string | null
}

let sql: postgres.Sql | null = null
const db = () => (sql ??= postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, idle_timeout: 20 }))
const memory = new Map<string, RelationStatus>()

const iso = (value: Date | null) => (value ? value.toISOString() : null)

export async function loadStatus(): Promise<RelationStatus[]> {
  if (!process.env.DATABASE_URL) return [...memory.values()]
  const rows = await db()<{ id: string; label: string; last_run_at: Date | null; last_ok_at: Date | null; last_error: string | null; last_result: string | null }[]>`
    select id, label, last_run_at, last_ok_at, last_error, last_result from public.hub_integration_status`
  return rows.map(r => ({
    id: r.id,
    label: r.label,
    lastRunAt: iso(r.last_run_at),
    lastOkAt: iso(r.last_ok_at),
    lastError: r.last_error,
    lastResult: r.last_result
  }))
}

export async function saveStatus(list: RelationStatus[]) {
  for (const s of list) memory.set(s.id, { ...s })
  if (!process.env.DATABASE_URL || !list.length) return
  const rows = list.map(s => ({
    id: s.id,
    label: s.label,
    last_run_at: s.lastRunAt,
    last_ok_at: s.lastOkAt,
    last_error: s.lastError,
    last_result: s.lastResult
  }))
  await db()`
    insert into public.hub_integration_status ${db()(rows)}
    on conflict (id) do update set label = excluded.label, last_run_at = excluded.last_run_at, last_ok_at = excluded.last_ok_at,
      last_error = excluded.last_error, last_result = excluded.last_result`
}
