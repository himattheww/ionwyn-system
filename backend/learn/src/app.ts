import express, { type ErrorRequestHandler } from 'express'
import { z } from 'zod'
import { NotFoundError } from './db.js'
import { exportRoute } from './routes/export.js'
import { topics } from './routes/topics.js'
import { tracks } from './routes/tracks.js'

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '200kb' }))

  app.use('/api/tracks', tracks)
  app.use('/api/topics', topics)
  app.use('/api/export', exportRoute)

  const handleError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: 'Input tidak valid', errors: z.flattenError(err).fieldErrors })
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Body bukan JSON yang valid' })
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ message: err.message })
    } else if (String(err?.message).includes('fetch failed')) {
      console.error(err)
      res.status(503).json({ message: 'Tidak bisa terhubung ke database Supabase. Cek SUPABASE_URL dan koneksi internet.' })
    } else {
      console.error(err)
      res.status(500).json({ message: 'Terjadi kesalahan di server. Cek log server.' })
    }
  }
  app.use(handleError)
  return app
}
