import type { Db } from '../db.ts';
import { parseLaps } from './laps.ts';
import { parseActivities, parseExerciseSets, parseRhr, parseSleep } from './parse.ts';

export type RawKind = 'activities' | 'exercise_sets' | 'sleep' | 'rhr';

export async function saveRaw(db: Db, kind: RawKind, ref: string, payload: unknown) {
  await db.run('INSERT INTO fit_garmin_raw (kind, ref, fetched_at, payload) VALUES (?, ?, ?, ?)', [
    kind,
    ref,
    new Date().toISOString(),
    JSON.stringify(payload),
  ]);
}

const RAW_RETENTION_DAYS = 30;

export async function pruneRaw(db: Db, now = new Date()) {
  const cutoff = new Date(now.getTime() - RAW_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return db.transaction(async (tx) => {
    const old = await tx.run('DELETE FROM fit_garmin_raw WHERE fetched_at < ?', [cutoff]);
    const superseded = await tx.run('DELETE FROM fit_garmin_raw WHERE id NOT IN (SELECT MAX(id) FROM fit_garmin_raw GROUP BY kind, ref)');
    const laps = await tx.run('DELETE FROM fit_activity_laps WHERE fetched_at < ?', [cutoff]);
    return old + superseded + laps;
  });
}

export async function applyRaw(db: Db, kind: RawKind, payload: unknown) {
  if (kind === 'activities') {
    for (const a of parseActivities(payload)) {
      await db.run(
        `INSERT INTO fit_activities (garmin_id, type, name, start_time, date, duration_sec, distance_m, avg_hr, avg_pace_sec_per_km, calories,
           max_hr, cadence_spm, elevation_gain_m, elevation_loss_m, training_effect)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (garmin_id) DO UPDATE SET
           type = excluded.type, name = excluded.name, start_time = excluded.start_time, date = excluded.date,
           duration_sec = excluded.duration_sec, distance_m = excluded.distance_m,
           avg_hr = excluded.avg_hr, avg_pace_sec_per_km = excluded.avg_pace_sec_per_km, calories = excluded.calories,
           max_hr = excluded.max_hr, cadence_spm = excluded.cadence_spm, elevation_gain_m = excluded.elevation_gain_m,
           elevation_loss_m = excluded.elevation_loss_m, training_effect = excluded.training_effect`,
        [
          a.garmin_id, a.type, a.name, a.start_time, a.date, a.duration_sec, a.distance_m, a.avg_hr, a.avg_pace_sec_per_km, a.calories,
          a.max_hr, a.cadence_spm, a.elevation_gain_m, a.elevation_loss_m, a.training_effect,
        ],
      );
    }
  }

  if (kind === 'exercise_sets') {
    const sets = parseExerciseSets(payload);
    const activityId = (payload as any)?.activityId;
    if (!activityId) return;
    await db.run('DELETE FROM fit_strength_sets WHERE activity_garmin_id = ?', [activityId]);
    for (const s of sets) {
      await db.run(
        `INSERT INTO fit_strength_sets (activity_garmin_id, set_order, exercise_name, reps, weight_kg, duration_sec)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.activity_garmin_id, s.set_order, s.exercise_name, s.reps, s.weight_kg, s.duration_sec],
      );
    }
  }

  if (kind === 'sleep') {
    const sleep = parseSleep(payload);
    if (!sleep) return;
    await db.run(
      `INSERT INTO fit_recovery_daily (date, sleep_min, sleep_score, source) VALUES (?, ?, ?, 'garmin')
       ON CONFLICT (date) DO UPDATE SET
         sleep_min = excluded.sleep_min, sleep_score = excluded.sleep_score, source = 'garmin'`,
      [sleep.date, sleep.sleep_min, sleep.sleep_score],
    );
  }

  if (kind === 'rhr') {
    for (const row of parseRhr(payload)) {
      await db.run(
        `INSERT INTO fit_recovery_daily (date, rhr, source) VALUES (?, ?, 'garmin')
         ON CONFLICT (date) DO UPDATE SET rhr = excluded.rhr, source = 'garmin'`,
        [row.date, row.rhr],
      );
    }
  }
}

export async function saveLaps(db: Db, garminId: number, payload: unknown) {
  await db.run(
    `INSERT INTO fit_activity_laps (garmin_id, fetched_at, laps) VALUES (?, ?, ?)
     ON CONFLICT (garmin_id) DO UPDATE SET fetched_at = excluded.fetched_at, laps = excluded.laps`,
    [garminId, new Date().toISOString(), JSON.stringify(parseLaps(payload))],
  );
}
