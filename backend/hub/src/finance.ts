import { Router } from 'express'
import { db } from './db.ts'

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 })

function owner() {
  const id = process.env.OWNER_USER_ID
  if (!id || !process.env.DATABASE_URL) throw new Error('OWNER_USER_ID atau DATABASE_URL belum diisi')
  return id
}

export async function accountBalances(user: string) {
  return db()<{ id: string; name: string; kind: string; balance: number }[]>`
    select a.id, a.name, a.kind,
      (a.opening_balance + coalesce((
        select sum(case
          when t.type = 'income' and coalesce(t.account_id, d.id) = a.id then t.amount
          when t.type in ('expense', 'transfer') and coalesce(t.account_id, d.id) = a.id then -t.amount
          when t.type = 'transfer' and t.to_account_id = a.id then t.amount
          else 0 end)
        from public.transactions t
        where t.user_id = a.user_id and t.date >= a.opening_date
      ), 0))::float8 as balance
    from public.accounts a
    cross join lateral (
      select id from public.accounts where user_id = a.user_id and not archived order by sort, created_at limit 1
    ) d
    where a.user_id = ${user} and not a.archived
    order by a.sort, a.created_at`
}

export function financeRoutes() {
  const router = Router()
  router.get('/hub/api/finance', async (req, res) => {
    const month = String(req.query.month ?? '')
    if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('month harus YYYY-MM')
    const user = owner()
    const from = `${month}-01`
    const [transactions, accounts, items, debts] = await Promise.all([
      db()<{ id: string; date: string; type: string; amount: number; category: string; note: string | null; account: string | null; to_account: string | null; unplanned: boolean }[]>`
        select t.id, t.date::text as date, t.type, t.amount::float8 as amount, t.category, t.note,
          a.name as account, ta.name as to_account, t.unplanned
        from public.transactions t
        left join public.accounts a on a.id = t.account_id
        left join public.accounts ta on ta.id = t.to_account_id
        where t.user_id = ${user} and t.date >= ${from}::date and t.date < ${from}::date + interval '1 month'
        order by t.date desc, t.created_at desc`,
      accountBalances(user),
      db()<{ name: string; kind: string; amount: number; account: string | null; used: number }[]>`
        select i.name, i.kind, i.amount::float8 as amount, a.name as account,
          coalesce((
            select sum(t.amount) from public.transactions t
            where t.user_id = i.user_id and t.date >= ${from}::date and t.date < ${from}::date + interval '1 month'
              and ((i.kind = 'tabungan' and t.type = 'transfer' and t.to_account_id = i.account_id)
                or (i.kind <> 'tabungan' and t.type = 'expense' and t.budget_item_id = i.id))
          ), 0)::float8 as used
        from public.budget_items i
        left join public.accounts a on a.id = i.account_id
        where i.user_id = ${user} and not i.archived
        order by i.sort, i.created_at`,
      db()<{ name: string; kind: string; total: number; paid: number; monthly: number | null }[]>`
        select d.name, d.kind, d.total::float8 as total, d.monthly::float8 as monthly,
          (d.paid_before + coalesce((select sum(t.amount) from public.transactions t where t.debt_id = d.id and t.type = 'expense'), 0))::float8 as paid
        from public.debts d
        where d.user_id = ${user} and not d.archived
        order by d.created_at`,
    ])
    const counted = transactions.filter(t => t.category !== 'penyesuaian')
    const sum = (type: string) => counted.filter(t => t.type === type).reduce((total, t) => total + t.amount, 0)
    const byCategory = new Map<string, { type: string; category: string; total: number }>()
    for (const t of counted.filter(t => t.type !== 'transfer')) {
      const key = `${t.type}:${t.category}`
      const entry = byCategory.get(key) ?? { type: t.type, category: t.category, total: 0 }
      entry.total += t.amount
      byCategory.set(key, entry)
    }
    const need = items.filter(i => i.kind !== 'tabungan').reduce((total, i) => total + i.amount, 0)
    res.json({
      month,
      income: sum('income'),
      expense: sum('expense'),
      unplanned: transactions.filter(t => t.type === 'expense' && t.unplanned).reduce((total, t) => total + t.amount, 0),
      total: accounts.reduce((total, a) => total + a.balance, 0),
      accounts: accounts.map(({ name, kind, balance }) => ({ name, kind, balance })),
      emergencyTarget: { monthlyNeed: need, min: need * 3, ideal: need * 6 },
      budgetItems: items,
      debts: debts.map(d => {
        const remaining = Math.max(0, d.total - d.paid)
        return { ...d, remaining, monthsLeft: d.monthly ? Math.ceil(remaining / d.monthly) : null }
      }),
      byCategory: [...byCategory.values()],
      transactions,
    })
  })
  router.delete('/hub/api/finance/transactions/:id', async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw badRequest('id transaksi tidak valid')
    const [deleted] = await db()<{ date: string; type: string; amount: number; category: string; note: string | null }[]>`
      delete from public.transactions where id = ${req.params.id} and user_id = ${owner()}
      returning date::text as date, type, amount::float8 as amount, category, note`
    if (!deleted) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' })
    res.json({ ok: true, deleted })
  })
  return router
}
