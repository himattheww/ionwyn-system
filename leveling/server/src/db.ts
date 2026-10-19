import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type Db = Database.Database

export function openDb(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    create table if not exists events (
      id text primary key,
      source text not null,
      type text not null,
      date text not null,
      value real not null,
      meta text not null
    );
    create table if not exists exp_entries (
      id integer primary key,
      date text not null,
      attribute text not null,
      source text not null,
      rule text not null,
      grp text not null,
      event_id text,
      note text not null,
      raw real not null,
      awarded real not null,
      capped real not null
    );
    create index if not exists exp_entries_date on exp_entries(date);
    create table if not exists history (
      id integer primary key,
      date text not null,
      kind text not null,
      text text not null
    );
    create table if not exists snapshot (
      id integer primary key check (id = 1),
      rules_hash text not null,
      state text not null,
      created_at text not null
    );
    create table if not exists notifications (
      id integer primary key,
      created_at text not null,
      lines text not null
    );
    create table if not exists sources (
      name text primary key,
      label text not null,
      enabled integer not null,
      last_read_at text,
      last_error text,
      event_count integer
    );
  `)
  return db
}
