import { resolve } from 'node:path'
import { createApp } from './app.ts'
import { openDb } from './db.ts'
import { readEnv } from './env.ts'
import { desktopNotify } from './notify.ts'

const env = readEnv()
if (!env.DATABASE_URL) throw new Error('DATABASE_URL belum diisi. Isi di .env root ionwyn-system.')

const { app, leveling } = createApp(openDb(env.DATABASE_URL), env, resolve('web/dist'), env.DESKTOP_NOTIFICATION ? desktopNotify : undefined)
const logFailure = (error: unknown) => console.error('Hitung ulang gagal:', error instanceof Error ? error.message : error)

app.listen(env.PORT, '127.0.0.1', () => {
  console.log(`Leveling berjalan di http://127.0.0.1:${env.PORT}`)
  leveling.recalculateOnce().catch(logFailure)
  setInterval(() => leveling.recalculateOnce().catch(logFailure), 30 * 60 * 1000)
})
