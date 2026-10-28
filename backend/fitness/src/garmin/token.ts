import type { Db } from '../db.ts';

const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const DI_GRANT_TYPE = 'https://connectapi.garmin.com/di-oauth2-service/oauth/grant/service_ticket';
const DI_CLIENT_IDS = [
  'GARMIN_CONNECT_MOBILE_ANDROID_DI_2025Q2',
  'GARMIN_CONNECT_MOBILE_ANDROID_DI_2024Q4',
  'GARMIN_CONNECT_MOBILE_ANDROID_DI',
  'GARMIN_CONNECT_MOBILE_IOS_DI',
];
const CONNECT_API = 'https://connectapi.garmin.com';
export const SSO_SERVICE_URL = 'https://sso.garmin.com/sso/embed';
export const CONNECT_MESSAGE = 'Perlu hubungkan Garmin lagi dari aplikasi Android Ionwyn';

const NATIVE_HEADERS = {
  'User-Agent': 'GCM-Android-5.23',
  'X-Garmin-User-Agent': 'com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0',
  'X-Garmin-Paired-App-Version': '10861',
  'X-Garmin-Client-Platform': 'Android',
  'X-App-Ver': '10861',
  'X-Lang': 'en',
  'X-GCExperience': 'GC5',
  'Accept-Language': 'en-US,en;q=0.9',
};

export type GarminTokens = { di_token: string; di_refresh_token: string; di_client_id: string };

export class NeedConnectError extends Error {
  constructor(detail?: string) {
    super(detail ? `${CONNECT_MESSAGE} (${detail})` : CONNECT_MESSAGE);
  }
}

function jwtClaims(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

export function tokenExpiresAt(token: string) {
  const exp = Number(jwtClaims(token).exp);
  return Number.isFinite(exp) ? exp * 1000 : null;
}

function tokenPost(clientId: string, body: Record<string, string>) {
  return fetch(DI_TOKEN_URL, {
    method: 'POST',
    headers: {
      ...NATIVE_HEADERS,
      Authorization: `Basic ${Buffer.from(`${clientId}:`).toString('base64')}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(30_000),
  });
}

async function readTokens(res: Response, fallback?: GarminTokens): Promise<GarminTokens> {
  const data = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token) throw new Error('Garmin tidak mengirim access_token');
  const claimed = jwtClaims(data.access_token).client_id;
  return {
    di_token: data.access_token,
    di_refresh_token: data.refresh_token ?? fallback?.di_refresh_token ?? '',
    di_client_id: typeof claimed === 'string' && claimed ? claimed : (fallback?.di_client_id ?? ''),
  };
}

export async function exchangeTicket(ticket: string): Promise<GarminTokens> {
  for (const clientId of DI_CLIENT_IDS) {
    const res = await tokenPost(clientId, {
      client_id: clientId,
      service_ticket: ticket,
      grant_type: DI_GRANT_TYPE,
      service_url: SSO_SERVICE_URL,
    });
    if (res.status === 429) throw new Error('Garmin sedang membatasi login, coba lagi beberapa menit lagi');
    if (!res.ok) continue;
    const tokens = await readTokens(res, { di_token: '', di_refresh_token: '', di_client_id: clientId });
    if (tokens.di_refresh_token) return tokens;
  }
  throw new Error('Tiket Garmin ditolak. Coba hubungkan lagi');
}

export async function refreshTokens(tokens: GarminTokens): Promise<GarminTokens> {
  const res = await tokenPost(tokens.di_client_id, {
    grant_type: 'refresh_token',
    client_id: tokens.di_client_id,
    refresh_token: tokens.di_refresh_token,
  });
  if (res.status === 400 || res.status === 401) throw new NeedConnectError(`refresh HTTP ${res.status}`);
  if (!res.ok) throw new Error(`Refresh token Garmin gagal: HTTP ${res.status}`);
  return readTokens(res, tokens);
}

export async function loadTokens(db: Db) {
  return db.one<GarminTokens>('SELECT di_token, di_refresh_token, di_client_id FROM fit_garmin_tokens WHERE id = 1');
}

export async function saveTokens(db: Db, tokens: GarminTokens) {
  await db.run(
    `INSERT INTO fit_garmin_tokens (id, di_token, di_refresh_token, di_client_id, updated_at) VALUES (1, ?, ?, ?, now())
     ON CONFLICT (id) DO UPDATE SET di_token = excluded.di_token, di_refresh_token = excluded.di_refresh_token,
       di_client_id = excluded.di_client_id, updated_at = now()`,
    [tokens.di_token, tokens.di_refresh_token, tokens.di_client_id],
  );
}

export async function connection(db: Db) {
  const tokens = await loadTokens(db);
  return { connected: Boolean(tokens), expiresAt: tokens ? tokenExpiresAt(tokens.di_token) : null };
}

export class TokenSession {
  private tokens: GarminTokens;
  private displayName: string | null = null;

  private constructor(tokens: GarminTokens) {
    this.tokens = tokens;
  }

  static async open(db: Db) {
    let tokens = await loadTokens(db);
    if (!tokens) throw new NeedConnectError('belum pernah dihubungkan');
    const expiresAt = tokenExpiresAt(tokens.di_token) ?? 0;
    if (expiresAt - Date.now() < 15 * 60_000) {
      tokens = await refreshTokens(tokens);
      await saveTokens(db, tokens);
    }
    return new TokenSession(tokens);
  }

  async get(path: string): Promise<unknown> {
    const res = await fetch(CONNECT_API + path, {
      headers: { ...NATIVE_HEADERS, Authorization: `Bearer ${this.tokens.di_token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 401) throw new NeedConnectError(`HTTP ${res.status}`);
    if (res.status === 204) return null;
    const body = await res.text();
    if (res.status >= 400) throw new Error(`Garmin ${path.split('?')[0]} HTTP ${res.status}`);
    return body ? JSON.parse(body) : null;
  }

  async sleepPath(date: string) {
    this.displayName ??= ((await this.get('/userprofile-service/socialProfile')) as { displayName?: string } | null)?.displayName ?? null;
    if (!this.displayName) throw new Error('displayName Garmin tidak ditemukan');
    return `/wellness-service/wellness/dailySleepData/${encodeURIComponent(this.displayName)}?date=${date}&nonSleepBufferMinutes=60`;
  }

  async close() {}
}
