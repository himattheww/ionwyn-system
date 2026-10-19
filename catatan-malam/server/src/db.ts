import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

type EntryRow = {
  entry_date: string
  happened: string
  good_things: string
  lessons: string
  free_text: string | null
  is_backfilled: number
  created_at: string
  updated_at: string
}

export type EntryInput = {
  happened: string
  goodThings: string
  lessons: string
  freeText: string | null
}

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL UNIQUE,
      happened TEXT NOT NULL,
      good_things TEXT NOT NULL,
      lessons TEXT NOT NULL,
      free_text TEXT,
      is_backfilled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  return db
}

export type Db = ReturnType<typeof openDatabase>

function toEntry(row: EntryRow) {
  return {
    date: row.entry_date,
    happened: row.happened,
    goodThings: row.good_things,
    lessons: row.lessons,
    freeText: row.free_text,
    isBackfilled: row.is_backfilled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function findEntry(db: Db, date: string) {
  const row = db.prepare('SELECT * FROM entries WHERE entry_date = ?').get(date) as EntryRow | undefined
  return row ? toEntry(row) : null
}

export function insertEntry(db: Db, date: string, input: EntryInput, isBackfilled: boolean) {
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO entries (entry_date, happened, good_things, lessons, free_text, is_backfilled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(date, input.happened, input.goodThings, input.lessons, input.freeText, isBackfilled ? 1 : 0, now, now)
  return findEntry(db, date)!
}

export function updateEntry(db: Db, date: string, input: EntryInput) {
  db.prepare(
    `UPDATE entries SET happened = ?, good_things = ?, lessons = ?, free_text = ?, updated_at = ?
     WHERE entry_date = ?`,
  ).run(input.happened, input.goodThings, input.lessons, input.freeText, new Date().toISOString(), date)
  return findEntry(db, date)!
}

export function listMonth(db: Db, month: string) {
  const rows = db
    .prepare('SELECT entry_date, is_backfilled FROM entries WHERE entry_date LIKE ? ORDER BY entry_date')
    .all(`${month}-%`) as Pick<EntryRow, 'entry_date' | 'is_backfilled'>[]
  return rows.map((r) => ({ date: r.entry_date, isBackfilled: r.is_backfilled === 1 }))
}

export function listRecent(db: Db, limit: number) {
  const rows = db.prepare('SELECT * FROM entries ORDER BY entry_date DESC LIMIT ?').all(limit) as EntryRow[]
  return rows.map(toEntry)
}

export function listSameDayEarlierYears(db: Db, date: string) {
  const rows = db
    .prepare('SELECT * FROM entries WHERE substr(entry_date, 6) = ? AND entry_date < ? ORDER BY entry_date DESC')
    .all(date.slice(5), date) as EntryRow[]
  return rows.map(toEntry)
}

export function listField(db: Db, column: 'lessons' | 'good_things', from?: string, to?: string) {
  const rows = db
    .prepare(
      `SELECT entry_date, ${column} AS text FROM entries
       WHERE entry_date >= ? AND entry_date <= ?
       ORDER BY entry_date DESC`,
    )
    .all(from ?? '0000-01-01', to ?? '9999-12-31') as { entry_date: string; text: string }[]
  return rows.map((r) => ({ date: r.entry_date, text: r.text }))
}

export function searchEntries(db: Db, keyword: string) {
  const pattern = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`
  const rows = db
    .prepare(
      `SELECT * FROM entries
       WHERE happened LIKE @pattern ESCAPE '\\' OR good_things LIKE @pattern ESCAPE '\\'
          OR lessons LIKE @pattern ESCAPE '\\' OR free_text LIKE @pattern ESCAPE '\\'
       ORDER BY entry_date DESC LIMIT 100`,
    )
    .all({ pattern }) as EntryRow[]
  return rows.map(toEntry)
}
