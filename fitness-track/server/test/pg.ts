import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { dbFromUnsafe, parsers } from '../src/db.ts';

const migrations = ['20261020101000_fitness.sql', '20261021090000_garmin_tokens.sql', '20261026120000_fit_activity_details.sql', '20261027090000_fit_recovery_context.sql'].map((name) =>
  fs.readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), 'utf8'),
);

export async function testDb() {
  const pg = new PGlite({ parsers: { 20: parsers.int8, 1082: parsers.date, 1184: parsers.timestamptz } });
  await pg.exec('create role anon; create role authenticated;');
  for (const migration of migrations) await pg.exec(migration);
  type Runner = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }> };
  const unsafeOf = (runner: Runner) => async (text: string, params: never[]) => {
    const result = await runner.query(text, params);
    return Object.assign(result.rows, { count: result.affectedRows ?? result.rows.length }) as any;
  };
  return dbFromUnsafe(unsafeOf(pg), (work) => pg.transaction((tx) => work(unsafeOf(tx))));
}
