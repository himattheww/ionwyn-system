import type { Db } from '../db.ts';
import { addDays, datesBetween, jakartaDate } from '../dates.ts';
import { GarminSession, NeedLoginError } from './client.ts';
import { NeedConnectError } from './token.ts';
import { applyRaw, pruneRaw, saveRaw, type RawKind } from './store.ts';

const FIRST_SYNC_DAYS = 90;
const OVERLAP_DAYS = 3;
const PAGE_SIZE = 100;

let running = false;

export function isSyncRunning() {
  return running;
}

export function syncStartDate(lastSuccessAt: string | null, today: string) {
  if (!lastSuccessAt) return addDays(today, -(FIRST_SYNC_DAYS - 1));
  return addDays(jakartaDate(lastSuccessAt), -OVERLAP_DAYS);
}

export interface GarminSource {
  get(path: string): Promise<unknown>;
  sleepPath(date: string): Promise<string>;
  close(): Promise<void>;
}

type SyncOptions = { open?: () => Promise<GarminSource>; pauseMs?: number; maxDays?: number };

export async function runSync(db: Db, { open = () => GarminSession.open(), pauseMs = 1000, maxDays = FIRST_SYNC_DAYS }: SyncOptions = {}) {
  const pause = () => new Promise((resolve) => setTimeout(resolve, pauseMs + Math.random() * pauseMs));
  if (running) return;
  running = true;
  const status = (await db.one<{ last_success_at: string | null }>('SELECT last_success_at FROM fit_sync_status WHERE id = 1'))!;
  const today = jakartaDate();
  const earliest = addDays(today, -(maxDays - 1));
  const wanted = syncStartDate(status.last_success_at, today);
  const start = wanted < earliest ? earliest : wanted;
  let session: GarminSource | null = null;

  try {
    session = await open();
    const fetchAndApply = async (kind: RawKind, ref: string, path: string) => {
      await pause();
      const payload = await session!.get(path);
      if (payload == null) return payload;
      await db.transaction(async (tx) => {
        await saveRaw(tx, kind, ref, payload);
        await applyRaw(tx, kind, payload);
      });
      return payload;
    };

    const strengthIds: number[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await fetchAndApply(
        'activities',
        `${start}..${today}#${offset}`,
        `/activitylist-service/activities/search/activities?startDate=${start}&endDate=${today}&start=${offset}&limit=${PAGE_SIZE}`,
      );
      if (!Array.isArray(page)) break;
      for (const a of page) {
        if (a?.activityType?.typeKey === 'strength_training') strengthIds.push(a.activityId);
      }
      if (page.length < PAGE_SIZE) break;
    }

    for (const id of strengthIds) {
      await fetchAndApply('exercise_sets', String(id), `/activity-service/activity/${id}/exerciseSets`);
    }

    for (const date of datesBetween(start, today)) {
      await fetchAndApply('sleep', date, await session.sleepPath(date));
    }

    await pause();
    const profile = (await session.get('/userprofile-service/socialProfile')) as { displayName?: string } | null;
    if (!profile?.displayName) throw new Error('displayName Garmin tidak ditemukan');
    await fetchAndApply(
      'rhr',
      `${start}..${today}`,
      `/userstats-service/wellness/daily/${encodeURIComponent(profile.displayName)}?fromDate=${start}&untilDate=${today}&metricId=60`,
    );

    await db.run('UPDATE fit_sync_status SET last_success_at = ? WHERE id = 1', [new Date().toISOString()]);
    await pruneRaw(db);
  } catch (error) {
    const message = error instanceof NeedLoginError || error instanceof NeedConnectError ? error.message : `Sinkron gagal: ${(error as Error).message}`;
    console.error(message);
    await db.run('UPDATE fit_sync_status SET last_error_at = ?, last_error = ? WHERE id = 1', [new Date().toISOString(), message]);
  } finally {
    await session?.close().catch(() => {});
    running = false;
  }
}

export async function syncIfStale(db: Db) {
  const { last_success_at } = (await db.one<{ last_success_at: string | null }>('SELECT last_success_at FROM fit_sync_status WHERE id = 1'))!;
  const dayMs = 24 * 60 * 60 * 1000;
  if (!last_success_at || Date.now() - Date.parse(last_success_at) > dayMs) void runSync(db);
}
