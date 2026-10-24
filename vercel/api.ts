import express, { type NextFunction, type Request, type Response } from 'express'
import { createApp as catatanApp } from '../catatan-malam/server/src/app.ts'
import { connect } from '../catatan-malam/server/src/db.ts'
import { createApp as fitApp } from '../fitness-track/server/src/app.ts'
import { openDb as fitDb } from '../fitness-track/server/src/db.ts'
import { alert } from '../hub/src/alert.ts'
import { hubRoutes } from '../hub/src/routes.ts'
import { createApp as learnApp } from '../learning/server/src/app.ts'
import { handleMcp } from '../learning/server/src/mcp.ts'
import { mcpAuth } from '../learning/server/src/oauth.ts'
import { createApp as levelingApp } from '../leveling/server/src/app.ts'
import { openDb as levelingDb } from '../leveling/server/src/db.ts'
import { readEnv } from '../leveling/server/src/env.ts'
import rules from '../leveling/config/rules.json' with { type: 'json' }
import { authRoutes, isOwner, requireOwner } from './auth.ts'

process.env.TZ = 'Asia/Jakarta'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum diisi di environment Vercel')

function restorePath(req: Request, _res: Response, next: NextFunction) {
  const url = new URL(req.url, 'http://ionwyn')
  const original = url.searchParams.get('__path')
  if (original) {
    url.searchParams.delete('__path')
    const query = url.searchParams.toString()
    req.url = original + (query ? `?${query}` : '')
  }
  next()
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(restorePath)
app.use(authRoutes())

const baseUrl = process.env.HUB_APP_BASE
const internalSecret = process.env.INTERNAL_SECRET
if (baseUrl && internalSecret) {
  const { router, bearer } = mcpAuth({ baseUrl: new URL(baseUrl), secret: internalSecret, isOwner })
  app.use(router)
  app.post('/mcp', bearer, express.json({ limit: '1mb' }), handleMcp)
  app.all('/mcp', (_req, res) => res.status(405).set('Allow', 'POST').json({ error: 'Gunakan POST.' }))
}

app.use(requireOwner)
app.use(hubRoutes())
app.use('/catatan', catatanApp(connect(databaseUrl)))
app.use('/fit', fitApp(fitDb(databaseUrl)))
app.use('/leveling', levelingApp(levelingDb(databaseUrl), { ...readEnv(), RULES_JSON: JSON.stringify(rules) }).app)
app.use('/learn', learnApp())
app.use((_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }))
app.use(async (error: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  if (error.status && error.status < 500) return res.status(error.status).json({ error: error.message })
  console.error(`${req.method} ${req.path}:`, error)
  await alert(`api:${req.method} ${req.path}`, `Error di ${req.method} ${req.path}: ${error.message}`)
  if (!res.headersSent) res.status(500).json({ error: 'Terjadi kesalahan di server.' })
})

export default app
