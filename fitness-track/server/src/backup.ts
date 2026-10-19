import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db.ts';
import { config } from './config.ts';

const KEEP = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function backupFiles() {
  if (!fs.existsSync(config.backupFolder)) return [];
  return fs
    .readdirSync(config.backupFolder)
    .filter((f) => /^fitness-\d{8}-\d{6}\.db$/.test(f))
    .sort();
}

export async function backupIfStale(db: Db) {
  const files = backupFiles();
  const last = files.at(-1);
  if (last && Date.now() - fs.statSync(path.join(config.backupFolder, last)).mtimeMs < DAY_MS) return;

  fs.mkdirSync(config.backupFolder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const target = path.join(config.backupFolder, `fitness-${stamp}.db`);
  await db.backup(target);
  console.log(`Backup dibuat: ${target}`);

  for (const old of backupFiles().slice(0, -KEEP)) fs.unlinkSync(path.join(config.backupFolder, old));
}
