import { monthEnd, toDate } from '../dates.ts'
import type { SourceEvent } from '../types.ts'
import { supabaseRows, type SupabaseConfig } from './supabase.ts'

type Row = Record<string, unknown>

export function financeEvents(transactions: Row[], budgets: Row[], today: string, standingLimit = 0): SourceEvent[] {
  const events: SourceEvent[] = []
  const expenseByMonth = new Map<string, number>()
  for (const row of transactions) {
    const date = toDate(row.date)
    if (!date || row.type === 'transfer') continue
    events.push({ id: `finance:tx:${row.id}`, source: 'finance', type: 'transaction', date, value: 1, meta: { kind: row.type } })
    if (row.type === 'expense' && !String(row.category ?? '').startsWith('setor_')) {
      const month = date.slice(0, 7)
      expenseByMonth.set(month, (expenseByMonth.get(month) ?? 0) + Number(row.amount))
    }
  }
  const limits = new Map(budgets.map(b => [String(b.month), Number(b.utama_amount ?? 0) + Number(b.jajan_amount ?? 0)]))
  if (standingLimit > 0) for (const month of expenseByMonth.keys()) if (!limits.has(month)) limits.set(month, standingLimit)
  for (const [month, limit] of limits) {
    const end = monthEnd(month)
    if (limit <= 0 || end >= today) continue
    const spent = expenseByMonth.get(month) ?? 0
    if (spent <= limit) {
      events.push({ id: `finance:budget:${month}`, source: 'finance', type: 'budget_kept', date: end, value: 1, meta: { month, spent, limit } })
    }
  }
  return events
}

export async function readFinance(config: SupabaseConfig, today: string) {
  const transactions = await supabaseRows(config, 'transactions', 'select=id,date,type,amount,category&order=date')
  const budgets = await supabaseRows(config, 'budget_allocations', 'select=month,utama_amount,jajan_amount&order=month')
  const items = await supabaseRows(config, 'budget_items', 'select=amount,kind&archived=eq.false')
  const standing = items.filter(i => i.kind !== 'tabungan').reduce((sum, i) => sum + Number(i.amount), 0)
  return financeEvents(transactions, budgets, today, standing)
}
