import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postgres from 'postgres'
import { backupFolder, root } from './apps.mjs'

const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', '_').replaceAll(':', '')
const target = join(backupFolder, 'harian', stamp)
const keep = Number(process.env.BACKUP_KEEP ?? 30)
const results = []

async function step(name, task) {
  try {
    results.push(`ok     ${name}: ${await task()}`)
  } catch (error) {
    results.push(`GAGAL  ${name}: ${error.message}`)
  }
}

async function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL belum diisi')
  const sql = postgres(url, { prepare: false, max: 1 })
  try {
    const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
    mkdirSync(join(target, 'database'), { recursive: true })
    const counts = []
    for (const { table_name: table } of tables) {
      const rows = await sql`select * from ${sql('public.' + table)}`
      writeFileSync(join(target, 'database', `${table}.json`), JSON.stringify(rows, null, 2))
      counts.push(`${table} ${rows.length}`)
    }
    return `${tables.length} tabel (${counts.join(', ')})`
  } finally {
    await sql.end()
  }
}

async function timesheet() {
  const url = process.env.TIMESHEET_API_URL
  const apiKey = process.env.TIMESHEET_API_KEY
  if (!url || !apiKey) throw new Error('TIMESHEET_API_URL atau TIMESHEET_API_KEY belum diisi')
  const months = []
  const date = new Date()
  for (let i = 0; i < 36; i++, date.setMonth(date.getMonth() - 1, 1)) {
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'month', date: `${month}-01`, apiKey })
    })
    const body = await res.json()
    if (body.error?.includes('belum ada')) break
    if (body.error) throw new Error(body.error)
    months.push(body.month)
  }
  writeFileSync(join(target, 'timesheet.json'), JSON.stringify(months, null, 2))
  return `${months.length} bulan`
}

function envFiles() {
  const dir = join(target, 'env')
  for (const file of ['.env', 'catatan-malam/.env', 'fitness-track/.env', 'leveling/.env', 'learning/server/.env', 'reminder-and-scheduling/.env', 'financetracker/.env']) {
    const source = resolve(root, file)
    if (!existsSync(source)) continue
    const name = file === '.env' ? 'root' : file.split('/')[0]
    mkdirSync(join(dir, name), { recursive: true })
    copyFileSync(source, join(dir, name, '.env'))
  }
  return 'semua .env'
}

mkdirSync(target, { recursive: true })
await step('database Supabase', database)
await step('timesheet (Apps Script)', timesheet)
await step('.env', envFiles)

const old = readdirSync(join(backupFolder, 'harian')).sort().slice(0, -keep)
for (const dir of old) rmSync(join(backupFolder, 'harian', dir), { recursive: true })

console.log(`Backup ke ${target}`)
for (const line of results) console.log(line)
process.exit(results.some(line => line.startsWith('GAGAL')) ? 1 : 0)
