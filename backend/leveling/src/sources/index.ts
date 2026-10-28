import type { Db } from '../db.ts'
import type { Env } from '../env.ts'
import type { Rules } from '../rules.ts'
import type { Adapter } from '../types.ts'
import { readDiary } from './diary.ts'
import { readFinance } from './finance.ts'
import { readFit } from './fit.ts'
import { readLearn } from './learn.ts'
import { readSchedule } from './schedule.ts'
import { readStock } from './stock.ts'
import { readTimesheet } from './timesheet.ts'
import { readWishes } from './wishes.ts'

export function createAdapters(env: Env, rules: Rules, today: string, db: Db): Adapter[] {
  return [
    { name: 'fit', label: 'Fit Tracker', enabled: env.FIT_ENABLED, read: () => readFit(db, rules) },
    { name: 'diary', label: 'Catatan Malam', enabled: env.DIARY_ENABLED, read: () => readDiary(db) },
    { name: 'wish', label: 'Cita-cita', enabled: true, read: () => readWishes(db) },
    { name: 'learn', label: 'Learn', enabled: env.LEARN_ENABLED, read: () => readLearn(env.LEARN_API_URL, rules) },
    {
      name: 'timesheet',
      label: 'Timesheet',
      enabled: env.TIMESHEET_ENABLED,
      read: () => readTimesheet(env.TIMESHEET_API_URL, env.TIMESHEET_API_KEY, today)
    },
    {
      name: 'schedule',
      label: 'Scheduling',
      enabled: env.SCHEDULE_ENABLED,
      read: () =>
        readSchedule(
          { url: env.SCHEDULE_SUPABASE_URL, key: env.SCHEDULE_SUPABASE_KEY, email: env.SCHEDULE_EMAIL, password: env.SCHEDULE_PASSWORD },
          rules.disiplin.linkedActivityTypes
        )
    },
    {
      name: 'finance',
      label: 'Keuangan',
      enabled: env.FINANCE_ENABLED,
      read: () =>
        readFinance({ url: env.FINANCE_SUPABASE_URL, key: env.FINANCE_SUPABASE_KEY, email: env.FINANCE_EMAIL, password: env.FINANCE_PASSWORD }, today)
    },
    {
      name: 'stock',
      label: 'Saham',
      enabled: env.STOCK_ENABLED,
      read: () =>
        readStock(
          { url: env.STOCK_SUPABASE_URL, key: env.STOCK_SUPABASE_KEY, email: env.STOCK_EMAIL, password: env.STOCK_PASSWORD },
          env.STOCK_TABLE,
          env.STOCK_DATE_COLUMN
        )
    }
  ]
}
