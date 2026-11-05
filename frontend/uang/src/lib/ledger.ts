import { supabase } from './supabase'

type Tx = { type: string; amount: number; category: string }

export const SETOR = 'setor_tabungan'
const FROM_SAVINGS = ['tabungan', 'dana_darurat']

export const isDeposit = (t: Tx) => t.type === 'expense' && t.category === SETOR
const isWithdrawal = (t: Tx) => t.type === 'expense' && FROM_SAVINGS.includes(t.category)

export const spending = (txs: Tx[]) => txs.filter(t => t.type === 'expense' && !isDeposit(t)).reduce((s, t) => s + Number(t.amount), 0)

export function cashChange(txs: Tx[]) {
  return txs.reduce((s, t) => {
    if (t.type === 'income') return s + Number(t.amount)
    if (isWithdrawal(t)) return s
    return s - Number(t.amount)
  }, 0)
}

export function savingsChange(txs: Tx[]) {
  return txs.reduce((s, t) => (isDeposit(t) ? s + Number(t.amount) : isWithdrawal(t) ? s - Number(t.amount) : s), 0)
}

export function budgetFor(uid: string, month: string) {
  return supabase.from('budget_allocations').select('*').eq('user_id', uid).lte('month', month)
    .order('month', { ascending: false }).limit(1).maybeSingle()
}
