import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSync } from '../src/garmin/sync.ts';
import { exchangeTicket, loadTokens, saveTokens, tokenExpiresAt, TokenSession } from '../src/garmin/token.ts';
import { testDb } from './pg.ts';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'fixtures', name), 'utf8'));

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('token Garmin', () => {
  it('reads expiry from the JWT', () => {
    expect(tokenExpiresAt(jwt({ exp: 2_000_000_000 }))).toBe(2_000_000_000_000);
    expect(tokenExpiresAt('rusak')).toBeNull();
  });

  it('tries the next client id when one is refused', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = new URLSearchParams(String(init.body));
      if (body.get('client_id') === 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2') return json({}, 400);
      return json({ access_token: jwt({ client_id: 'GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4' }), refresh_token: 'r1' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const tokens = await exchangeTicket('ST-123');
    expect(tokens.di_refresh_token).toBe('r1');
    expect(tokens.di_client_id).toBe('GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4');
    expect(new URLSearchParams(String(fetchMock.mock.calls[0]![1].body)).get('service_ticket')).toBe('ST-123');
  });

  it('refreshes an expiring token and keeps the new one', async () => {
    const db = await testDb();
    await saveTokens(db, { di_token: jwt({ exp: Date.now() / 1000 + 60 }), di_refresh_token: 'lama', di_client_id: 'C' });
    const fresh = jwt({ exp: Date.now() / 1000 + 90_000 });
    vi.stubGlobal('fetch', vi.fn(async () => json({ access_token: fresh, refresh_token: 'baru' })));
    await TokenSession.open(db);
    expect(await loadTokens(db)).toMatchObject({ di_token: fresh, di_refresh_token: 'baru', di_client_id: 'C' });
  });

  it('asks to reconnect when there are no tokens', async () => {
    const db = await testDb();
    await expect(TokenSession.open(db)).rejects.toThrow(/hubungkan Garmin/);
  });

  it('syncs through the token session into the same tables', async () => {
    const db = await testDb();
    const paths: string[] = [];
    const source = {
      get: async (p: string) => {
        paths.push(p.split('?')[0]!);
        if (p.startsWith('/activitylist-service')) return fixture('activities.json');
        if (p.includes('exerciseSets')) return fixture('exercise-sets.json');
        if (p.includes('dailySleepData')) return fixture('sleep.json');
        if (p.startsWith('/userprofile-service')) return { displayName: 'tes' };
        return [];
      },
      sleepPath: async (date: string) => `/wellness-service/wellness/dailySleepData/tes?date=${date}`,
      close: async () => {},
    };
    await runSync(db, { open: async () => source, pauseMs: 0, maxDays: 2 });
    const status = await db.one<{ last_success_at: string | null; last_error: string | null }>('SELECT last_success_at, last_error FROM fit_sync_status WHERE id = 1');
    expect(status?.last_error).toBeNull();
    expect(status?.last_success_at).not.toBeNull();
    expect((await db.all('SELECT garmin_id FROM fit_activities')).length).toBeGreaterThan(0);
    expect(paths.filter((p) => p.includes('dailySleepData'))).toHaveLength(2);
  });
});
