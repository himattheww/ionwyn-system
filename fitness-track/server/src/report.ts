import type { Db } from './db.ts';
import { addDays, datesBetween, isoWeekday } from './dates.ts';
import { isRun, type RunPattern } from './stats.ts';

export type MonthData = {
  activities: { type: string; date: string; duration_sec: number | null; distance_m: number | null; calories: number | null; avg_pace_sec_per_km: number | null }[];
  recovery: { date: string; sleep_min: number | null; sleep_score: number | null; rhr: number | null }[];
  weights: { date: string; kg: number }[];
  meals: { date: string; protein_met: number; rice_portions: number }[];
  conditions: { date: string; alcohol: number; sick: number }[];
};

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;
const sum = (values: (number | null)[]) => values.reduce<number>((total, v) => total + (v ?? 0), 0);

function mean(values: (number | null)[]) {
  const present = values.filter((v): v is number => v != null);
  return present.length ? round(sum(present) / present.length) : null;
}

export function monthRange(month: string) {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, end: addDays(next, -1) };
}

export function previousMonth(month: string) {
  return addDays(`${month}-01`, -1).slice(0, 7);
}

function totals(data: MonthData) {
  const runs = data.activities.filter((a) => isRun(a.type));
  return {
    activities: data.activities.length,
    activeDays: new Set(data.activities.map((a) => a.date)).size,
    durationSec: Math.round(sum(data.activities.map((a) => a.duration_sec))),
    calories: Math.round(sum(data.activities.map((a) => a.calories))),
    runKm: round(sum(runs.map((r) => r.distance_m)) / 1000, 2),
    sleepAvgMin: mean(data.recovery.map((r) => r.sleep_min)),
    rhrAvg: mean(data.recovery.map((r) => r.rhr)),
  };
}

export function buildMonthlyReport(month: string, current: MonthData, previous: MonthData, pattern: RunPattern, today: string) {
  const { start, end } = monthRange(month);
  const byType = new Map<string, { type: string; count: number; durationSec: number; distanceKm: number; calories: number }>();
  for (const a of current.activities) {
    const row = byType.get(a.type) ?? { type: a.type, count: 0, durationSec: 0, distanceKm: 0, calories: 0 };
    row.count += 1;
    row.durationSec += a.duration_sec ?? 0;
    row.distanceKm += (a.distance_m ?? 0) / 1000;
    row.calories += a.calories ?? 0;
    byType.set(a.type, row);
  }

  const runs = current.activities.filter((a) => isRun(a.type) && a.distance_m);
  const longest = runs.reduce<(typeof runs)[number] | null>((best, r) => (!best || r.distance_m! > best.distance_m! ? r : best), null);
  const fastest = runs
    .filter((r) => r.distance_m! >= 3000 && r.avg_pace_sec_per_km)
    .reduce<(typeof runs)[number] | null>((best, r) => (!best || r.avg_pace_sec_per_km! < best.avg_pace_sec_per_km! ? r : best), null);

  const runDates = new Set(runs.map((r) => r.date));
  const plannedDates = datesBetween(start, end < today ? end : today).filter((d) => pattern[isoWeekday(d)]);
  const weights = [...current.weights].sort((a, b) => a.date.localeCompare(b.date));

  return {
    month,
    start,
    end,
    complete: today > end,
    totals: totals(current),
    previous: totals(previous),
    byType: [...byType.values()]
      .map((t) => ({ ...t, durationSec: Math.round(t.durationSec), distanceKm: round(t.distanceKm, 2), calories: Math.round(t.calories) }))
      .sort((a, b) => b.count - a.count || b.durationSec - a.durationSec),
    running: {
      count: runs.length,
      longest: longest && { date: longest.date, km: round(longest.distance_m! / 1000, 2) },
      fastest: fastest && { date: fastest.date, km: round(fastest.distance_m! / 1000, 2), paceSecPerKm: fastest.avg_pace_sec_per_km },
      planned: plannedDates.length,
      plannedDone: plannedDates.filter((d) => runDates.has(d)).length,
    },
    strengthSessions: current.activities.filter((a) => a.type === 'strength_training').length,
    sleepScoreAvg: mean(current.recovery.map((r) => r.sleep_score)),
    weight: weights.length
      ? { first: weights[0].kg, last: weights.at(-1)!.kg, change: round(weights.at(-1)!.kg - weights[0].kg), entries: weights.length }
      : null,
    meals: {
      filled: current.meals.length,
      proteinDays: current.meals.filter((m) => m.protein_met).length,
      riceAvg: mean(current.meals.map((m) => m.rice_portions)),
    },
    conditions: {
      alcoholDays: current.conditions.filter((c) => c.alcohol).length,
      sickDays: current.conditions.filter((c) => c.sick).length,
    },
  };
}

export function loadMonth(db: Db, month: string): MonthData {
  const { start, end } = monthRange(month);
  const between = (sql: string) => db.prepare(`${sql} WHERE date BETWEEN ? AND ?`).all(start, end) as any[];
  return {
    activities: between('SELECT type, date, duration_sec, distance_m, calories, avg_pace_sec_per_km FROM activities'),
    recovery: between('SELECT date, sleep_min, sleep_score, rhr FROM recovery_daily'),
    weights: between('SELECT date, kg FROM weights'),
    meals: between('SELECT date, protein_met, rice_portions FROM meals'),
    conditions: between('SELECT date, alcohol, sick FROM condition_daily'),
  };
}

export function availableMonths(db: Db) {
  return db
    .prepare(`
      SELECT DISTINCT substr(date, 1, 7) FROM (
        SELECT date FROM activities UNION SELECT date FROM recovery_daily UNION SELECT date FROM weights UNION SELECT date FROM meals
      ) ORDER BY 1 DESC
    `)
    .pluck()
    .all() as string[];
}
