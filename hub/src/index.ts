import express from 'express'
import { resolve } from 'node:path'
import { config, root } from './config.ts'
import { apps, gateway } from './gateway.ts'
import { integrationStatus, runIntegrations, scheduleIntegrations } from './integrations.ts'
import { todaySummary } from './today.ts'

const app = express()

app.get('/hub/api/apps', (_req, res) => res.json(apps.map(a => ({ prefix: a.prefix, label: a.label }))))
app.get('/hub/api/today', async (_req, res) => res.json(await todaySummary()))
app.get('/hub/api/integrations', (_req, res) => res.json(integrationStatus()))
app.post('/hub/api/integrations/run', async (_req, res) => {
  await runIntegrations()
  res.json(integrationStatus())
})

app.use('/design', express.static(resolve(root, 'design')))
app.use(gateway())
app.use(express.static(resolve(root, 'hub/web')))

app.listen(config.port, '127.0.0.1', error => {
  if (error) {
    console.error((error as NodeJS.ErrnoException).code === 'EADDRINUSE' ? `Port ${config.port} sudah dipakai.` : error)
    process.exit(1)
  }
  console.log(`Hub jalan di http://localhost:${config.port}`)
  scheduleIntegrations()
})
