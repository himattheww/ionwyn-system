import { Router } from 'express';
import { z } from 'zod';
import type { Db } from './db.ts';
import { config } from './config.ts';
import { addDays, jakartaDate, weekRange } from './dates.ts';
import { average7, groupSets, isRun, matchRunPattern, type RunPattern, type SetRow } from './stats.ts';
import { isSyncRunning, runSync } from './garmin/sync.ts';
import { availableMonths, buildMonthlyReport, loadMonth, previousMonth } from './report.ts';

const dateParam = z.object({ date: z.iso.date() });
const optionalNumber = z.number().nonnegative().nullable();

const recoveryBody = z.object({
  sleep_min: optionalNumber,
  rhr: z.number().int().min(25).max(150).nullable(),
});
const conditionBody = z.object({
  alcohol: z.boolean(),
  sick: z.boolean(),
  note: z.string().trim().max(1000).nullable(),
});
const weightBody = z.object({ kg: z.number().min(20).max(300) });
const mealBody = z.object({ protein_met: z.boolean(), rice_portions: z.number().min(0).max(20) });
const runPatternBody = z.record(z.enum(['1', '2', '3', '4', '5', '6', '7']), z.string().trim().min(1).max(30));

export function apiRouter(db: Db) {
  const api = Router();

  const runPattern = () =>
    JSON.parse((db.prepare(`SELECT value FROM settings WHERE key = 'run_pattern'`).get() as { value: string }).value) as RunPattern;

  const syncStatus = () => ({
    ...(db.prepare('SELECT last_success_at, last_error_at, last_error FROM sync_status WHERE id = 1').get() as object),
    running: isSyncRunning(),
  });

  const setsFor = (activityIds: number[]) => {
    if (!activityIds.length) return new Map<number, SetRow[]>();
    const rows = db
      .prepare(`
        SELECT activity_garmin_id, exercise_name, reps, weight_kg, duration_sec FROM strength_sets
        WHERE activity_garmin_id IN (${activityIds.map(() => '?').join(',')})
        ORDER BY activity_garmin_id, set_order
      `)
      .all(...activityIds) as (SetRow & { activity_garmin_id: number })[];
    const map = new Map<number, SetRow[]>();
    for (const row of rows) map.set(row.activity_garmin_id, [...(map.get(row.activity_garmin_id) ?? []), row]);
    return map;
  };

  api.get('/summary', (req, res) => {
    const today = z.iso.date().catch(jakartaDate()).parse(req.query.date);
    const week = weekRange(today);
    const weekActivities = db
      .prepare('SELECT type, date, distance_m FROM activities WHERE date BETWEEN ? AND ?')
      .all(week.start, week.end) as { type: string; date: string; distance_m: number | null }[];
    const runs = weekActivities.filter((a) => isRun(a.type));

    const from = addDays(today, -13);
    const recovery = db.prepare('SELECT date, sleep_min, rhr FROM recovery_daily WHERE date BETWEEN ? AND ?').all(from, today) as {
      date: string;
      sleep_min: number | null;
      rhr: number | null;
    }[];
    const weights = db.prepare('SELECT date, kg AS value FROM weights WHERE date BETWEEN ? AND ?').all(from, today) as {
      date: string;
      value: number;
    }[];
    const meals = db.prepare('SELECT protein_met, rice_portions FROM meals WHERE date BETWEEN ? AND ?').all(week.start, week.end) as {
      protein_met: number;
      rice_portions: number;
    }[];

    res.json({
      today,
      week,
      runDays: matchRunPattern(week.start, runPattern(), runs),
      runKm: Math.round(runs.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 10) / 100,
      strengthSessions: weekActivities.filter((a) => a.type === 'strength_training').length,
      sleepAvg7: average7(recovery.map((r) => ({ date: r.date, value: r.sleep_min })), today),
      rhrAvg7: average7(recovery.map((r) => ({ date: r.date, value: r.rhr })), today),
      weightAvg7: average7(weights, today),
      weightAvgPrev7: average7(weights, addDays(today, -7)),
      proteinDays: meals.filter((m) => m.protein_met).length,
      riceAvg: meals.length ? Math.round((meals.reduce((s, m) => s + m.rice_portions, 0) / meals.length) * 10) / 10 : null,
      mealDays: meals.length,
      sync: syncStatus(),
    });
  });

  api.get('/activities', (req, res) => {
    const type = z.string().optional().catch(undefined).parse(req.query.type);
    const rows = type
      ? db.prepare('SELECT * FROM activities WHERE type = ? ORDER BY start_time DESC').all(type)
      : db.prepare('SELECT * FROM activities ORDER BY start_time DESC').all();
    const types = db.prepare('SELECT DISTINCT type FROM activities ORDER BY type').pluck().all();
    res.json({ activities: rows, types });
  });

  api.get('/long-runs', (_req, res) => {
    const runs = db.prepare(`SELECT date, distance_m FROM activities WHERE type LIKE '%running%' AND distance_m IS NOT NULL`).all() as {
      date: string;
      distance_m: number;
    }[];
    const byWeek = new Map<string, number>();
    for (const run of runs) {
      const { start } = weekRange(run.date);
      byWeek.set(start, Math.max(byWeek.get(start) ?? 0, run.distance_m / 1000));
    }
    const weeks = [...byWeek]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-16)
      .map(([week_start, km]) => ({ week_start, km: Math.round(km * 100) / 100 }));
    res.json({ target_km: config.targetLongRunKm, weeks });
  });

  api.get('/strength', (_req, res) => {
    const sessions = db
      .prepare(`SELECT garmin_id, name, date FROM activities WHERE type = 'strength_training' ORDER BY start_time DESC`)
      .all() as { garmin_id: number; name: string | null; date: string }[];
    const sets = setsFor(sessions.map((s) => s.garmin_id));
    res.json(sessions.map((s) => ({ ...s, exercises: groupSets(sets.get(s.garmin_id) ?? []) })));
  });

  api.get('/strength/exercise', (req, res) => {
    const name = z.string().min(1).parse(req.query.name);
    const sessions = db
      .prepare(`
        SELECT DISTINCT a.garmin_id, a.date FROM activities a
        JOIN strength_sets s ON s.activity_garmin_id = a.garmin_id
        WHERE s.exercise_name = ? ORDER BY a.start_time DESC
      `)
      .all(name) as { garmin_id: number; date: string }[];
    const sets = setsFor(sessions.map((s) => s.garmin_id));
    res.json(
      sessions.map((s) => {
        const rows = (sets.get(s.garmin_id) ?? []).filter((r) => r.exercise_name === name);
        const maxWeight = Math.max(0, ...rows.map((r) => r.weight_kg ?? 0));
        return {
          date: s.date,
          text: groupSets(rows)[0]?.text ?? name,
          total_reps: rows.reduce((sum, r) => sum + (r.reps ?? 0), 0),
          max_weight_kg: maxWeight || null,
        };
      }),
    );
  });

  api.get('/recovery', (req, res) => {
    const days = z.coerce.number().int().min(7).max(365).catch(30).parse(req.query.days);
    const today = jakartaDate();
    const from = addDays(today, -(days - 1));
    res.json({
      from,
      to: today,
      recovery: db.prepare('SELECT * FROM recovery_daily WHERE date BETWEEN ? AND ? ORDER BY date').all(from, today),
      conditions: db.prepare('SELECT * FROM condition_daily WHERE date BETWEEN ? AND ? ORDER BY date DESC').all(from, today),
    });
  });

  api.put('/recovery/:date', (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = recoveryBody.parse(req.body);
    db.prepare(`
      INSERT INTO recovery_daily (date, sleep_min, rhr, source) VALUES (?, ?, ?, 'manual')
      ON CONFLICT (date) DO UPDATE SET sleep_min = excluded.sleep_min, rhr = excluded.rhr, sleep_score = NULL, source = 'manual'
    `).run(date, body.sleep_min, body.rhr);
    res.status(204).end();
  });

  api.put('/condition/:date', (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = conditionBody.parse(req.body);
    db.prepare(`
      INSERT INTO condition_daily (date, alcohol, sick, note) VALUES (?, ?, ?, ?)
      ON CONFLICT (date) DO UPDATE SET alcohol = excluded.alcohol, sick = excluded.sick, note = excluded.note
    `).run(date, Number(body.alcohol), Number(body.sick), body.note || null);
    res.status(204).end();
  });

  api.get('/weights', (_req, res) => {
    const rows = db.prepare('SELECT date, kg FROM weights ORDER BY date').all() as { date: string; kg: number }[];
    const today = jakartaDate();
    res.json({
      weights: rows,
      avg7: average7(rows.map((r) => ({ date: r.date, value: r.kg })), today),
      avgPrev7: average7(rows.map((r) => ({ date: r.date, value: r.kg })), addDays(today, -7)),
    });
  });

  api.put('/weights/:date', (req, res) => {
    const { date } = dateParam.parse(req.params);
    const { kg } = weightBody.parse(req.body);
    db.prepare('INSERT INTO weights (date, kg) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET kg = excluded.kg').run(date, kg);
    res.status(204).end();
  });

  api.get('/meals', (_req, res) => {
    res.json(db.prepare('SELECT date, protein_met, rice_portions FROM meals ORDER BY date DESC LIMIT 60').all());
  });

  api.put('/meals/:date', (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = mealBody.parse(req.body);
    db.prepare(`
      INSERT INTO meals (date, protein_met, rice_portions) VALUES (?, ?, ?)
      ON CONFLICT (date) DO UPDATE SET protein_met = excluded.protein_met, rice_portions = excluded.rice_portions
    `).run(date, Number(body.protein_met), body.rice_portions);
    res.status(204).end();
  });

  api.get('/report', (req, res) => {
    const today = jakartaDate();
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).catch(today.slice(0, 7)).parse(req.query.month);
    res.json({
      months: availableMonths(db),
      report: buildMonthlyReport(month, loadMonth(db, month), loadMonth(db, previousMonth(month)), runPattern(), today),
    });
  });

  api.get('/sync', (_req, res) => res.json(syncStatus()));

  api.post('/sync', (_req, res) => {
    void runSync(db);
    res.status(202).json(syncStatus());
  });

  api.get('/settings', (_req, res) => res.json({ run_pattern: runPattern() }));

  api.put('/settings/run-pattern', (req, res) => {
    const pattern = runPatternBody.parse(req.body);
    db.prepare(`UPDATE settings SET value = ? WHERE key = 'run_pattern'`).run(JSON.stringify(pattern));
    res.status(204).end();
  });

  return api;
}
