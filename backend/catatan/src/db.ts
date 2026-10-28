import postgres from 'postgres'

export type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>

type EntryRow = {
  entry_date: string
  happened: string
  good_things: string
  lessons: string
  free_text: string | null
  is_backfilled: boolean
  created_at: string
  updated_at: string
}

export type EntryInput = {
  happened: string
  goodThings: string
  lessons: string
  freeText: string | null
}

export function connect(url: string): Query {
  const sql = postgres(url, { prepare: false, max: Number(process.env.PG_POOL_MAX ?? 3), idle_timeout: 20 })
  return (text, params = []) => sql.unsafe(text, params as never[]) as never
}

const columns = `entry_date::text as entry_date, happened, good_things, lessons, free_text, is_backfilled,
  to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at,
  to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`

function toEntry(row: EntryRow) {
  return {
    date: row.entry_date,
    happened: row.happened,
    goodThings: row.good_things,
    lessons: row.lessons,
    freeText: row.free_text,
    isBackfilled: row.is_backfilled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findEntry(query: Query, date: string) {
  const [row] = await query<EntryRow>(`select ${columns} from catatan_entries where entry_date = $1`, [date])
  return row ? toEntry(row) : null
}

export async function insertEntry(query: Query, date: string, input: EntryInput, isBackfilled: boolean) {
  const [row] = await query<EntryRow>(
    `insert into catatan_entries (entry_date, happened, good_things, lessons, free_text, is_backfilled)
     values ($1, $2, $3, $4, $5, $6) returning ${columns}`,
    [date, input.happened, input.goodThings, input.lessons, input.freeText, isBackfilled],
  )
  return toEntry(row!)
}

export async function updateEntry(query: Query, date: string, input: EntryInput) {
  const [row] = await query<EntryRow>(
    `update catatan_entries set happened = $2, good_things = $3, lessons = $4, free_text = $5, updated_at = now()
     where entry_date = $1 returning ${columns}`,
    [date, input.happened, input.goodThings, input.lessons, input.freeText],
  )
  return toEntry(row!)
}

export async function listMonth(query: Query, month: string) {
  const rows = await query<Pick<EntryRow, 'entry_date' | 'is_backfilled'>>(
    `select entry_date::text as entry_date, is_backfilled from catatan_entries
     where entry_date >= ($1 || '-01')::date and entry_date < ($1 || '-01')::date + interval '1 month'
     order by entry_date`,
    [month],
  )
  return rows.map((r) => ({ date: r.entry_date, isBackfilled: r.is_backfilled }))
}

export async function listRecent(query: Query, limit: number) {
  const rows = await query<EntryRow>(`select ${columns} from catatan_entries order by entry_date desc limit $1`, [limit])
  return rows.map(toEntry)
}

export async function listSameDayEarlierYears(query: Query, date: string) {
  const rows = await query<EntryRow>(
    `select ${columns} from catatan_entries
     where to_char(entry_date, 'MM-DD') = to_char($1::date, 'MM-DD') and entry_date < $1::date
     order by entry_date desc`,
    [date],
  )
  return rows.map(toEntry)
}

export async function listField(query: Query, column: 'lessons' | 'good_things', from?: string, to?: string) {
  const rows = await query<{ entry_date: string; text: string }>(
    `select entry_date::text as entry_date, ${column} as text from catatan_entries
     where entry_date between $1::date and $2::date
     order by entry_date desc`,
    [from ?? '0001-01-01', to ?? '9999-12-31'],
  )
  return rows.map((r) => ({ date: r.entry_date, text: r.text }))
}

export async function searchEntries(query: Query, keyword: string) {
  const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`
  const rows = await query<EntryRow>(
    `select ${columns} from catatan_entries
     where happened ilike $1 or good_things ilike $1 or lessons ilike $1 or free_text ilike $1
     order by entry_date desc limit 100`,
    [pattern],
  )
  return rows.map(toEntry)
}
