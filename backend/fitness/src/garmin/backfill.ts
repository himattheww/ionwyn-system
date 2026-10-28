import { openDb } from '../db.ts';
import { datesBetween, jakartaDate } from '../dates.ts';
import { applyRaw } from './store.ts';
import { TokenSession } from './token.ts';

const [from = '2026-07-22', mode = 'aktivitas'] = process.argv.slice(2);
const to = jakartaDate();
const db = openDb();
const session = await TokenSession.open(db);

if (mode === 'harian') {
  const profile = (await session.get('/userprofile-service/socialProfile')) as { displayName: string };
  for (const date of datesBetween(from, to)) {
    const daily: [Parameters<typeof applyRaw>[1], string][] = [
      ['sleep', await session.sleepPath(date)],
      ['hrv', `/hrv-service/hrv/${date}`],
      ['readiness', `/metrics-service/metrics/trainingreadiness/${date}`],
      ['calories', `/usersummary-service/usersummary/daily/${encodeURIComponent(profile.displayName)}?calendarDate=${date}`],
    ];
    for (const [kind, path] of daily) {
      const payload = await session.get(path).catch((error) => console.error(`${kind} ${date}: ${(error as Error).message}`));
      if (payload != null) await applyRaw(db, kind, payload);
    }
  }
  console.log(`Data harian ${from}..${to} diperbarui.`);
} else {
  let total = 0;
  for (let offset = 0; ; offset += 100) {
    const page = await session.get(`/activitylist-service/activities/search/activities?startDate=${from}&endDate=${to}&start=${offset}&limit=100`);
    if (!Array.isArray(page) || !page.length) break;
    await applyRaw(db, 'activities', page);
    total += page.length;
    if (page.length < 100) break;
  }
  console.log(`${total} aktivitas ${from}..${to} diperbarui.`);
}
process.exit(0);
