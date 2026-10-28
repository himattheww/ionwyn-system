import { monthEnd, toDate } from '../dates.ts'
import type { SourceEvent } from '../types.ts'
import { supabaseRows, type SupabaseConfig } from './supabase.ts'

type Row = Record<string, unknown>

export function financeEvents(transactions: Row[], budgets: Row[], today: string): SourceEvent[] {
  const events: SourceEvent[] = []
  const expenseByMonth = new Map<string, number>()
  for (const row of transactions) {
    const date = toDate(row.date)
    if (!date) continue
    events.push({ id: `finance:tx:${row.id}`, source: 'finance', type: 'transaction', date, value: 1, meta: { kind: row.type } })
    if (row.type === 'expense') {
      const month = date.slice(0, 7)
      expenseByMonth.set(month, (expenseByMonth.get(month) ?? 0) + Number(row.amount))
    }
  }
  for (const budget of budgets) {
    const month = String(budget.month)
    const limit = Number(budget.utama_amount ?? 0) + Number(budget.jajan_amount ?? 0)
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
  const transactions = await supabaseRows(config, 'transactions', 'select=id,date,type,amount&order=date')
  const budgets = await supabaseRows(config, 'budget_allocations', 'select=month,utama_amount,jajan_amount&order=month')
  return financeEvents(transactions, budgets, today)
}
