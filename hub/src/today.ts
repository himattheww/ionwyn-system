import { formatDate, unanswered, weekStart } from '../../reminder-and-scheduling/core/src/index.ts'
import { config } from './config.ts'
import { integrationStatus } from './integrations.ts'
import { scheduleStore } from './schedule.ts'
import { getJson, timesheetMonth, type TimesheetDay } from './sources.ts'

type Card = { ok: true; data: unknown } | { ok: false; error: string }

async function card(read: () => Promise<unknown>): Promise<Card> {
  try {
    return { ok: true, data: await read() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function jadwal(today: string) {
  const store = await scheduleStore()
  const items = (await store.itemsBetween(today, today)).filter(i => i.status !== 'digeser')
  const pending = unanswered(await store.itemsBetween(weekStart(today), today), new Date())
  return {
    items: items.map(i => ({ title: i.title, startTime: i.startTime, durationMin: i.durationMin, status: i.status, activityType: i.activityType })),
    unanswered: pending.length
  }
}

async function catatan() {
  const data = await getJson<{ tonight: string; isOpen: boolean; tonightEntry: unknown; yesterdayEmpty: boolean }>(`${config.apps.catatan}/api/today`)
  return { tonight: data.tonight, isOpen: data.isOpen, written: data.tonightEntry !== null, yesterdayEmpty: data.yesterdayEmpty }
}

async function fit() {
  const s = await getJson<{
    runDays: { date: string; plan: string | null; done: boolean; km: number }[]
    runKm: number
    sleepAvg7: number | null
    rhrAvg7: number | null
    strengthSessions: number
    sync: { last_success_at: string | null; last_error: string | null; last_error_at: string | null }
  }>(`${config.apps.fit}/api/summary`)
  return {
    runKm: s.runKm,
    planned: s.runDays.filter(d => d.plan).length,
    plannedDone: s.runDays.filter(d => d.plan && d.done).length,
    runDays: s.runDays,
    sleepAvg7: s.sleepAvg7,
    rhrAvg7: s.rhrAvg7,
    strengthSessions: s.strengthSessions,
    sync: s.sync
  }
}

async function learn() {
  const tracks = await getJson<{ id: number; goal: string; hoursPerWeek: number; status: string; minutesThisWeek: number }[]>(`${config.apps.learn}/api/tracks`)
  return tracks.filter(t => t.status === 'aktif').map(t => ({ id: t.id, goal: t.goal, targetMin: t.hoursPerWeek * 60, minutes: t.minutesThisWeek }))
}

async function leveling() {
  const { state } = await getJson<{ state: { level: number; tier: string; levelExp: number; levelNeed: number; className: string; title: string; quests: unknown[] } | null }>(
    `${config.apps.leveling}/api/character`
  )
  if (!state) return null
  return { level: state.level, tier: state.tier, levelExp: state.levelExp, levelNeed: state.levelNeed, className: state.className, title: state.title, quests: state.quests }
}

let timesheetCache: { at: number; today: string; day: TimesheetDay | null } | null = null

async function timesheet(today: string) {
  if (!timesheetCache || timesheetCache.today !== today || Date.now() - timesheetCache.at > 30 * 60_000) {
    const body = await timesheetMonth(today)
    timesheetCache = { at: Date.now(), today, day: body.month.days.find(d => d.date === today) ?? null }
  }
  return timesheetCache.day
}

async function financeToken() {
  const { url, key, email, password } = config.finance
  if (!url || !key || !email || !password) throw new Error('FINANCE_SUPABASE_URL, FINANCE_SUPABASE_KEY, FINANCE_EMAIL, atau FINANCE_PASSWORD belum diisi')
  const body = await getJson<{ access_token: string }>(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return body.access_token
}

async function uang(today: string) {
  const { url, key } = config.finance
  const token = await financeToken()
  const headers = { apikey: key!, authorization: `Bearer ${token}` }
  const month = today.slice(0, 7)
  const [rows, budgets] = await Promise.all([
    getJson<{ date: string; type: string; amount: number; category: string }[]>(
      `${url}/rest/v1/transactions?select=date,type,amount,category&type=eq.expense&date=gte.${month}-01&date=lte.${today}`,
      { headers }
    ),
    getJson<{ utama_amount: number; jajan_amount: number }[]>(`${url}/rest/v1/budget_allocations?select=utama_amount,jajan_amount&month=eq.${month}`, { headers })
  ])
  const spending = rows.filter(r => r.category === 'utama' || r.category === 'jajan')
  const sum = (list: typeof rows) => list.reduce((total, r) => total + Number(r.amount), 0)
  const budget = budgets[0] ? Number(budgets[0].utama_amount) + Number(budgets[0].jajan_amount) : null
  return { today: sum(spending.filter(r => r.date === today)), month: sum(spending), budget }
}

export async function todaySummary() {
  const today = formatDate(new Date())
  const [jadwalCard, catatanCard, fitCard, learnCard, levelingCard, timesheetCard, uangCard] = await Promise.all([
    card(() => jadwal(today)),
    card(catatan),
    card(fit),
    card(learn),
    card(leveling),
    card(() => timesheet(today)),
    card(() => uang(today))
  ])
  return {
    today,
    cards: { jadwal: jadwalCard, catatan: catatanCard, fit: fitCard, learn: learnCard, leveling: levelingCard, timesheet: timesheetCard, uang: uangCard },
    integrations: integrationStatus()
  }
}
