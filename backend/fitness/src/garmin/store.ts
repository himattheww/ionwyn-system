import type { Db } from '../db.ts';
import { parseLaps } from './laps.ts';
import { parseActivities, parseCalories, parseExerciseSets, parseHrv, parseReadiness, parseRhr, parseSleep } from './parse.ts';

export type RawKind = 'activities' | 'exercise_sets' | 'sleep' | 'rhr' | 'hrv' | 'readiness' | 'calories';

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
           max_hr, cadence_spm, elevation_gain_m, elevation_loss_m, training_effect, start_lat, start_lon)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (garmin_id) DO UPDATE SET
           type = excluded.type, name = excluded.name, start_time = excluded.start_time, date = excluded.date,
           duration_sec = excluded.duration_sec, distance_m = excluded.distance_m,
           avg_hr = excluded.avg_hr, avg_pace_sec_per_km = excluded.avg_pace_sec_per_km, calories = excluded.calories,
           max_hr = excluded.max_hr, cadence_spm = excluded.cadence_spm, elevation_gain_m = excluded.elevation_gain_m,
           elevation_loss_m = excluded.elevation_loss_m, training_effect = excluded.training_effect,
           start_lat = excluded.start_lat, start_lon = excluded.start_lon`,
        [
          a.garmin_id, a.type, a.name, a.start_time, a.date, a.duration_sec, a.distance_m, a.avg_hr, a.avg_pace_sec_per_km, a.calories,
          a.max_hr, a.cadence_spm, a.elevation_gain_m, a.elevation_loss_m, a.training_effect, a.start_lat, a.start_lon,
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
      `INSERT INTO fit_recovery_daily (date, sleep_min, sleep_score, deep_min, light_min, rem_min, awake_min, sleep_respiration, sleep_stress, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'garmin')
       ON CONFLICT (date) DO UPDATE SET
         sleep_min = excluded.sleep_min, sleep_score = excluded.sleep_score, deep_min = excluded.deep_min, light_min = excluded.light_min,
         rem_min = excluded.rem_min, awake_min = excluded.awake_min, sleep_respiration = excluded.sleep_respiration,
         sleep_stress = excluded.sleep_stress, source = 'garmin'`,
      [sleep.date, sleep.sleep_min, sleep.sleep_score, sleep.deep_min, sleep.light_min, sleep.rem_min, sleep.awake_min, sleep.sleep_respiration, sleep.sleep_stress],
    );
  }

  if (kind === 'hrv') {
    const hrv = parseHrv(payload);
    if (!hrv) return;
    await db.run(
      `INSERT INTO fit_recovery_daily (date, hrv_last_night, hrv_weekly, hrv_high_5min, hrv_baseline_low, hrv_baseline_high, hrv_low_upper, hrv_status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'garmin')
       ON CONFLICT (date) DO UPDATE SET
         hrv_last_night = excluded.hrv_last_night, hrv_weekly = excluded.hrv_weekly, hrv_high_5min = excluded.hrv_high_5min,
         hrv_baseline_low = excluded.hrv_baseline_low, hrv_baseline_high = excluded.hrv_baseline_high,
         hrv_low_upper = excluded.hrv_low_upper, hrv_status = excluded.hrv_status`,
      [hrv.date, hrv.hrv_last_night, hrv.hrv_weekly, hrv.hrv_high_5min, hrv.hrv_baseline_low, hrv.hrv_baseline_high, hrv.hrv_low_upper, hrv.hrv_status],
    );
  }

  if (kind === 'readiness') {
    const r = parseReadiness(payload);
    if (!r) return;
    await db.run(
      `INSERT INTO fit_recovery_daily (date, readiness_score, readiness_level, acute_load, source) VALUES (?, ?, ?, ?, 'garmin')
       ON CONFLICT (date) DO UPDATE SET
         readiness_score = excluded.readiness_score, readiness_level = excluded.readiness_level, acute_load = excluded.acute_load`,
      [r.date, r.readiness_score, r.readiness_level, r.acute_load],
    );
  }

  if (kind === 'calories') {
    const c = parseCalories(payload);
    if (!c) return;
    await db.run(
      `INSERT INTO fit_recovery_daily (date, calories_total, calories_active, calories_bmr, source) VALUES (?, ?, ?, ?, 'garmin')
       ON CONFLICT (date) DO UPDATE SET
         calories_total = excluded.calories_total, calories_active = excluded.calories_active, calories_bmr = excluded.calories_bmr`,
      [c.date, c.calories_total, c.calories_active, c.calories_bmr],
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
    `INSERT INTO fit_activity_laps (garmin_id, fetched_at, laps) VALUES (?, ?, ?::text::jsonb)
     ON CONFLICT (garmin_id) DO UPDATE SET fetched_at = excluded.fetched_at, laps = excluded.laps`,
    [garminId, new Date().toISOString(), JSON.stringify(parseLaps(payload))],
  );
}
