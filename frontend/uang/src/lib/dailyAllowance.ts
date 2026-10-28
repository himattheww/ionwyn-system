import dayjs from 'dayjs'

type BudgetLike = {
  utama_amount: number
  jajan_amount: number
  tabungan_amount: number
  dana_darurat_amount: number
}

type TxLike = { type: string; amount: number; category: string; date: string }

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
  takenTabungan: number
  takenDanaDarurat: number
  allocTabungan: number
  allocDanaDarurat: number
}

const DAILY_CATEGORIES = ['utama', 'jajan']

import { formatRpRounded as formatRupiah } from './format'

export { formatRupiah }

export function computeAllowance(budget: BudgetLike | null, txs: TxLike[], now = dayjs()): Allowance | null {
  if (!budget) return null

  const pool = Number(budget.utama_amount) + Number(budget.jajan_amount)
  const month = now.format('YYYY-MM')
  const today = now.format('YYYY-MM-DD')

  let spentBefore = 0
  let spentToday = 0
  let takenTabungan = 0
  let takenDanaDarurat = 0

  for (const t of txs) {
    if (t.type !== 'expense' || !t.date.startsWith(month)) continue
    const amount = Number(t.amount)
    if (DAILY_CATEGORIES.includes(t.category)) {
      if (t.date === today) spentToday += amount
      else spentBefore += amount
    } else if (t.category === 'tabungan') {
      takenTabungan += amount
    } else if (t.category === 'dana_darurat') {
      takenDanaDarurat += amount
    }
  }

  const daysLeft = now.daysInMonth() - now.date() + 1
  const poolLeft = pool - spentBefore - spentToday
  const todayAllowance = pool / now.daysInMonth()
  const todayLeft = todayAllowance - spentToday
  const saved = todayAllowance * (now.date() - 1) - spentBefore + Math.min(0, todayLeft)
  const ratio = todayAllowance > 0 ? spentToday / todayAllowance : spentToday > 0 ? Infinity : 0
  const level: AllowanceLevel = ratio < 0.75 ? 'ok' : ratio <= 1 ? 'warn' : ratio <= 1.5 ? 'over' : 'far'

  return {
    pool,
    poolLeft,
    daysLeft,
    todayAllowance,
    spentToday,
    todayLeft,
    ratio,
    level,
    saved,
    exhausted: poolLeft <= 0,
    takenTabungan,
    takenDanaDarurat,
    allocTabungan: Number(budget.tabungan_amount),
    allocDanaDarurat: Number(budget.dana_darurat_amount),
  }
}

export function savedText(saved: number) {
  return saved >= 0 ? `Sudah menabung bulan ini sebesar ${formatRupiah(saved)}` : `Defisit bulan ini sebesar ${formatRupiah(-saved)}`
}

export function describeSpending(tx: TxLike, a: Allowance | null) {
  if (tx.type !== 'expense' || !a) return null

  if (tx.category === 'tabungan' || tx.category === 'dana_darurat') {
    const isTabungan = tx.category === 'tabungan'
    const total = isTabungan ? a.takenTabungan : a.takenDanaDarurat
    const alloc = isTabungan ? a.allocTabungan : a.allocDanaDarurat
    return {
      tone: 'info' as const,
      text: `Kamu mengambil ${formatRupiah(tx.amount)} dari ${isTabungan ? 'tabungan' : 'dana darurat'}. Total bulan ini ${formatRupiah(total)} dari alokasi ${formatRupiah(alloc)}.`,
    }
  }

  if (!DAILY_CATEGORIES.includes(tx.category)) return null

  if (a.level === 'over' || a.level === 'far') {
    return {
      tone: 'error' as const,
      text: `Melewati jatah hari ini ${formatRupiah(-a.todayLeft)}. ${savedText(a.saved)}.`,
    }
  }
  if (a.level === 'warn') {
    return { tone: 'info' as const, text: `Jatah hari ini hampir habis, sisa ${formatRupiah(a.todayLeft)}.` }
  }
  return { tone: 'info' as const, text: `Sisa jatah hari ini ${formatRupiah(a.todayLeft)}.` }
}
