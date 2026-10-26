import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { applyRaw } from '../src/garmin/store.ts';
import { testDb } from './pg.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'));

let base = '';
let close = () => {};

beforeAll(async () => {
  const db = await testDb();
  await applyRaw(db, 'activities', fixture('activities.json'));
  await applyRaw(db, 'exercise_sets', fixture('exercise-sets.json'));
  await applyRaw(db, 'sleep', fixture('sleep.json'));
  const server = createApp(db).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  close = () => server.close();
});

afterAll(() => close());

const get = async (url: string) => (await fetch(base + url)).json();
const put = (url: string, body: unknown) =>
  fetch(base + url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('API Fitness di Postgres', () => {
  it('ringkasan, aktivitas, dan sinkron terbaca', async () => {
    const summary = await get('/summary?date=2026-10-15');
    expect(summary.runDays).toHaveLength(7);
    expect(summary.sync).toMatchObject({ last_success_at: null, running: false });
    const { activities, types } = await get('/activities');
    expect(activities.length).toBe(3);
    expect(typeof activities[0].garmin_id).toBe('number');
    expect(activities[0].start_time).toMatch(/Z$/);
    expect(types.length).toBeGreaterThan(0);
  });

  it('latihan beban per gerakan memakai daftar id', async () => {
    const sessions = await get('/strength');
    expect(sessions.length).toBeGreaterThan(0);
    const name = sessions[0].exercises[0].name;
    const history = await get(`/strength/exercise?name=${encodeURIComponent(name)}`);
    expect(history[0].total_reps).toBeGreaterThan(0);
  });

  it('catatan manual tersimpan dan laporan bulanan terbentuk', async () => {
    expect((await put('/weights/2026-10-14', { kg: 70.5 })).status).toBe(204);
    expect((await put('/meals/2026-10-14', { protein_met: true, rice_portions: 2 })).status).toBe(204);
    expect((await put('/condition/2026-10-14', { alcohol: false, sick: true, note: 'flu' })).status).toBe(204);
    expect((await get('/weights')).weights).toEqual([{ date: '2026-10-14', kg: 70.5 }]);
    const { months, report } = await get('/report?month=2026-10');
    expect(months[0]).toMatch(/^\d{4}-\d{2}$/);
    expect(report).toBeTruthy();
    expect((await get('/settings')).run_pattern['1']).toBe('easy');
  });
});

describe('kondisi dan fueling', () => {
  it('flag cedera tetap tersimpan saat kondisi diubah tanpa menyebut cedera', async () => {
    await put('/condition/2026-10-20', { alcohol: false, sick: false, injured: true, note: 'shin kiri nyeri' });
    await put('/condition/2026-10-20', { alcohol: false, sick: true, note: 'flu' });
    const { conditions } = await get('/recovery?days=365');
    expect(conditions.find((c: { date: string }) => c.date === '2026-10-20')).toMatchObject({ injured: 1, sick: 1, note: 'flu' });
  });

  it('mencatat fueling per lari dan menampilkannya di detail', async () => {
    expect((await put('/activities/1000000001/fueling', { gels: 2, gel_km: '8, 15', drink_ml: 500, electrolytes: '1 tablet' })).status).toBe(204);
    expect((await put('/activities/1/fueling', { gels: 1 })).status).toBe(404);
  });
});
