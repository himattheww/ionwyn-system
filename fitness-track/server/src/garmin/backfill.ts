import { openDb } from '../db.ts';
import { jakartaDate } from '../dates.ts';
import { applyRaw } from './store.ts';
import { TokenSession } from './token.ts';

const from = process.argv[2] ?? '2026-07-22';
const to = jakartaDate();
const db = openDb();
const session = await TokenSession.open(db);
let total = 0;
for (let offset = 0; ; offset += 100) {
  const page = await session.get(`/activitylist-service/activities/search/activities?startDate=${from}&endDate=${to}&start=${offset}&limit=100`);
  if (!Array.isArray(page) || !page.length) break;
  await applyRaw(db, 'activities', page);
  total += page.length;
  if (page.length < 100) break;
}
console.log(`${total} aktivitas ${from}..${to} diperbarui.`);
process.exit(0);
