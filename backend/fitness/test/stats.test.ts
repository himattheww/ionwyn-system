import { describe, expect, it } from 'vitest';
import { addDays, jakartaDate, weekRange } from '../src/dates.ts';
import { average7, groupSets, matchRunPattern } from '../src/stats.ts';
import { syncStartDate } from '../src/garmin/sync.ts';

const set = (exercise_name: string, reps: number | null, weight_kg: number | null = null, duration_sec: number | null = null) => ({
  exercise_name,
  reps,
  weight_kg,
  duration_sec,
});

describe('groupSets', () => {
  it('formats equal reps as N × reps', () => {
    expect(groupSets([set('crab walk', 20), set('crab walk', 20), set('crab walk', 20)])[0].text).toBe('crab walk 3 × 20');
  });

  it('lists reps when they differ', () => {
    expect(groupSets([set('crab walk', 20), set('crab walk', 20), set('crab walk', 18)])[0].text).toBe(
      'crab walk 3 set: 20, 20, 18',
    );
  });

  it('adds weight when available and keeps exercise order', () => {
    const result = groupSets([
      set('goblet squat', 12, 16),
      set('plank', null, null, 45),
      set('goblet squat', 12, 18),
      set('plank', null, null, 45),
    ]);
    expect(result.map((r) => r.text)).toEqual(['goblet squat 2 × 12 @ 16–18 kg', 'plank 2 × 45 dtk']);
  });

  it('formats single weight with comma decimal', () => {
    expect(groupSets([set('row', 10, 12.5), set('row', 10, 12.5)])[0].text).toBe('row 2 × 10 @ 12,5 kg');
  });
});

describe('matchRunPattern', () => {
  const pattern = { 1: 'easy', 3: 'tempo', 5: 'easy', 7: 'long run' };

  it('marks only days with runs as done', () => {
    const days = matchRunPattern('2026-10-12', pattern, [
      { date: '2026-10-12', distance_m: 6000 },
      { date: '2026-10-18', distance_m: 15000 },
      { date: '2026-10-18', distance_m: 1500 },
    ]);
    const planned = days.filter((d) => d.plan);
    expect(planned.map((d) => [d.date, d.plan, d.done, d.km])).toEqual([
      ['2026-10-12', 'easy', true, 6],
      ['2026-10-14', 'tempo', false, 0],
      ['2026-10-16', 'easy', false, 0],
      ['2026-10-18', 'long run', true, 16.5],
    ]);
  });

  it('shows unplanned runs too', () => {
    const days = matchRunPattern('2026-10-12', pattern, [{ date: '2026-10-13', distance_m: 3000 }]);
    expect(days[1]).toMatchObject({ plan: null, done: true, km: 3 });
  });
});

describe('average7', () => {
  const rows = [
    { date: '2026-10-05', value: 80 },
    { date: '2026-10-12', value: 72 },
    { date: '2026-10-14', value: 71.8 },
    { date: '2026-10-15', value: null },
  ];

  it('averages the 7 days ending on the date', () => {
    expect(average7(rows, '2026-10-18')).toBe(71.9);
  });

  it('includes start and end boundary', () => {
    expect(average7(rows, '2026-10-11')).toBe(80);
  });

  it('returns null without data', () => {
    expect(average7(rows, '2026-09-01')).toBeNull();
  });
});

describe('week boundaries in Asia/Jakarta', () => {
  it('runs Monday to Sunday', () => {
    expect(weekRange('2026-10-12')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekRange('2026-10-18')).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(weekRange('2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('crosses month and year', () => {
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });

  it('uses Jakarta date, not UTC', () => {
    expect(jakartaDate('2026-10-18T17:30:00Z')).toBe('2026-10-19');
    expect(jakartaDate('2026-10-18T16:59:00Z')).toBe('2026-10-18');
    expect(weekRange(jakartaDate('2026-10-18T17:30:00Z')).start).toBe('2026-10-19');
  });
});

describe('syncStartDate', () => {
  it('takes 90 days on first sync', () => {
    expect(syncStartDate(null, '2026-10-19')).toBe(addDays('2026-10-19', -89));
  });

  it('goes back 3 days from last success', () => {
    expect(syncStartDate('2026-10-18T01:00:00Z', '2026-10-19')).toBe('2026-10-15');
  });
});
