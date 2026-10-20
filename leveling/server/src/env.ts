import { resolve } from 'node:path'
import { z } from 'zod'

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true')
const text = z.string().trim().optional().transform(value => value || undefined)

const envSchema = z.object({
  PORT: z.coerce.number().int().default(3100),
  DATABASE_URL: text,
  RULES_JSON: text,
  RULES_PATH: z.string().default(resolve(import.meta.dirname, '../../config/rules.json')),
  TARGET_LONG_RUN_KM: z.coerce.number().positive().optional(),
  DESKTOP_NOTIFICATION: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),

  FIT_ENABLED: flag,
  DIARY_ENABLED: flag,
  LEARN_ENABLED: flag,
  LEARN_API_URL: text,

  TIMESHEET_ENABLED: flag,
  TIMESHEET_API_URL: text,
  TIMESHEET_API_KEY: text,

  SCHEDULE_ENABLED: flag,
  SCHEDULE_SUPABASE_URL: text,
  SCHEDULE_SUPABASE_KEY: text,
  SCHEDULE_EMAIL: text,
  SCHEDULE_PASSWORD: text,

  FINANCE_ENABLED: flag,
  FINANCE_SUPABASE_URL: text,
  FINANCE_SUPABASE_KEY: text,
  FINANCE_EMAIL: text,
  FINANCE_PASSWORD: text,

  STOCK_ENABLED: flag,
  STOCK_SUPABASE_URL: text,
  STOCK_SUPABASE_KEY: text,
  STOCK_EMAIL: text,
  STOCK_PASSWORD: text,
  STOCK_TABLE: z.string().regex(/^\w+$/).default('stock_transactions'),
  STOCK_DATE_COLUMN: z.string().regex(/^\w+$/).default('date')
})

export type Env = z.infer<typeof envSchema>

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(source)
}
