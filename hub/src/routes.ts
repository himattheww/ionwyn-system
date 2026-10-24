import express, { type Request, type Response, Router } from 'express'
import { config } from './config.ts'
import { apps } from './gateway.ts'
import { integrationStatus, runIntegrations } from './integrations.ts'
import { financeRoutes } from './finance.ts'
import { quickRoutes } from './quick.ts'
import { scheduleRoutes } from './schedule.ts'
import { todaySummary } from './today.ts'

async function timesheetApi(req: Request, res: Response) {
  const { url, key } = config.timesheet
  if (!url || !key) return res.json({ error: 'TIMESHEET_API_URL atau TIMESHEET_API_KEY belum diisi di .env root.' })
  let body: Record<string, unknown>
  try {
    body = JSON.parse(req.body)
  } catch {
    return res.json({ error: 'Body bukan JSON.' })
  }
  try {
    const reply = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, apiKey: key }),
      signal: AbortSignal.timeout(60_000)
    })
    res.status(reply.status).type('application/json').send(await reply.text())
  } catch {
    res.json({ error: 'Apps Script tidak bisa dihubungi.' })
  }
}

export function hubRoutes() {
  const router = Router()
  router.get('/hub/api/apps', (_req, res) => res.json(apps.map(a => ({ prefix: a.prefix, label: a.label }))))
  router.get('/hub/api/today', async (_req, res) => res.json(await todaySummary()))
  router.get('/hub/api/integrations', async (_req, res) => res.json(await integrationStatus()))
  router.post('/hub/api/integrations/run', async (_req, res) => {
    await runIntegrations()
    res.json(await integrationStatus())
  })
  router.use(quickRoutes())
  router.use(scheduleRoutes())
  router.use(financeRoutes())
  router.post('/timesheet/api', express.text({ type: '*/*', limit: '100kb' }), timesheetApi)
  return router
}
