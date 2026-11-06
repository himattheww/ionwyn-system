import dayjs from 'dayjs'
import { formatRpRounded as formatRupiah } from './format'

type TxLike = { type: string; amount: number; date: string }

export type AllowanceLevel = 'ok' | 'warn' | 'over' | 'far'

export type Allowance = {
  pool: number
  poolLeft: number
  daysLeft: number
  todayAllowance: number
  spentToday: number
  todayLeft: number
  ratio: number
  level: AllowanceLevel
  saved: number
  exhausted: boolean
}

export { formatRupiah }

export function computeAllowance<T extends TxLike>(pool: number, txs: T[], isDaily: (t: T) => boolean, now = dayjs()): Allowance | null {
  if (pool <= 0) return null

  const month = now.format('YYYY-MM')
  const today = now.format('YYYY-MM-DD')

  let spentBefore = 0
  let spentToday = 0

  for (const t of txs) {
    if (!t.date.startsWith(month) || !isDaily(t)) continue
    if (t.date === today) spentToday += Number(t.amount)
    else spentBefore += Number(t.amount)
  }

  const daysLeft = now.daysInMonth() - now.date() + 1
  const poolLeft = pool - spentBefore - spentToday
  const todayAllowance = pool / now.daysInMonth()
  const todayLeft = todayAllowance - spentToday
  const saved = todayAllowance * (now.date() - 1) - spentBefore + Math.min(0, todayLeft)
  const ratio = todayAllowance > 0 ? spentToday / todayAllowance : spentToday > 0 ? Infinity : 0
  const level: AllowanceLevel = ratio < 0.75 ? 'ok' : ratio <= 1 ? 'warn' : ratio <= 1.5 ? 'over' : 'far'

  return { pool, poolLeft, daysLeft, todayAllowance, spentToday, todayLeft, ratio, level, saved, exhausted: poolLeft <= 0 }
}

export function savedText(saved: number) {
  return saved >= 0 ? `Sudah menabung bulan ini sebesar ${formatRupiah(saved)}` : `Defisit bulan ini sebesar ${formatRupiah(-saved)}`
}

export function describeSpending(a: Allowance | null) {
  if (!a) return null
  if (a.level === 'over' || a.level === 'far') {
    return { tone: 'error' as const, text: `Melewati jatah hari ini ${formatRupiah(-a.todayLeft)}. ${savedText(a.saved)}.` }
  }
  if (a.level === 'warn') return { tone: 'info' as const, text: `Jatah hari ini hampir habis, sisa ${formatRupiah(a.todayLeft)}.` }
  return { tone: 'info' as const, text: `Sisa jatah hari ini ${formatRupiah(a.todayLeft)}.` }
}
