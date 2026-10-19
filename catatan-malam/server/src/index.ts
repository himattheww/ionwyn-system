import express, { type ErrorRequestHandler } from 'express'
import { existsSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { ZodError } from 'zod'
import { scheduleBackups } from './backup.js'
import { config } from './config.js'
import { openDatabase } from './db.js'
import { apiRouter } from './routes.js'

const db = openDatabase(config.dbPath)
const app = express()

app.use(express.json({ limit: '100kb' }))
app.use('/api', apiRouter(db))
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' })
})

if (existsSync(config.webDist)) {
  app.use(express.static(config.webDist))
  app.get('/{*path}', (_req, res) => res.sendFile(join(config.webDist, 'index.html')))
}

const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0].message })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Body harus JSON yang valid.' })
  console.error(err)
  res.status(500).json({ error: 'Terjadi kesalahan di server.' })
}
app.use(handleError)

if (config.backupFolder) scheduleBackups(db, config.backupFolder)
else console.log('BACKUP_FOLDER kosong, backup otomatis tidak aktif.')

app.listen(config.port, config.host, () => {
  console.log(`Catatan Malam jalan di http://localhost:${config.port}`)
  if (config.host !== '0.0.0.0') return
  for (const net of Object.values(networkInterfaces()).flat()) {
    if (net && net.family === 'IPv4' && !net.internal) console.log(`Dari HP: http://${net.address}:${config.port}`)
  }
})
