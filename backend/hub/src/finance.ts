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
    const [transactions, budgets] = await Promise.all([
      db()<{ date: string; type: string; amount: number; category: string; note: string | null }[]>`
        select date::text as date, type, amount::float8 as amount, category, note from public.transactions
        where user_id = ${owner} and date >= ${from}::date and date < ${from}::date + interval '1 month'
        order by date desc, created_at desc`,
      db()<{ utama: number; jajan: number }[]>`
        select utama_amount::float8 as utama, jajan_amount::float8 as jajan from public.budget_allocations
        where user_id = ${owner} and month = ${month}`,
    ])
    const sum = (type: string) => transactions.filter(t => t.type === type).reduce((total, t) => total + t.amount, 0)
    const byCategory = new Map<string, { type: string; category: string; total: number }>()
    for (const t of transactions) {
      const key = `${t.type}:${t.category}`
      const entry = byCategory.get(key) ?? { type: t.type, category: t.category, total: 0 }
      entry.total += t.amount
      byCategory.set(key, entry)
    }
    res.json({ month, income: sum('income'), expense: sum('expense'), budget: budgets[0] ?? null, byCategory: [...byCategory.values()], transactions })
  })
  return router
}
