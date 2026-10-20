import { openDb } from '../db.ts';
import { runSync } from './sync.ts';

await runSync(openDb());
process.exit(0);
