import { Router } from 'express'
import { db } from './db.ts'

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 })

export function financeRoutes() {
  const router = Router()
  router.get('/hub/api/finance', async (req, res) => {
    const month = String(req.query.month ?? '')
    if (!/^\d{4}-\d{2}$/.test(month)) throw badRequest('month harus YYYY-MM')
    const owner = process.env.OWNER_USER_ID
    if (!owner || !process.env.DATABASE_URL) throw new Error('OWNER_USER_ID atau DATABASE_URL belum diisi')
    const from = `${month}-01`
    const [transactions, budgets, [before]] = await Promise.all([
      db()<{ id: string; date: string; type: string; amount: number; category: string; note: string | null }[]>`
        select id, date::text as date, type, amount::float8 as amount, category, note from public.transactions
        where user_id = ${owner} and date >= ${from}::date and date < ${from}::date + interval '1 month'
        order by date desc, created_at desc`,
      db()<{ month: string; utama: number; jajan: number; tabungan: number }[]>`
        select month, utama_amount::float8 as utama, jajan_amount::float8 as jajan, tabungan_amount::float8 as tabungan
        from public.budget_allocations
        where user_id = ${owner} and month <= ${month}
        order by month desc limit 1`,
      db()<{ cash: number; savings: number }[]>`
        select
          coalesce(sum(case when type = 'income' then amount when category in ('tabungan', 'dana_darurat') then 0 else -amount end), 0)::float8 as cash,
          coalesce(sum(case when type = 'income' then 0 when category = 'setor_tabungan' then amount when category in ('tabungan', 'dana_darurat') then -amount else 0 end), 0)::float8 as savings
        from public.transactions
        where user_id = ${owner} and date < ${from}::date + interval '1 month'`,
    ])
    const sum = (type: string) => transactions.filter(t => t.type === type).reduce((total, t) => total + t.amount, 0)
    const byCategory = new Map<string, { type: string; category: string; total: number }>()
    for (const t of transactions) {
      const key = `${t.type}:${t.category}`
      const entry = byCategory.get(key) ?? { type: t.type, category: t.category, total: 0 }
      entry.total += t.amount
      byCategory.set(key, entry)
    }
    const cash = transactions.reduce((total, t) => total + (t.type === 'income' ? t.amount : ['tabungan', 'dana_darurat'].includes(t.category) ? 0 : -t.amount), 0)
    res.json({
      month,
      income: sum('income'),
      expense: sum('expense') - transactions.filter(t => t.category === 'setor_tabungan').reduce((total, t) => total + t.amount, 0),
      carryOver: before.cash - cash,
      balance: before.cash,
      savings: before.savings,
      budget: budgets[0] ?? null,
      byCategory: [...byCategory.values()],
      transactions
    })
  })
  router.delete('/hub/api/finance/transactions/:id', async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw badRequest('id transaksi tidak valid')
    const owner = process.env.OWNER_USER_ID
    if (!owner || !process.env.DATABASE_URL) throw new Error('OWNER_USER_ID atau DATABASE_URL belum diisi')
    const [deleted] = await db()<{ date: string; type: string; amount: number; category: string; note: string | null }[]>`
      delete from public.transactions where id = ${req.params.id} and user_id = ${owner}
      returning date::text as date, type, amount::float8 as amount, category, note`
    if (!deleted) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' })
    res.json({ ok: true, deleted })
  })
  return router
}
