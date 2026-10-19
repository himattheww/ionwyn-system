import { openDb } from '../db.ts';
import { applyRaw, type RawKind } from './store.ts';

const db = openDb();
const latest = db
  .prepare(`
    SELECT kind, payload FROM garmin_raw
    WHERE id IN (SELECT MAX(id) FROM garmin_raw GROUP BY kind, ref)
    ORDER BY CASE kind WHEN 'activities' THEN 0 ELSE 1 END, id
  `)
  .all() as { kind: RawKind; payload: string }[];

db.transaction(() => {
  for (const row of latest) applyRaw(db, row.kind, JSON.parse(row.payload));
})();

console.log(`${latest.length} respons mentah diproses ulang.`);
db.close();
