import { resolve } from 'node:path'

const env = process.env
const remote = env.HUB_APP_BASE?.replace(/\/$/, '')
const local = (port: string | undefined, fallback: number, prefix: string) => (remote ? `${remote}/${prefix}` : `http://127.0.0.1:${Number(port ?? fallback)}`)

export const root = resolve(import.meta.dirname, '../..')

export const config = {
  internalSecret: env.INTERNAL_SECRET,
  appBase: remote,
  port: Number(env.PORT ?? env.HUB_PORT ?? 4000),
  intervalMin: Number(env.INTEGRATION_INTERVAL_MIN ?? 10),
  lookbackDays: 7,
  apps: {
    catatan: local(env.CATATAN_PORT, 4710, 'catatan'),
    learn: local(env.LEARN_API_PORT, 4711, 'learn'),
    fit: local(env.FIT_PORT, 4712, 'fit'),
    leveling: local(env.LEVELING_PORT, 4713, 'leveling')
  },
  schedule: {
    url: env.SCHEDULE_SUPABASE_URL,
    key: env.SCHEDULE_SUPABASE_KEY,
    email: env.SCHEDULE_EMAIL,
    password: env.SCHEDULE_PASSWORD
  },
  finance: {
    url: env.FINANCE_SUPABASE_URL,
    key: env.FINANCE_SUPABASE_KEY,
    email: env.FINANCE_EMAIL,
    password: env.FINANCE_PASSWORD
  },
  timesheet: {
    url: env.TIMESHEET_API_URL,
    key: env.TIMESHEET_API_KEY
  },
  runRoutine: {
    durationMin: Number(env.RUN_ROUTINE_DURATION_MIN ?? 60)
  }
}
