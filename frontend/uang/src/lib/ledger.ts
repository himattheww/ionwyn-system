import { supabase } from './supabase'

type Tx = { type: string; amount: number; category: string }

export const SETOR = 'setor_tabungan'
export const SETOR_DARURAT = 'setor_dana_darurat'
const POTS = { [SETOR]: 'tabungan', [SETOR_DARURAT]: 'dana_darurat' } as const
const FROM_POTS = Object.values(POTS) as string[]

export const isDeposit = (t: Tx) => t.type === 'expense' && t.category in POTS
export const isWithdrawal = (t: Tx) => t.type === 'expense' && FROM_POTS.includes(t.category)

export const SAVINGS_CATEGORIES = [SETOR, SETOR_DARURAT, ...FROM_POTS]
export type Kind = 'expense' | 'income' | 'savings'
export const kindOf = (t: Tx): Kind => (t.type === 'income' ? 'income' : isDeposit(t) || isWithdrawal(t) ? 'savings' : 'expense')

export const spending = (txs: Tx[]) => txs.filter(t => t.type === 'expense' && !isDeposit(t)).reduce((s, t) => s + Number(t.amount), 0)

export function cashChange(txs: Tx[]) {
  return txs.reduce((s, t) => {
    if (t.type === 'income') return s + Number(t.amount)
    if (isWithdrawal(t)) return s
    return s - Number(t.amount)
  }, 0)
}

export function potChange(txs: Tx[], deposit: keyof typeof POTS) {
  return txs.reduce((s, t) => {
    if (t.type !== 'expense') return s
    if (t.category === deposit) return s + Number(t.amount)
    if (t.category === POTS[deposit]) return s - Number(t.amount)
    return s
  }, 0)
}

export function budgetFor(uid: string, month: string) {
  return supabase.from('budget_allocations').select('*').eq('user_id', uid).lte('month', month)
    .order('month', { ascending: false }).limit(1).maybeSingle()
}
