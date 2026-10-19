import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.ts';

export const DEFAULT_RUN_PATTERN = { 1: 'easy', 3: 'tempo', 5: 'easy', 7: 'long run' };

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      garmin_id INTEGER PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      start_time TEXT NOT NULL,
      date TEXT NOT NULL,
      duration_sec REAL,
      distance_m REAL,
      avg_hr REAL,
      avg_pace_sec_per_km REAL,
      calories REAL
    );
    CREATE INDEX IF NOT EXISTS activities_date ON activities(date);

    CREATE TABLE IF NOT EXISTS strength_sets (
      activity_garmin_id INTEGER NOT NULL REFERENCES activities(garmin_id) ON DELETE CASCADE,
      set_order INTEGER NOT NULL,
      exercise_name TEXT NOT NULL,
      reps INTEGER,
      weight_kg REAL,
      duration_sec REAL,
      PRIMARY KEY (activity_garmin_id, set_order)
    );
    CREATE INDEX IF NOT EXISTS strength_sets_exercise ON strength_sets(exercise_name);

    CREATE TABLE IF NOT EXISTS recovery_daily (
      date TEXT PRIMARY KEY,
      sleep_min REAL,
      sleep_score INTEGER,
      rhr INTEGER,
      source TEXT NOT NULL CHECK (source IN ('garmin', 'manual'))
    );

    CREATE TABLE IF NOT EXISTS condition_daily (
      date TEXT PRIMARY KEY,
      alcohol INTEGER NOT NULL DEFAULT 0,
      sick INTEGER NOT NULL DEFAULT 0,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS weights (
      date TEXT PRIMARY KEY,
      kg REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meals (
      date TEXT PRIMARY KEY,
      protein_met INTEGER NOT NULL,
      rice_portions REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS garmin_raw (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS garmin_raw_kind_ref ON garmin_raw(kind, ref);

    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_success_at TEXT,
      last_error_at TEXT,
      last_error TEXT
    );
    INSERT OR IGNORE INTO sync_status (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const activityColumns = db.prepare('SELECT name FROM pragma_table_info(?)').pluck().all('activities');
  if (!activityColumns.includes('calories')) db.exec('ALTER TABLE activities ADD COLUMN calories REAL');
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
    'run_pattern',
    JSON.stringify(DEFAULT_RUN_PATTERN),
  );
  return db;
}

export type Db = ReturnType<typeof openDb>;
