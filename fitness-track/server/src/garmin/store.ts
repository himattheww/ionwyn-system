import type { Db } from '../db.ts';
import { parseActivities, parseExerciseSets, parseRhr, parseSleep } from './parse.ts';

export type RawKind = 'activities' | 'exercise_sets' | 'sleep' | 'rhr';

export function saveRaw(db: Db, kind: RawKind, ref: string, payload: unknown) {
  db.prepare('INSERT INTO garmin_raw (kind, ref, fetched_at, payload) VALUES (?, ?, ?, ?)').run(
    kind,
    ref,
    new Date().toISOString(),
    JSON.stringify(payload),
  );
}

const RAW_RETENTION_DAYS = 30;

export function pruneRaw(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const removed = db.transaction(() => {
    const old = db.prepare('DELETE FROM garmin_raw WHERE fetched_at < ?').run(cutoff).changes;
    const superseded = db
      .prepare('DELETE FROM garmin_raw WHERE id NOT IN (SELECT MAX(id) FROM garmin_raw GROUP BY kind, ref)')
      .run().changes;
    return old + superseded;
  })();
  if (removed) db.exec('VACUUM');
  return removed;
}

export function applyRaw(db: Db, kind: RawKind, payload: unknown) {
  if (kind === 'activities') {
    const upsert = db.prepare(`
      INSERT INTO activities (garmin_id, type, name, start_time, date, duration_sec, distance_m, avg_hr, avg_pace_sec_per_km, calories)
      VALUES (@garmin_id, @type, @name, @start_time, @date, @duration_sec, @distance_m, @avg_hr, @avg_pace_sec_per_km, @calories)
      ON CONFLICT (garmin_id) DO UPDATE SET
        type = excluded.type, name = excluded.name, start_time = excluded.start_time, date = excluded.date,
        duration_sec = excluded.duration_sec, distance_m = excluded.distance_m,
        avg_hr = excluded.avg_hr, avg_pace_sec_per_km = excluded.avg_pace_sec_per_km, calories = excluded.calories
    `);
    for (const activity of parseActivities(payload)) upsert.run(activity);
  }

  if (kind === 'exercise_sets') {
    const sets = parseExerciseSets(payload);
    const activityId = (payload as any)?.activityId;
    if (!activityId) return;
    db.prepare('DELETE FROM strength_sets WHERE activity_garmin_id = ?').run(activityId);
    const insert = db.prepare(`
      INSERT INTO strength_sets (activity_garmin_id, set_order, exercise_name, reps, weight_kg, duration_sec)
      VALUES (@activity_garmin_id, @set_order, @exercise_name, @reps, @weight_kg, @duration_sec)
    `);
    for (const set of sets) insert.run(set);
  }

  if (kind === 'sleep') {
    const sleep = parseSleep(payload);
    if (!sleep) return;
    db.prepare(`
      INSERT INTO recovery_daily (date, sleep_min, sleep_score, source) VALUES (@date, @sleep_min, @sleep_score, 'garmin')
      ON CONFLICT (date) DO UPDATE SET
        sleep_min = excluded.sleep_min, sleep_score = excluded.sleep_score, source = 'garmin'
    `).run(sleep);
  }

  if (kind === 'rhr') {
    const upsert = db.prepare(`
      INSERT INTO recovery_daily (date, rhr, source) VALUES (@date, @rhr, 'garmin')
      ON CONFLICT (date) DO UPDATE SET
        rhr = excluded.rhr, source = 'garmin'
    `);
    for (const row of parseRhr(payload)) upsert.run(row);
  }
}
