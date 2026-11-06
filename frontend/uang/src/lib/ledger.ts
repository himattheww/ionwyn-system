import dayjs from 'dayjs'
import { supabase } from './supabase'
import { cachedQuery } from './offlineCache'
import type { Account, BudgetItem, BudgetItemKind, Debt, Transaction } from './database.types'

export type Tx = Pick<
  Transaction,
  'id' | 'type' | 'amount' | 'category' | 'date' | 'note' | 'account_id' | 'to_account_id' | 'budget_item_id' | 'debt_id' | 'unplanned' | 'recurring_id'
> & { pending?: boolean }

export type Ledger = { accounts: Account[]; items: BudgetItem[]; debts: Debt[]; txs: Tx[] }

export const emptyLedger = (): Ledger => ({ accounts: [], items: [], debts: [], txs: [] })

export const ITEM_KINDS: Record<BudgetItemKind, string> = {
  tetap: 'Tetap',
  harian: 'Harian',
  cadangan: 'Cadangan',
  tabungan: 'Tabungan',
}

const LEGACY_DAILY = ['utama', 'jajan']

export async function loadLedger(uid: string): Promise<Ledger> {
  const [accounts, items, debts, txs] = await Promise.all([
    cachedQuery(`${uid}:accounts`, supabase.from('accounts').select('*').eq('user_id', uid).order('sort').order('created_at')),
    cachedQuery(`${uid}:budget-items`, supabase.from('budget_items').select('*').eq('user_id', uid).eq('archived', false).order('sort').order('created_at')),
    cachedQuery(`${uid}:debts`, supabase.from('debts').select('*').eq('user_id', uid).eq('archived', false).order('created_at')),
    cachedQuery(
      `${uid}:all-transactions`,
      supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }).order('created_at', { ascending: false }),
    ),
  ])
  return { accounts: accounts.data ?? [], items: items.data ?? [], debts: debts.data ?? [], txs: txs.data ?? [] }
}

export const activeAccounts = (l: Ledger) => l.accounts.filter(a => !a.archived)

export const defaultAccountId = (l: Ledger) => activeAccounts(l)[0]?.id ?? null

export const accountOf = (t: Tx, l: Ledger) => t.account_id ?? defaultAccountId(l)

export const accountName = (l: Ledger, id: string | null) => l.accounts.find(a => a.id === id)?.name ?? '—'

export function balanceOf(account: Account, l: Ledger) {
  return l.txs.reduce((sum, t) => {
    if (t.date < account.opening_date) return sum
    const amount = Number(t.amount)
    const from = accountOf(t, l) === account.id
    if (t.type === 'income' && from) return sum + amount
    if (t.type === 'expense' && from) return sum - amount
    if (t.type === 'transfer') return sum - (from ? amount : 0) + (t.to_account_id === account.id ? amount : 0)
    return sum
  }, Number(account.opening_balance))
}

export const totalMoney = (l: Ledger) => activeAccounts(l).reduce((sum, a) => sum + balanceOf(a, l), 0)

export const savingsMoney = (l: Ledger) => activeAccounts(l).filter(a => a.kind === 'tabungan').reduce((sum, a) => sum + balanceOf(a, l), 0)

export const inMonth = (txs: Tx[], month: string) => txs.filter(t => t.date.startsWith(month))

export const ADJUSTMENT = 'penyesuaian'

export const isAdjustment = (t: { category: string }) => t.category === ADJUSTMENT

export const sumOf = (txs: { type: string; amount: number; category: string }[], type: Tx['type']) =>
  txs.filter(t => t.type === type && !isAdjustment(t)).reduce((sum, t) => sum + Number(t.amount), 0)

export const unplanned = (txs: Tx[]) => txs.filter(t => t.type === 'expense' && t.unplanned)

export const monthlyNeed = (items: BudgetItem[]) => items.filter(i => i.kind !== 'tabungan').reduce((sum, i) => sum + Number(i.amount), 0)

export const dailyPool = (items: BudgetItem[]) => items.filter(i => i.kind === 'harian').reduce((sum, i) => sum + Number(i.amount), 0)

export function isDaily(t: { type: string; category: string; budget_item_id?: string | null }, items: BudgetItem[]) {
  if (t.type !== 'expense') return false
  if (t.budget_item_id) return items.find(i => i.id === t.budget_item_id)?.kind === 'harian'
  return LEGACY_DAILY.includes(t.category)
}

export function itemUsed(item: BudgetItem, monthTxs: Tx[]) {
  return monthTxs
    .filter(t => (item.kind === 'tabungan' ? t.type === 'transfer' && t.to_account_id === item.account_id : t.type === 'expense' && t.budget_item_id === item.id))
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function debtStatus(debt: Debt, txs: Tx[], now = dayjs()) {
  const payments = txs.filter(t => t.type === 'expense' && t.debt_id === debt.id)
  const paid = Number(debt.paid_before) + payments.reduce((sum, t) => sum + Number(t.amount), 0)
  const remaining = Math.max(0, Number(debt.total) - paid)
  const monthly = debt.monthly ? Number(debt.monthly) : null
  const monthsLeft = monthly ? Math.ceil(remaining / monthly) : null
  const paidThisMonth = payments.some(t => t.date.startsWith(now.format('YYYY-MM')))
  const payoff = monthsLeft ? now.add(monthsLeft - (paidThisMonth ? 0 : 1), 'month') : null
  return { paid, remaining, monthsLeft, payoff, paidThisMonth, done: remaining === 0 }
}
