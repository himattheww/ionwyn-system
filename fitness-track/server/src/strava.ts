import express, { Router } from 'express';
import { z } from 'zod';
import type { Db } from './db.ts';

const STRAVA = 'https://www.strava.com';

const env = () => ({
  clientId: process.env.STRAVA_CLIENT_ID ?? '',
  clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
  verifyToken: process.env.STRAVA_VERIFY_TOKEN ?? '',
  base: (process.env.HUB_APP_BASE ?? '').replace(/\/$/, ''),
});

const configured = () => {
  const e = env();
  return Boolean(e.clientId && e.clientSecret && e.verifyToken && e.base);
};

async function setting(db: Db, key: string) {
  return (await db.one<{ value: string }>('SELECT value FROM fit_settings WHERE key = ?', [key]))?.value ?? null;
}

async function save(db: Db, key: string, value: string) {
  await db.run('INSERT INTO fit_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value]);
}

const event = z.object({
  object_type: z.string(),
  aspect_type: z.string(),
  owner_id: z.coerce.string(),
  subscription_id: z.coerce.string(),
});

export function stravaWebhook(db: Db, triggerSync: () => Promise<unknown>) {
  const router = Router();

  router.get('/webhook', (req, res) => {
    const { verifyToken } = env();
    if (!verifyToken || req.query['hub.mode'] !== 'subscribe' || req.query['hub.verify_token'] !== verifyToken) {
      res.status(403).json({ error: 'Verifikasi gagal' });
      return;
    }
    res.json({ 'hub.challenge': req.query['hub.challenge'] });
  });

  router.post('/webhook', express.json({ limit: '16kb' }), async (req, res) => {
    const parsed = event.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Event tidak dikenal' });
      return;
    }
    const [athlete, subscription] = await Promise.all([setting(db, 'strava_athlete_id'), setting(db, 'strava_subscription_id')]);
    const { object_type, aspect_type, owner_id, subscription_id } = parsed.data;
    if (owner_id === athlete && subscription_id === subscription && object_type === 'activity' && aspect_type === 'create') {
      await triggerSync();
    }
    res.json({ ok: true });
  });

  return router;
}

export function stravaRoutes(db: Db) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const [athlete, subscription] = await Promise.all([setting(db, 'strava_athlete_id'), setting(db, 'strava_subscription_id')]);
    res.json({ configured: configured(), connected: Boolean(athlete), webhook: Boolean(subscription) });
  });

  router.get('/connect', (_req, res) => {
    const { clientId, base } = env();
    if (!configured()) {
      res.status(400).json({ error: 'STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, dan STRAVA_VERIFY_TOKEN belum diisi' });
      return;
    }
    const url = new URL(`${STRAVA}/oauth/authorize`);
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: `${base}/fit/api/strava/callback`,
      approval_prompt: 'force',
      scope: 'activity:read_all',
    }).toString();
    res.redirect(url.toString());
  });

  router.get('/callback', async (req, res) => {
    const code = z.string().min(1).safeParse(req.query.code);
    if (!code.success) {
      res.redirect('/#/fit/sinkron');
      return;
    }
    const { clientId, clientSecret } = env();
    const reply = await fetch(`${STRAVA}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: code.data, grant_type: 'authorization_code' }),
    });
    const body = (await reply.json().catch(() => null)) as { athlete?: { id?: number } } | null;
    if (!reply.ok || !body?.athlete?.id) {
      res.status(502).json({ error: 'Strava menolak otorisasi' });
      return;
    }
    await save(db, 'strava_athlete_id', String(body.athlete.id));
    res.redirect('/#/fit/sinkron');
  });

  router.post('/subscribe', async (_req, res) => {
    if (!configured()) {
      res.status(400).json({ error: 'Konfigurasi Strava belum lengkap' });
      return;
    }
    const { clientId, clientSecret, verifyToken, base } = env();
    const reply = await fetch(`${STRAVA}/api/v3/push_subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, callback_url: `${base}/fit/api/strava/webhook`, verify_token: verifyToken }),
    });
    const body = (await reply.json().catch(() => null)) as { id?: number; message?: string } | null;
    let id = reply.ok ? body?.id : undefined;
    if (!id) {
      const query = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
      const existing = (await (await fetch(`${STRAVA}/api/v3/push_subscriptions?${query}`)).json().catch(() => [])) as { id?: number; callback_url?: string }[];
      id = Array.isArray(existing) ? existing.find((s) => s.callback_url === `${base}/fit/api/strava/webhook`)?.id : undefined;
    }
    if (!id) {
      res.status(502).json({ error: `Strava menolak webhook: ${body?.message ?? reply.status}` });
      return;
    }
    await save(db, 'strava_subscription_id', String(id));
    res.json({ webhook: true });
  });

  return router;
}
