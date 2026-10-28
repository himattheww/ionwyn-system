import { openDb } from '../db.ts';
import { applyRaw, type RawKind } from './store.ts';

const db = openDb();
const latest = await db.all<{ kind: RawKind; payload: string }>(`
  SELECT kind, payload FROM fit_garmin_raw
  WHERE id IN (SELECT MAX(id) FROM fit_garmin_raw GROUP BY kind, ref)
  ORDER BY CASE kind WHEN 'activities' THEN 0 ELSE 1 END, id
`);

await db.transaction(async (tx) => {
  for (const row of latest) await applyRaw(tx, row.kind, JSON.parse(row.payload));
});

console.log(`${latest.length} respons mentah diproses ulang.`);
process.exit(0);
