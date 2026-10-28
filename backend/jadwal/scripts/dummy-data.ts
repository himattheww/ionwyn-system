import {
  addDays,
  completeItem,
  createItem,
  createLog,
  formatDate,
  minutesOfDay,
  monthStart,
  parseDate,
  shiftItem,
  startIdle,
  stopIdle,
  toMinutes,
  weekdayOf,
} from '../core/src'
import type { ActivityLog, Item, Kind, Module } from '../core/src'

export const itemIdPrefix = '00000000-0000-4000-8000-'
export const logIdPrefix = '00000000-0000-4000-9000-'
export const itemIdRange = { from: `${itemIdPrefix}000000000000`, to: `${itemIdPrefix}ffffffffffff` }
export const logIdRange = { from: `${logIdPrefix}000000000000`, to: `${logIdPrefix}ffffffffffff` }

interface Plan {
  title: string
  module: Module
  kind: Kind
  startTime: string | null
  durationMin: number
  activityType: string | null
}

const lari: Plan = { title: 'Lari pagi', module: 'kesehatan', kind: 'flexible', startTime: '06:00', durationMin: 45, activityType: 'run_done' }
const wfh: Plan = { title: 'WFH', module: 'kerja', kind: 'fixed', startTime: '08:00', durationMin: 480, activityType: null }
const belajar: Plan = { title: 'Belajar TypeScript', module: 'belajar', kind: 'flexible', startTime: '20:00', durationMin: 45, activityType: 'study_done' }
const meeting: Plan = { title: 'Meeting mingguan', module: 'kerja', kind: 'fixed', startTime: '14:00', durationMin: 60, activityType: null }
const review: Plan = { title: 'Review mingguan', module: 'kerja', kind: 'flexible', startTime: null, durationMin: 30, activityType: null }
const belanja: Plan = { title: 'Belanja mingguan', module: 'umum', kind: 'flexible', startTime: null, durationMin: 60, activityType: null }
const siapkan: Plan = { title: 'Siapkan minggu depan', module: 'umum', kind: 'flexible', startTime: '20:00', durationMin: 30, activityType: null }
const pengeluaran: Plan = { title: 'Catat pengeluaran bulanan', module: 'keuangan', kind: 'flexible', startTime: null, durationMin: 20, activityType: null }
const tagihan: Plan = { title: 'Bayar tagihan', module: 'keuangan', kind: 'flexible', startTime: null, durationMin: 15, activityType: null }

const plansFor = (date: string): Plan[] => {
  const weekday = weekdayOf(date)
  const day = Number(date.slice(8))
  const plans: Plan[] = []
  if ([1, 3, 5].includes(weekday)) plans.push(lari)
  if ([2, 4].includes(weekday)) plans.push(wfh)
  if ([1, 2, 3, 4].includes(weekday)) plans.push(belajar)
  if (weekday === 3) plans.push(meeting)
  if (weekday === 5) plans.push(review)
  if (weekday === 6) plans.push(belanja)
  if (weekday === 0) plans.push(siapkan)
  if (day === 1) plans.push(pengeluaran)
  if (day === 25) plans.push(tagihan)
  return plans
}

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const at = (date: string, minutes: number) => {
  const d = parseDate(date)
  d.setMinutes(minutes)
  return d
}

export const buildDummy = (now: Date): { items: Item[]; logs: ActivityLog[] } => {
  const random = seeded(20261014)
  const today = formatDate(now)
  const nowMinutes = minutesOfDay(now)
  const first = monthStart(today)
  const month = first.slice(0, 7)

  let itemCounter = 0
  let logCounter = 0
  const nextItemId = () => `${itemIdPrefix}${String(++itemCounter).padStart(12, '0')}`
  const nextLogId = () => `${logIdPrefix}${String(++logCounter).padStart(12, '0')}`

  const items: Item[] = []
  const logs: ActivityLog[] = []
  const pastDays: string[] = []

  for (let date = first; date.startsWith(month); date = addDays(date, 1)) {
    if (date < today) pastDays.push(date)

    for (const plan of plansFor(date)) {
      const created = createItem(
        {
          title: plan.title,
          module: plan.module,
          kind: plan.kind,
          date,
          startTime: plan.startTime,
          durationMin: plan.durationMin,
          activityType: plan.activityType,
        },
        nextItemId,
        at(addDays(date, -1), 21 * 60),
      )

      const start = created.startTime === null ? null : toMinutes(created.startTime)
      const end = start === null ? 21 * 60 : start + created.durationMin
      const isPast = date < today
      const isToday = date === today
      const slotOver = isPast || (isToday && (start === null ? false : nowMinutes >= end))

      if (!slotOver) {
        const reminded =
          isToday && start !== null && nowMinutes >= start - 10 ? at(date, start - 10).toISOString() : null
        items.push({ ...created, remindedAt: reminded })
        continue
      }

      let target = created
      const canShift = created.kind === 'flexible' && start !== null && isPast && random() < 0.15
      if (canShift) {
        const { original, next } = shiftItem(created, { date, startTime: '18:00' }, at(date, start - 60), nextItemId)
        items.push({
          ...original,
          remindedAt: at(date, start - 10).toISOString(),
          askedAt: at(date, end).toISOString(),
          reaskedAt: at(date, end + 60).toISOString(),
        })
        target = next
      }

      const targetStart = target.startTime === null ? null : toMinutes(target.startTime)
      const targetEnd = targetStart === null ? 21 * 60 : targetStart + target.durationMin
      const answered = {
        remindedAt: targetStart === null ? null : at(date, targetStart - 10).toISOString(),
        askedAt: at(date, targetEnd).toISOString(),
        reaskedAt: at(date, targetEnd + 60).toISOString(),
      }

      const roll = random()
      const recent = date >= addDays(today, -1)
      if (recent && roll > 0.85) {
        items.push({ ...target, ...answered })
      } else if (roll < 0.78) {
        const result = completeItem(target, at(date, targetEnd), nextLogId)
        items.push({ ...result.item, ...answered })
        logs.push(result.log)
      } else {
        items.push({ ...target, ...answered, status: 'dilewati' })
      }
    }
  }

  const weekdaysPast = pastDays.filter((date) => [2, 4].includes(weekdayOf(date))).slice(0, 3)
  weekdaysPast.forEach((date, index) => {
    const startMinute = 14 * 60
    const length = [40, 90, 55][index] ?? 45
    const session = startIdle([], { module: 'kerja', note: 'menunggu review' }, at(date, startMinute), nextLogId)
    logs.push(stopIdle(session, at(date, startMinute + length)))
  })

  pastDays
    .filter((date) => weekdayOf(date) === 6)
    .slice(0, 3)
    .forEach((date) => {
      logs.push(
        createLog(
          { module: 'kesehatan', type: 'steps', value: 7000 + Math.round(random() * 4000), unit: 'langkah', occurredAt: at(date, 21 * 60) },
          at(date, 21 * 60),
          nextLogId,
        ),
      )
    })

  return { items, logs }
}
