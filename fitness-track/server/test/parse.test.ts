import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseActivities, parseExerciseSets, parseRhr, parseSleep } from '../src/garmin/parse.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'));

describe('parseActivities', () => {
  const activities = parseActivities(fixture('activities.json'));

  it('maps run fields and Jakarta date', () => {
    expect(activities[0]).toEqual({
      garmin_id: 1000000001,
      type: 'running',
      name: 'Jakarta Running',
      start_time: '2026-10-11T22:30:00.000Z',
      date: '2026-10-12',
      duration_sec: 2160.4,
      distance_m: 6021.5,
      avg_hr: 142,
      avg_pace_sec_per_km: 359,
      calories: 410,
      max_hr: 165,
      cadence_spm: 168.5,
      elevation_gain_m: 12,
      elevation_loss_m: 11,
      training_effect: 3.1,
    });
  });

  it('keeps other types as is and drops zero distance', () => {
    expect(activities.map((a) => a.type)).toEqual(['running', 'strength_training', 'lap_swimming']);
    expect(activities[1].distance_m).toBeNull();
    expect(activities[1].avg_pace_sec_per_km).toBeNull();
    expect(activities[2].avg_hr).toBeNull();
    expect(activities[2].calories).toBeNull();
  });

  it('returns empty list for unexpected payload', () => {
    expect(parseActivities({ error: 'x' })).toEqual([]);
  });
});

describe('parseExerciseSets', () => {
  const sets = parseExerciseSets(fixture('exercise-sets.json'));

  it('keeps only active sets in order', () => {
    expect(sets).toHaveLength(6);
    expect(sets.map((s) => s.set_order)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('uses exercise name, converts grams to kg, ignores invalid weight', () => {
    expect(sets[0]).toEqual({
      activity_garmin_id: 1000000002,
      set_order: 1,
      exercise_name: 'crab walk',
      reps: 20,
      weight_kg: null,
      duration_sec: 40,
    });
    expect(sets[3].exercise_name).toBe('goblet squat');
    expect(sets[3].weight_kg).toBe(16);
    expect(sets[5]).toMatchObject({ exercise_name: 'plank', reps: null, weight_kg: null, duration_sec: 45 });
  });
});

describe('parseSleep', () => {
  it('reads duration in minutes and score', () => {
    expect(parseSleep(fixture('sleep.json'))).toEqual({ date: '2026-10-13', sleep_min: 423, sleep_score: 78 });
  });

  it('returns null when there is no sleep', () => {
    expect(parseSleep(fixture('sleep-empty.json'))).toBeNull();
  });
});

describe('parseRhr', () => {
  it('reads daily values and skips empty days', () => {
    expect(parseRhr(fixture('rhr.json'))).toEqual([
      { date: '2026-10-12', rhr: 52 },
      { date: '2026-10-13', rhr: 50 },
    ]);
  });
});
