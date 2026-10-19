import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import type { Db } from './db.js'
import { jakartaClock } from './time.js'

const HOUR = 60 * 60 * 1000
const KEEP = 30
const backupName = /^catatan-\d{4}-\d{2}-\d{2}_\d{6}\.db$/

function listBackups(folder: string) {
  return readdirSync(folder)
    .filter((name) => backupName.test(name))
    .sort()
}

export async function backupIfDue(db: Db, folder: string, now = new Date()) {
  mkdirSync(folder, { recursive: true })
  const existing = listBackups(folder)
  const latest = existing.at(-1)
  if (latest && now.getTime() - statSync(join(folder, latest)).mtimeMs < 24 * HOUR) return null

  const { date, time } = jakartaClock(now)
  const file = join(folder, `catatan-${date}_${time}.db`)
  await db.backup(file)

  for (const old of listBackups(folder).slice(0, -KEEP)) unlinkSync(join(folder, old))
  return file
}

export function scheduleBackups(db: Db, folder: string) {
  const run = () =>
    backupIfDue(db, folder)
      .then((file) => file && console.log(`Backup dibuat: ${file}`))
      .catch((err) => console.error('Backup gagal:', err))
  run()
  setInterval(run, HOUR).unref()
}
