import express from 'express'
import { resolve } from 'node:path'
import { config, root } from './config.ts'
import { gateway } from './gateway.ts'
import { scheduleIntegrations } from './integrations.ts'
import { hubRoutes } from './routes.ts'

const app = express()

app.use(hubRoutes())
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
