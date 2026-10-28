import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { stravaWebhook } from '../src/strava.ts';
import { testDb } from './pg.ts';

let base = '';
let close = () => {};
let syncs = 0;

beforeAll(async () => {
  process.env.STRAVA_VERIFY_TOKEN = 'rahasia-uji';
  const db = await testDb();
  await db.run(`INSERT INTO fit_settings (key, value) VALUES ('strava_athlete_id', '42'), ('strava_subscription_id', '7')`);
  const app = express().use('/strava', stravaWebhook(db, async () => syncs++));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/strava/webhook`;
  close = () => server.close();
});

afterAll(() => close());

const post = (body: unknown) => fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const activity = { object_type: 'activity', aspect_type: 'create', owner_id: 42, subscription_id: 7, object_id: 1 };

describe('webhook Strava', () => {
  it('membalas challenge hanya dengan verify token yang benar', async () => {
    const ok = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=rahasia-uji&hub.challenge=abc`);
    expect(await ok.json()).toEqual({ 'hub.challenge': 'abc' });
    expect((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=salah&hub.challenge=abc`)).status).toBe(403);
  });

  it('aktivitas baru milik akun sendiri memicu sinkron Garmin', async () => {
    const before = syncs;
    expect((await post(activity)).status).toBe(200);
    expect(syncs).toBe(before + 1);
  });

  it('event lain, akun lain, atau langganan lain tidak memicu sinkron', async () => {
    const before = syncs;
    await post({ ...activity, aspect_type: 'update' });
    await post({ ...activity, owner_id: 99 });
    await post({ ...activity, subscription_id: 8 });
    expect(syncs).toBe(before);
  });
});
