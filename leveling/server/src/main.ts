import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z, ZodError } from 'zod'
import { today } from './dates.ts'
import { openDb } from './db.ts'
import { readEnv } from './env.ts'
import { desktopNotify } from './notify.ts'
import { recalculate } from './recalculate.ts'
import { loadRules } from './rules.ts'
import { createAdapters } from './sources/index.ts'
import { attributeKeys, type CharacterState } from './types.ts'

const env = readEnv()
const db = openDb(env.LEVELING_DB_PATH)
const webDist = resolve('web/dist')

let running: ReturnType<typeof runRecalculate> | null = null

function runRecalculate() {
  const day = today()
  return recalculate(db, {
    rulesText: readFileSync(env.RULES_PATH, 'utf8'),
    adapters: rules => createAdapters(env, rules, day),
    today: day,
    targetLongRunKm: env.TARGET_LONG_RUN_KM,
    notify: env.DESKTOP_NOTIFICATION ? desktopNotify : undefined
  })
}

function recalculateOnce() {
  running ??= runRecalculate().finally(() => {
    running = null
  })
  return running
}

function snapshot() {
  const row = db.prepare('select state, created_at from snapshot where id = 1').get() as { state: string; created_at: string } | undefined
  return row ? { state: JSON.parse(row.state) as CharacterState, calculatedAt: row.created_at } : null
}

const app = express()
app.use(express.json())

app.get('/api/character', (_req, res) => {
  const current = snapshot()
  if (!current) return res.json({ state: null })
  const rules = loadRules(env.RULES_PATH).rules
  const recentAchievements = Object.entries(current.state.achievements)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 5)
    .map(([id, date]) => ({ id, date, name: rules.achievements.find(a => a.id === id)?.name ?? id }))
  res.json({ ...current, recentAchievements })
})

app.get('/api/history', (_req, res) => {
  res.json(db.prepare('select id, date, kind, text from history order by date desc, id desc').all())
})

const logQuery = z.object({
  attribute: z.enum(attributeKeys).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
})

app.get('/api/log', (req, res) => {
  const query = logQuery.parse(req.query)
  const rows = db
    .prepare(
      `select date, attribute, source, rule, note, raw, awarded, capped from exp_entries
       where (@attribute is null or attribute = @attribute)
         and (@from is null or date >= @from)
         and (@to is null or date <= @to)
       order by date desc, id`
    )
    .all({ attribute: query.attribute ?? null, from: query.from ?? null, to: query.to ?? null })
  res.json(rows)
})

app.get('/api/achievements', (_req, res) => {
  const earned = snapshot()?.state.achievements ?? {}
  res.json(loadRules(env.RULES_PATH).rules.achievements.map(a => ({ ...a, date: earned[a.id] ?? null })))
})

app.get('/api/sources', (_req, res) => {
  const sources = db.prepare('select name, label, enabled, last_read_at, last_error, event_count from sources order by rowid').all()
  res.json({ sources, rules: JSON.parse(readFileSync(env.RULES_PATH, 'utf8')), calculatedAt: snapshot()?.calculatedAt ?? null })
})

app.post('/api/recalculate', async (_req, res) => {
  const result = await recalculateOnce()
  res.json({ lines: result.lines, silent: result.silent, events: result.events })
})

app.get('/api/notifications', (req, res) => {
  const after = z.coerce.number().int().optional().parse(req.query.after)
  const lastId = (db.prepare('select coalesce(max(id), 0) as id from notifications').get() as { id: number }).id
  if (after === undefined) return res.json({ lastId, items: [] })
  const items = (db.prepare('select id, created_at, lines from notifications where id > ? order by id').all(after) as { id: number; created_at: string; lines: string }[]).map(row => ({
    ...row,
    lines: JSON.parse(row.lines) as string[]
  }))
  res.json({ lastId, items })
})

if (existsSync(webDist)) {
  app.use(express.static(webDist))
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(resolve(webDist, 'index.html')) : next()))
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Parameter tidak valid', issues: error.issues })
  console.error(error)
  res.status(500).json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan' })
})

const logFailure = (error: unknown) => console.error('Hitung ulang gagal:', error instanceof Error ? error.message : error)

app.listen(env.PORT, '127.0.0.1', () => {
  console.log(`Leveling berjalan di http://127.0.0.1:${env.PORT}`)
  recalculateOnce().catch(logFailure)
  setInterval(() => recalculateOnce().catch(logFailure), 30 * 60 * 1000)
})
