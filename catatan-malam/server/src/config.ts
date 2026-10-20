import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '../..')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL belum diisi. Isi di .env root ionwyn-system.')

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.ALLOW_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
  databaseUrl,
  webDist: resolve(projectRoot, 'web/dist'),
}
