import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { z, ZodError } from 'zod'
import { today } from './dates.ts'
import type { Db } from './db.ts'
import type { Env } from './env.ts'
import { recalculate } from './recalculate.ts'
import { parseRules } from './rules.ts'
import { createAdapters } from './sources/index.ts'
import { attributeKeys, type CharacterState } from './types.ts'

const wishInput = z.object({
  title: z.string().trim().min(1).max(200),
  why: z.string().trim().max(2000).nullish(),
  size: z.enum(['kecil', 'sedang', 'besar']),
  attribute: z.enum(attributeKeys),
  targetDate: z.iso.date().nullish()
})
const wishPatch = wishInput.partial().extend({ achievedOn: z.iso.date().nullable().optional() })
const wishColumns = `id, title, why, size, attribute, target_date::text as "targetDate", achieved_on::text as "achievedOn", created_at as "createdAt"`

const logQuery = z.object({
  attribute: z.enum(attributeKeys).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
})

export function createLeveling(db: Db, env: Env, notify?: (lines: string[]) => void) {
  const rulesText = () => env.RULES_JSON ?? readFileSync(env.RULES_PATH, 'utf8')
  let running: ReturnType<typeof recalculate> | null = null

  const recalculateOnce = () => {
    const day = today()
    running ??= recalculate(db, {
      rulesText: rulesText(),
      adapters: rules => createAdapters(env, rules, day, db),
      today: day,
      targetLongRunKm: env.TARGET_LONG_RUN_KM,
      notify
    }).finally(() => {
      running = null
    })
    return running
  }

  const snapshot = async () => {
    const row = await db.one<{ state: CharacterState; created_at: string }>('select state, created_at from leveling_snapshot where id = 1')
    return row ? { state: row.state, calculatedAt: row.created_at } : null
  }

  return { recalculateOnce, snapshot, rulesText }
}

export function createApp(db: Db, env: Env, webDist?: string, notify?: (lines: string[]) => void) {
  const leveling = createLeveling(db, env, notify)
  const app = express()
  app.use(express.json())

  app.get('/api/character', async (_req, res) => {
    const current = await leveling.snapshot()
    if (!current) return res.json({ state: null })
    const rules = parseRules(leveling.rulesText()).rules
    const recentAchievements = Object.entries(current.state.achievements)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 5)
      .map(([id, date]) => ({ id, date, name: rules.achievements.find(a => a.id === id)?.name ?? id }))
    res.json({ ...current, recentAchievements })
  })

  app.get('/api/history', async (_req, res) => {
    res.json(await db.all('select id, date, kind, text from leveling_history order by date desc, id desc'))
  })

  app.get('/api/log', async (req, res) => {
    const query = logQuery.parse(req.query)
    const rows = await db.all(
      `select date, attribute, source, rule, note, raw, awarded, capped from leveling_exp_entries
       where (?::text is null or attribute = ?)
         and (?::date is null or date >= ?::date)
         and (?::date is null or date <= ?::date)
       order by date desc, id`,
      [query.attribute ?? null, query.attribute ?? null, query.from ?? null, query.from ?? null, query.to ?? null, query.to ?? null]
    )
    res.json(rows)
  })

  app.get('/api/achievements', async (_req, res) => {
    const earned = (await leveling.snapshot())?.state.achievements ?? {}
    res.json(parseRules(leveling.rulesText()).rules.achievements.map(a => ({ ...a, date: earned[a.id] ?? null })))
  })

  app.get('/api/sources', async (_req, res) => {
    const [sources, current] = await Promise.all([
      db.all('select name, label, enabled, last_read_at, last_error, event_count from leveling_sources order by position'),
      leveling.snapshot()
    ])
    res.json({ sources, rules: JSON.parse(leveling.rulesText()), calculatedAt: current?.calculatedAt ?? null })
  })

  app.get('/api/wishes', async (_req, res) => {
    res.json(await db.all(`select ${wishColumns} from leveling_wishes order by achieved_on desc nulls first, created_at desc`))
  })

  app.post('/api/wishes', async (req, res) => {
    const wish = wishInput.parse(req.body)
    const row = await db.one(
      `insert into leveling_wishes (title, why, size, attribute, target_date) values (?, ?, ?, ?, ?::date) returning ${wishColumns}`,
      [wish.title, wish.why || null, wish.size, wish.attribute, wish.targetDate ?? null]
    )
    res.status(201).json(row)
  })

  app.patch('/api/wishes/:id', async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const patch = wishPatch.parse(req.body)
    const row = await db.one(
      `update leveling_wishes set
         title = coalesce(?, title),
         why = case when ?::boolean then ? else why end,
         size = coalesce(?, size),
         attribute = coalesce(?, attribute),
         target_date = case when ?::boolean then ?::date else target_date end,
         achieved_on = case when ?::boolean then ?::date else achieved_on end
       where id = ? returning ${wishColumns}`,
      [
        patch.title ?? null,
        patch.why !== undefined, patch.why || null,
        patch.size ?? null,
        patch.attribute ?? null,
        patch.targetDate !== undefined, patch.targetDate ?? null,
        patch.achievedOn !== undefined, patch.achievedOn ?? null,
        id
      ]
    )
    if (!row) return res.status(404).json({ error: 'Cita-cita tidak ditemukan' })
    if (patch.achievedOn !== undefined) await leveling.recalculateOnce()
    res.json(row)
  })

  app.delete('/api/wishes/:id', async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const removed = await db.one<{ achieved_on: string | null }>('delete from leveling_wishes where id = ? returning achieved_on::text', [id])
    if (!removed) return res.status(404).json({ error: 'Cita-cita tidak ditemukan' })
    if (removed.achieved_on) await leveling.recalculateOnce()
    res.status(204).end()
  })

  app.post('/api/recalculate', async (_req, res) => {
    const result = await leveling.recalculateOnce()
    res.json({ lines: result.lines, silent: result.silent, events: result.events })
  })

  app.get('/api/notifications', async (req, res) => {
    const after = z.coerce.number().int().optional().parse(req.query.after)
    const { id: lastId } = (await db.one<{ id: number }>('select coalesce(max(id), 0)::int as id from leveling_notifications'))!
    if (after === undefined) return res.json({ lastId, items: [] })
    const items = await db.all('select id, created_at, lines from leveling_notifications where id > ? order by id', [after])
    res.json({ lastId, items })
  })

  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist))
    app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(resolve(webDist, 'index.html')) : next()))
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: 'Parameter tidak valid', issues: error.issues })
    console.error(error)
    res.status(500).json({ error: 'Terjadi kesalahan di server' })
  })

  return { app, leveling }
}
