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

  const runPattern = async () =>
    JSON.parse((await db.one<{ value: string }>(`SELECT value FROM fit_settings WHERE key = 'run_pattern'`))!.value) as RunPattern;

  const syncStatus = async () => ({
    ...(await db.one('SELECT last_success_at, last_error_at, last_error FROM fit_sync_status WHERE id = 1')),
    running: isSyncRunning(),
    local: config.garminSyncEnabled,
  });

  const setsFor = async (activityIds: number[]) => {
    const map = new Map<number, SetRow[]>();
    if (!activityIds.length) return map;
    const rows = await db.all<SetRow & { activity_garmin_id: number }>(
      `SELECT activity_garmin_id, exercise_name, reps, weight_kg, duration_sec FROM fit_strength_sets
       WHERE activity_garmin_id = ANY(?) ORDER BY activity_garmin_id, set_order`,
      [activityIds],
    );
    for (const row of rows) map.set(row.activity_garmin_id, [...(map.get(row.activity_garmin_id) ?? []), row]);
    return map;
  };

  api.get('/summary', async (req, res) => {
    const today = z.iso.date().catch(jakartaDate()).parse(req.query.date);
    const week = weekRange(today);
    const from = addDays(today, -13);
    const [weekActivities, recovery, weights, meals, pattern, sync] = await Promise.all([
      db.all<{ type: string; date: string; distance_m: number | null }>(
        'SELECT type, date, distance_m FROM fit_activities WHERE date BETWEEN ? AND ?',
        [week.start, week.end],
      ),
      db.all<{ date: string; sleep_min: number | null; rhr: number | null }>(
        'SELECT date, sleep_min, rhr FROM fit_recovery_daily WHERE date BETWEEN ? AND ?',
        [from, today],
      ),
      db.all<{ date: string; value: number }>('SELECT date, kg AS value FROM fit_weights WHERE date BETWEEN ? AND ?', [from, today]),
      db.all<{ protein_met: number; rice_portions: number }>(
        'SELECT protein_met, rice_portions FROM fit_meals WHERE date BETWEEN ? AND ?',
        [week.start, week.end],
      ),
      runPattern(),
      syncStatus(),
    ]);
    const runs = weekActivities.filter((a) => isRun(a.type));

    res.json({
      today,
      week,
      runDays: matchRunPattern(week.start, pattern, runs),
      runKm: Math.round(runs.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 10) / 100,
      strengthSessions: weekActivities.filter((a) => a.type === 'strength_training').length,
      sleepAvg7: average7(recovery.map((r) => ({ date: r.date, value: r.sleep_min })), today),
      rhrAvg7: average7(recovery.map((r) => ({ date: r.date, value: r.rhr })), today),
      weightAvg7: average7(weights, today),
      weightAvgPrev7: average7(weights, addDays(today, -7)),
      proteinDays: meals.filter((m) => m.protein_met).length,
      riceAvg: meals.length ? Math.round((meals.reduce((s, m) => s + m.rice_portions, 0) / meals.length) * 10) / 10 : null,
      mealDays: meals.length,
      sync,
    });
  });

  api.get('/activities', async (req, res) => {
    const type = z.string().optional().catch(undefined).parse(req.query.type);
    const [activities, types] = await Promise.all([
      type
        ? db.all('SELECT * FROM fit_activities WHERE type = ? ORDER BY start_time DESC', [type])
        : db.all('SELECT * FROM fit_activities ORDER BY start_time DESC'),
      db.all<{ type: string }>('SELECT DISTINCT type FROM fit_activities ORDER BY type'),
    ]);
    res.json({ activities, types: types.map((t) => t.type) });
  });

  api.get('/long-runs', async (_req, res) => {
    const runs = await db.all<{ date: string; distance_m: number }>(
      `SELECT date, distance_m FROM fit_activities WHERE type LIKE '%running%' AND distance_m IS NOT NULL`,
    );
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

  api.get('/strength', async (_req, res) => {
    const sessions = await db.all<{ garmin_id: number; name: string | null; date: string }>(
      `SELECT garmin_id, name, date FROM fit_activities WHERE type = 'strength_training' ORDER BY start_time DESC`,
    );
    const sets = await setsFor(sessions.map((s) => s.garmin_id));
    res.json(sessions.map((s) => ({ ...s, exercises: groupSets(sets.get(s.garmin_id) ?? []) })));
  });

  api.get('/strength/exercise', async (req, res) => {
    const name = z.string().min(1).parse(req.query.name);
    const sessions = await db.all<{ garmin_id: number; date: string }>(
      `SELECT a.garmin_id, a.date FROM fit_activities a
       WHERE EXISTS (SELECT 1 FROM fit_strength_sets s WHERE s.activity_garmin_id = a.garmin_id AND s.exercise_name = ?)
       ORDER BY a.start_time DESC`,
      [name],
    );
    const sets = await setsFor(sessions.map((s) => s.garmin_id));
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

  api.get('/recovery', async (req, res) => {
    const days = z.coerce.number().int().min(7).max(365).catch(30).parse(req.query.days);
    const today = jakartaDate();
    const from = addDays(today, -(days - 1));
    const [recovery, conditions] = await Promise.all([
      db.all('SELECT * FROM fit_recovery_daily WHERE date BETWEEN ? AND ? ORDER BY date', [from, today]),
      db.all('SELECT * FROM fit_condition_daily WHERE date BETWEEN ? AND ? ORDER BY date DESC', [from, today]),
    ]);
    res.json({ from, to: today, recovery, conditions });
  });

  api.put('/recovery/:date', async (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = recoveryBody.parse(req.body);
    await db.run(
      `INSERT INTO fit_recovery_daily (date, sleep_min, rhr, source) VALUES (?, ?, ?, 'manual')
       ON CONFLICT (date) DO UPDATE SET sleep_min = excluded.sleep_min, rhr = excluded.rhr, sleep_score = NULL, source = 'manual'`,
      [date, body.sleep_min, body.rhr],
    );
    res.status(204).end();
  });

  api.put('/condition/:date', async (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = conditionBody.parse(req.body);
    await db.run(
      `INSERT INTO fit_condition_daily (date, alcohol, sick, note) VALUES (?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET alcohol = excluded.alcohol, sick = excluded.sick, note = excluded.note`,
      [date, Number(body.alcohol), Number(body.sick), body.note || null],
    );
    res.status(204).end();
  });

  api.get('/weights', async (_req, res) => {
    const rows = await db.all<{ date: string; kg: number }>('SELECT date, kg FROM fit_weights ORDER BY date');
    const today = jakartaDate();
    res.json({
      weights: rows,
      avg7: average7(rows.map((r) => ({ date: r.date, value: r.kg })), today),
      avgPrev7: average7(rows.map((r) => ({ date: r.date, value: r.kg })), addDays(today, -7)),
    });
  });

  api.put('/weights/:date', async (req, res) => {
    const { date } = dateParam.parse(req.params);
    const { kg } = weightBody.parse(req.body);
    await db.run('INSERT INTO fit_weights (date, kg) VALUES (?, ?) ON CONFLICT (date) DO UPDATE SET kg = excluded.kg', [date, kg]);
    res.status(204).end();
  });

  api.get('/meals', async (_req, res) => {
    res.json(await db.all('SELECT date, protein_met, rice_portions FROM fit_meals ORDER BY date DESC LIMIT 60'));
  });

  api.put('/meals/:date', async (req, res) => {
    const { date } = dateParam.parse(req.params);
    const body = mealBody.parse(req.body);
    await db.run(
      `INSERT INTO fit_meals (date, protein_met, rice_portions) VALUES (?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET protein_met = excluded.protein_met, rice_portions = excluded.rice_portions`,
      [date, Number(body.protein_met), body.rice_portions],
    );
    res.status(204).end();
  });

  api.get('/report', async (req, res) => {
    const today = jakartaDate();
    const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).catch(today.slice(0, 7)).parse(req.query.month);
    const [months, current, previous, pattern] = await Promise.all([
      availableMonths(db),
      loadMonth(db, month),
      loadMonth(db, previousMonth(month)),
      runPattern(),
    ]);
    res.json({ months, report: buildMonthlyReport(month, current, previous, pattern, today) });
  });

  api.get('/sync', async (_req, res) => res.json(await syncStatus()));

  api.post('/sync', async (_req, res) => {
    if (!config.garminSyncEnabled) {
      res.status(409).json({ error: 'Sinkron Garmin dijalankan dari laptop: buka Ionwyn lokal lalu tekan Sinkron, atau jalankan npm run garmin:sync.' });
      return;
    }
    void runSync(db);
    res.status(202).json(await syncStatus());
  });

  api.get('/settings', async (_req, res) => res.json({ run_pattern: await runPattern() }));

  api.put('/settings/run-pattern', async (req, res) => {
    const pattern = runPatternBody.parse(req.body);
    await db.run(`UPDATE fit_settings SET value = ? WHERE key = 'run_pattern'`, [JSON.stringify(pattern)]);
    res.status(204).end();
  });

  return api;
}
