import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDb } from '../src/db.ts';
import { applyRaw, pruneRaw } from '../src/garmin/store.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'));

describe('applyRaw', () => {
  it('upserts corrected sets without duplicates', () => {
    const db = openDb(':memory:');
    applyRaw(db, 'activities', fixture('activities.json'));
    applyRaw(db, 'activities', fixture('activities.json'));
    const sets = fixture('exercise-sets.json');
    applyRaw(db, 'exercise_sets', sets);
    sets.exerciseSets[0].repetitionCount = 18;
    applyRaw(db, 'exercise_sets', sets);

    expect(db.prepare('SELECT COUNT(*) FROM activities').pluck().get()).toBe(3);
    expect(db.prepare('SELECT COUNT(*) FROM strength_sets').pluck().get()).toBe(6);
    expect(db.prepare('SELECT reps FROM strength_sets WHERE set_order = 1').pluck().get()).toBe(18);
  });

  it('prunes raw responses older than 30 days and superseded ones', () => {
    const db = openDb(':memory:');
    const insert = db.prepare('INSERT INTO garmin_raw (kind, ref, fetched_at, payload) VALUES (?, ?, ?, ?)');
    insert.run('sleep', '2026-08-01', '2026-08-01T00:00:00.000Z', '{}');
    insert.run('sleep', '2026-10-10', '2026-10-10T00:00:00.000Z', '{"v":1}');
    insert.run('sleep', '2026-10-10', '2026-10-12T00:00:00.000Z', '{"v":2}');
    insert.run('rhr', '2026-09-20..2026-10-19', '2026-10-19T00:00:00.000Z', '{}');

    expect(pruneRaw(db, new Date('2026-10-19T12:00:00Z'))).toBe(2);
    expect(db.prepare('SELECT kind, ref, payload FROM garmin_raw ORDER BY id').all()).toEqual([
      { kind: 'sleep', ref: '2026-10-10', payload: '{"v":2}' },
      { kind: 'rhr', ref: '2026-09-20..2026-10-19', payload: '{}' },
    ]);
  });

  it('lets Garmin override manual recovery on the same date', () => {
    const db = openDb(':memory:');
    db.prepare(`INSERT INTO recovery_daily (date, sleep_min, rhr, source) VALUES ('2026-10-13', 300, 60, 'manual')`).run();
    applyRaw(db, 'sleep', fixture('sleep.json'));
    applyRaw(db, 'rhr', fixture('rhr.json'));

    expect(db.prepare(`SELECT * FROM recovery_daily WHERE date = '2026-10-13'`).get()).toEqual({
      date: '2026-10-13',
      sleep_min: 423,
      sleep_score: 78,
      rhr: 50,
      source: 'garmin',
    });
  });
});
