import { addDays, datesBetween, isoWeekday } from './dates.ts';

export type SetRow = { exercise_name: string; reps: number | null; weight_kg: number | null; duration_sec: number | null };
export type ExerciseSummary = { name: string; sets: number; text: string };

const formatNumber = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

function setAmount(set: SetRow) {
  if (set.reps != null) return String(set.reps);
  if (set.duration_sec != null) return `${Math.round(set.duration_sec)} dtk`;
  return '?';
}

function weightText(sets: SetRow[]) {
  const weights = sets.map((s) => s.weight_kg).filter((w): w is number => w != null);
  if (!weights.length) return '';
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  return min === max ? ` @ ${formatNumber(min)} kg` : ` @ ${formatNumber(min)}–${formatNumber(max)} kg`;
}

export function groupSets(sets: SetRow[]): ExerciseSummary[] {
  const groups = new Map<string, SetRow[]>();
  for (const set of sets) {
    groups.set(set.exercise_name, [...(groups.get(set.exercise_name) ?? []), set]);
  }
  return [...groups].map(([name, rows]) => {
    const amounts = rows.map(setAmount);
    const sameAmount = amounts.every((a) => a === amounts[0]);
    const body = sameAmount ? `${rows.length} × ${amounts[0]}` : `${rows.length} set: ${amounts.join(', ')}`;
    return { name, sets: rows.length, text: `${name} ${body}${weightText(rows)}` };
  });
}

export type RunPattern = Record<string, string>;
export type RunRow = { date: string; distance_m: number | null };
export type PlannedDay = { date: string; weekday: number; plan: string | null; done: boolean; km: number };

export function isRun(type: string) {
  return type.includes('running');
}

export function matchRunPattern(weekStart: string, pattern: RunPattern, runs: RunRow[]): PlannedDay[] {
  return datesBetween(weekStart, addDays(weekStart, 6)).map((date) => {
    const dayRuns = runs.filter((r) => r.date === date);
    const km = dayRuns.reduce((sum, r) => sum + (r.distance_m ?? 0), 0) / 1000;
    return {
      date,
      weekday: isoWeekday(date),
      plan: pattern[isoWeekday(date)] ?? null,
      done: dayRuns.length > 0,
      km: Math.round(km * 100) / 100,
    };
  });
}

export function average7(rows: { date: string; value: number | null }[], endDate: string): number | null {
  const start = addDays(endDate, -6);
  const values = rows
    .filter((r) => r.date >= start && r.date <= endDate && r.value != null)
    .map((r) => r.value as number);
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
