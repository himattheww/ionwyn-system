import { describe, expect, it } from 'vitest';
import { buildMonthlyReport, monthRange, previousMonth, type MonthData } from '../src/report.ts';

const empty: MonthData = { activities: [], recovery: [], weights: [], meals: [], conditions: [] };
const activity = (type: string, date: string, km: number | null, minutes: number, calories: number, pace: number | null = null) => ({
  type,
  date,
  distance_m: km == null ? null : km * 1000,
  duration_sec: minutes * 60,
  calories,
  avg_pace_sec_per_km: pace,
});

const october: MonthData = {
  activities: [
    activity('running', '2026-10-05', 6, 36, 400, 360),
    activity('running', '2026-10-11', 18, 120, 1300, 400),
    activity('running', '2026-10-14', 2, 10, 150, 300),
    activity('badminton', '2026-10-11', null, 90, 700),
    activity('badminton', '2026-10-17', null, 100, 725),
    activity('lap_swimming', '2026-10-08', 1, 30, 250),
  ],
  recovery: [
    { date: '2026-10-01', sleep_min: 420, sleep_score: 80, rhr: 52 },
    { date: '2026-10-02', sleep_min: 360, sleep_score: 60, rhr: 54 },
  ],
  weights: [
    { date: '2026-10-20', kg: 71.8 },
    { date: '2026-10-02', kg: 72.6 },
  ],
  meals: [
    { date: '2026-10-01', protein_met: 1, rice_portions: 2 },
    { date: '2026-10-02', protein_met: 0, rice_portions: 3 },
  ],
  conditions: [{ date: '2026-10-03', alcohol: 1, sick: 0 }],
};

const pattern = { 1: 'easy', 3: 'tempo', 7: 'long run' };

describe('month helpers', () => {
  it('handles month lengths and year change', () => {
    expect(monthRange('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
    expect(previousMonth('2027-01')).toBe('2026-12');
  });
});

describe('buildMonthlyReport', () => {
  const report = buildMonthlyReport('2026-10', october, empty, pattern, '2026-11-02');

  it('sums activities, calories and active days', () => {
    expect(report.totals).toMatchObject({ activities: 6, activeDays: 5, durationSec: 386 * 60, calories: 3525, runKm: 26 });
    expect(report.complete).toBe(true);
  });

  it('groups by type, most frequent first', () => {
    expect(report.byType.map((t) => [t.type, t.count, t.calories])).toEqual([
      ['running', 3, 1850],
      ['badminton', 2, 1425],
      ['lap_swimming', 1, 250],
    ]);
    expect(report.byType[1].durationSec).toBe(190 * 60);
  });

  it('finds longest run and fastest run of at least 3 km', () => {
    expect(report.running.longest).toEqual({ date: '2026-10-11', km: 18 });
    expect(report.running.fastest).toEqual({ date: '2026-10-05', km: 6, paceSecPerKm: 360 });
  });

  it('counts planned run days that were done', () => {
    expect(report.running.planned).toBe(12);
    expect(report.running.plannedDone).toBe(3);
  });

  it('only counts planned days up to today in the running month', () => {
    const partial = buildMonthlyReport('2026-10', october, empty, pattern, '2026-10-11');
    expect(partial.running.planned).toBe(4);
    expect(partial.complete).toBe(false);
  });

  it('summarizes weight, meals, recovery and conditions', () => {
    expect(report.weight).toEqual({ first: 72.6, last: 71.8, change: -0.8, entries: 2 });
    expect(report.meals).toEqual({ filled: 2, proteinDays: 1, riceAvg: 2.5 });
    expect(report.totals.sleepAvgMin).toBe(390);
    expect(report.totals.rhrAvg).toBe(53);
    expect(report.sleepScoreAvg).toBe(70);
    expect(report.conditions).toEqual({ alcoholDays: 1, sickDays: 0 });
  });

  it('returns empty values for a month without data', () => {
    const blank = buildMonthlyReport('2026-09', empty, empty, pattern, '2026-11-02');
    expect(blank.totals.activities).toBe(0);
    expect(blank.running.longest).toBeNull();
    expect(blank.weight).toBeNull();
    expect(blank.totals.sleepAvgMin).toBeNull();
  });
});
