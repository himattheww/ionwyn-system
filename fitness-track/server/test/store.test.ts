import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyRaw, pruneRaw } from '../src/garmin/store.ts';
import { testDb } from './pg.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'));
const scalar = async (db: Awaited<ReturnType<typeof testDb>>, sql: string) => Object.values((await db.one(sql)) ?? {})[0];

describe('applyRaw', () => {
  it('upserts corrected sets without duplicates', async () => {
    const db = await testDb();
    await applyRaw(db, 'activities', fixture('activities.json'));
    await applyRaw(db, 'activities', fixture('activities.json'));
    const sets = fixture('exercise-sets.json');
    await applyRaw(db, 'exercise_sets', sets);
    sets.exerciseSets[0].repetitionCount = 18;
    await applyRaw(db, 'exercise_sets', sets);

    expect(await scalar(db, 'SELECT COUNT(*)::int FROM fit_activities')).toBe(3);
    expect(await scalar(db, 'SELECT COUNT(*)::int FROM fit_strength_sets')).toBe(6);
    expect(await scalar(db, 'SELECT reps FROM fit_strength_sets WHERE set_order = 1')).toBe(18);
  });

  it('prunes raw responses older than 30 days and superseded ones', async () => {
    const db = await testDb();
    const insert = (kind: string, ref: string, at: string, payload: string) =>
      db.run('INSERT INTO fit_garmin_raw (kind, ref, fetched_at, payload) VALUES (?, ?, ?, ?)', [kind, ref, at, payload]);
    await insert('sleep', '2026-08-01', '2026-08-01T00:00:00.000Z', '{}');
    await insert('sleep', '2026-10-10', '2026-10-10T00:00:00.000Z', '{"v":1}');
    await insert('sleep', '2026-10-10', '2026-10-12T00:00:00.000Z', '{"v":2}');
    await insert('rhr', '2026-09-20..2026-10-19', '2026-10-19T00:00:00.000Z', '{}');

    expect(await pruneRaw(db, new Date('2026-10-19T12:00:00Z'))).toBe(2);
    expect(await db.all('SELECT kind, ref, payload FROM fit_garmin_raw ORDER BY id')).toEqual([
      { kind: 'sleep', ref: '2026-10-10', payload: '{"v":2}' },
      { kind: 'rhr', ref: '2026-09-20..2026-10-19', payload: '{}' },
    ]);
  });

  it('lets Garmin override manual recovery on the same date', async () => {
    const db = await testDb();
    await db.run(`INSERT INTO fit_recovery_daily (date, sleep_min, rhr, source) VALUES ('2026-10-13', 300, 60, 'manual')`);
    await applyRaw(db, 'sleep', fixture('sleep.json'));
    await applyRaw(db, 'rhr', fixture('rhr.json'));

    expect(await db.one(`SELECT * FROM fit_recovery_daily WHERE date = '2026-10-13'`)).toEqual({
      date: '2026-10-13',
      sleep_min: 423,
      sleep_score: 78,
      rhr: 50,
      source: 'garmin',
    });
  });
});
