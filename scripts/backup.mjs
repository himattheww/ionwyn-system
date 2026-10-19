import { backup, DatabaseSync } from 'node:sqlite'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { backupFolder, root } from './apps.mjs'

const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', '_').replaceAll(':', '')
const target = join(backupFolder, 'harian', stamp)
const keep = Number(process.env.BACKUP_KEEP ?? 30)
const results = []

function readEnv(file) {
  const path = resolve(root, file)
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(line => /^[A-Z_]+=/.test(line))
      .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1).trim()])
  )
}

async function step(name, task) {
  try {
    results.push(`ok     ${name}: ${await task()}`)
  } catch (error) {
    results.push(`GAGAL  ${name}: ${error.message}`)
  }
}

async function sqlite(name, file) {
  const source = resolve(root, file)
  if (!existsSync(source)) throw new Error(`file tidak ada: ${file}`)
  const db = new DatabaseSync(source, { readOnly: true })
  try {
    await backup(db, join(target, `${name}.db`))
  } finally {
    db.close()
  }
  const copy = new DatabaseSync(join(target, `${name}.db`), { readOnly: true })
  const check = copy.prepare('pragma integrity_check').get().integrity_check
  copy.close()
  if (check !== 'ok') throw new Error(`integrity_check: ${check}`)
  return `${name}.db`
}

async function supabaseToken(url, key, email, password) {
  if (!email) return key
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) throw new Error(`login gagal (${res.status})`)
  return (await res.json()).access_token
}

async function supabase(name, { url, key, email, password }, tables) {
  if (!url || !key) throw new Error('URL atau key belum diisi')
  if (email && !password) throw new Error('password belum diisi')
  const token = await supabaseToken(url, key, email, password)
  const counts = []
  mkdirSync(join(target, name), { recursive: true })
  for (const table of tables) {
    const rows = []
    for (let offset = 0; ; offset += 1000) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`, { headers: { apikey: key, authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`${table}: ${res.status}`)
      const page = await res.json()
      rows.push(...page)
      if (page.length < 1000) break
    }
    writeFileSync(join(target, name, `${table}.json`), JSON.stringify(rows, null, 2))
    counts.push(`${table} ${rows.length}`)
  }
  return counts.join(', ')
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
const scheduleEnv = readEnv('reminder-and-scheduling/.env')
const learnEnv = readEnv('learning/server/.env')
const env = process.env

await step('catatan-malam', () => sqlite('catatan-malam', 'catatan-malam/data/catatan.db'))
await step('fitness-track', () => sqlite('fitness-track', 'fitness-track/data/fitness.db'))
await step('leveling', () => sqlite('leveling', 'leveling/data/leveling.db'))
await step('jadwal (Supabase)', () =>
  supabase(
    'jadwal',
    {
      url: env.SCHEDULE_SUPABASE_URL || scheduleEnv.SUPABASE_URL,
      key: env.SCHEDULE_SUPABASE_KEY || scheduleEnv.SUPABASE_ANON_KEY,
      email: env.SCHEDULE_EMAIL,
      password: env.SCHEDULE_PASSWORD
    },
    ['routine_templates', 'schedule_items', 'activity_logs', 'planner_settings']
  )
)
await step('learn (Supabase)', () =>
  supabase('learn', { url: learnEnv.SUPABASE_URL, key: learnEnv.SUPABASE_SERVICE_ROLE_KEY }, ['tracks', 'topics', 'study_cases', 'learning_sessions'])
)
await step('keuangan (Supabase)', () => {
  if (!env.FINANCE_EMAIL) throw new Error('FINANCE_EMAIL dan FINANCE_PASSWORD belum diisi')
  return supabase(
    'keuangan',
    { url: env.FINANCE_SUPABASE_URL, key: env.FINANCE_SUPABASE_KEY, email: env.FINANCE_EMAIL, password: env.FINANCE_PASSWORD },
    ['profiles', 'transactions', 'recurring_transactions', 'budget_allocations', 'saving_goals', 'monthly_reports']
  )
})
await step('timesheet (Apps Script)', timesheet)
await step('.env', envFiles)

const old = readdirSync(join(backupFolder, 'harian')).sort().slice(0, -keep)
for (const dir of old) rmSync(join(backupFolder, 'harian', dir), { recursive: true })

console.log(`Backup ke ${target}`)
for (const line of results) console.log(line)
process.exit(results.some(line => line.startsWith('GAGAL')) ? 1 : 0)
