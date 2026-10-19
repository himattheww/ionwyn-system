import express, { type Request, type Response, Router } from 'express'
import { request } from 'node:http'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { config, root } from './config.ts'

export const apps = [
  { prefix: 'jadwal', label: 'Jadwal', dist: 'reminder-and-scheduling/dist' },
  { prefix: 'catatan', label: 'Catatan Malam', target: config.apps.catatan },
  { prefix: 'fit', label: 'Fitness', target: config.apps.fit },
  { prefix: 'learn', label: 'Learn', dist: 'learning/web/dist', api: config.apps.learn },
  { prefix: 'leveling', label: 'Leveling', target: config.apps.leveling },
  { prefix: 'uang', label: 'Keuangan', dist: 'financetracker/dist' },
  { prefix: 'timesheet', label: 'Timesheet', dist: 'timesheet/web/dist' }
]

function downPage(res: Response, label: string, status: number) {
  res
    .status(status)
    .type('html')
    .send(
      `<!doctype html><meta charset="utf-8"><title>${label} tidak jalan</title>` +
        `<body style="font:15px system-ui;padding:40px;color:#333"><h2>${label} tidak bisa dibuka</h2>` +
        `<p>Prosesnya tidak jalan atau sedang start. Cek log di terminal <code>npm start</code>, lalu muat ulang halaman ini.</p></body>`
    )
}

function proxy(target: string, label: string, pathPrefix = '') {
  const url = new URL(target)
  return (req: Request, res: Response) => {
    const upstream = request(
      {
        hostname: url.hostname,
        port: url.port,
        method: req.method,
        path: pathPrefix + req.url,
        headers: { ...req.headers, host: url.host }
      },
      reply => {
        res.writeHead(reply.statusCode ?? 502, reply.headers)
        reply.pipe(res)
      }
    )
    upstream.on('error', () => {
      if (res.headersSent) return res.end()
      if (pathPrefix || req.path.startsWith('/api')) return res.status(502).json({ error: `${label} tidak jalan`, message: `${label} tidak jalan` })
      downPage(res, label, 502)
    })
    req.pipe(upstream)
  }
}

function spa(dir: string, label: string) {
  const router = Router()
  const index = join(dir, 'index.html')
  router.use(express.static(dir, { index: false }))
  router.get('/{*path}', (req, res) => {
    if (!existsSync(index)) return downPage(res, `${label} (belum di-build)`, 503)
    if (/\.[a-z0-9]+$/i.test(req.path)) return res.status(404).end()
    res.sendFile(index)
  })
  return router
}

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

export function gateway() {
  const router = Router()
  router.post('/timesheet/api', express.text({ type: '*/*', limit: '100kb' }), timesheetApi)
  for (const app of apps) {
    const mount = `/${app.prefix}`
    router.use((req, res, next) => (req.path === mount ? res.redirect(`${mount}/${req.url.slice(mount.length)}`) : next()))
    if (app.api) router.use(`${mount}/api`, proxy(app.api, app.label, '/api'))
    if (app.target) router.use(mount, proxy(app.target, app.label))
    if (app.dist) router.use(mount, spa(resolve(root, app.dist), app.label))
  }
  return router
}
