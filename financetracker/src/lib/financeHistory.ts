import { formatRpRounded } from './format'
import dayjs from 'dayjs'
import 'dayjs/locale/id'

export type HistoryRow = {
  type: 'income' | 'expense'
  amount: number
  category: string
  date: string
}

export const HISTORY_MONTHS = 12
const PAGE_SIZE = 1000

const CAT_LABELS: Record<string, string> = {
  utama: 'Utama', jajan: 'Jajan', tabungan: 'Tabungan', dana_darurat: 'Dana Darurat',
  gaji: 'Gaji', freelance: 'Freelance', bisnis: 'Bisnis', lainnya: 'Lainnya',
}

type MonthStat = { income: number; expense: number; cats: Record<string, number> }

const monthLabel = (month: string) => dayjs(`${month}-01`).locale('id').format('MMMM YYYY')
const catLabel = (c: string) => CAT_LABELS[c] ?? c

export async function fetchHistoryRows(client: any, userId: string, now = dayjs()): Promise<HistoryRow[]> {
  const from = now.subtract(HISTORY_MONTHS - 1, 'month').startOf('month').format('YYYY-MM-DD')
  const rows: HistoryRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('transactions')
      .select('id, type, amount, category, date')
      .eq('user_id', userId)
      .gte('date', from)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      console.error('fetchHistoryRows', error.message)
      return []
    }
    rows.push(...(data as HistoryRow[]))
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

export function buildHistoryText(rows: HistoryRow[], monthlyIncome: number, now = dayjs()): string {
  const currentMonth = now.format('YYYY-MM')
  const byMonth = new Map<string, MonthStat>()

  for (const row of rows) {
    const month = row.date.slice(0, 7)
    if (month >= currentMonth) continue
    const stat = byMonth.get(month) ?? { income: 0, expense: 0, cats: {} }
    const amount = Number(row.amount)
    if (row.type === 'income') {
      stat.income += amount
    } else {
      stat.expense += amount
      stat.cats[row.category] = (stat.cats[row.category] ?? 0) + amount
    }
    byMonth.set(month, stat)
  }

  const months = [...byMonth.keys()].sort()
  if (months.length === 0) return ''

  const stats = months.map((m) => byMonth.get(m)!)
  const savingRate = (s: MonthStat) => {
    const base = s.income > 0 ? s.income : monthlyIncome
    return base > 0 ? Math.round(((s.income - s.expense) / base) * 100) : null
  }
  const catText = (cats: Record<string, number>) =>
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${catLabel(k)} ${formatRpRounded(v)}`)
      .join(', ') || 'tidak ada pengeluaran'

  const lines = months.map((m, i) => {
    const s = stats[i]
    const rate = savingRate(s)
    return `- ${monthLabel(m)}: pemasukan ${formatRpRounded(s.income)}, pengeluaran ${formatRpRounded(s.expense)}, sisa ${formatRpRounded(s.income - s.expense)}${rate === null ? '' : ` (saving rate ${rate}%)`} | ${catText(s.cats)}`
  })

  const n = months.length
  const avgIncome = stats.reduce((t, s) => t + s.income, 0) / n
  const avgExpense = stats.reduce((t, s) => t + s.expense, 0) / n
  const catTotals: Record<string, number> = {}
  stats.forEach((s) => Object.entries(s.cats).forEach(([k, v]) => { catTotals[k] = (catTotals[k] ?? 0) + v }))
  const avgCats: Record<string, number> = {}
  Object.entries(catTotals).forEach(([k, v]) => { avgCats[k] = v / n })

  const highest = stats.reduce((a, s, i) => (s.expense > stats[a].expense ? i : a), 0)
  const lowest = stats.reduce((a, s, i) => (s.expense < stats[a].expense ? i : a), 0)

  return [
    `(${n} bulan berdata sebelum bulan ini; bulan tanpa transaksi tidak dicantumkan)`,
    ...lines,
    `Rata-rata per bulan: pemasukan ${formatRpRounded(avgIncome)}, pengeluaran ${formatRpRounded(avgExpense)}, sisa ${formatRpRounded(avgIncome - avgExpense)}`,
    `Rata-rata pengeluaran per kategori: ${catText(avgCats)}`,
    `Pengeluaran tertinggi: ${monthLabel(months[highest])} (${formatRpRounded(stats[highest].expense)}); terendah: ${monthLabel(months[lowest])} (${formatRpRounded(stats[lowest].expense)})`,
  ].join('\n')
}
