import express, { Router } from 'express'
import { db } from './db.ts'

const incomeCategories = ['gaji', 'freelance', 'bisnis', 'lainnya']
const jakartaToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })
const same = (a: string, b: unknown) => typeof b === 'string' && a.toLowerCase() === b.trim().toLowerCase()

export function quickRoutes() {
  const router = Router()
  router.post('/hub/api/quick/expense', express.json(), async (req, res) => {
    const { amount, category, pos, account, to, note, unplanned, type = 'expense' } = req.body ?? {}
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000 || !['expense', 'income', 'transfer'].includes(type)) {
      return res.status(400).json({ error: 'Isi nominal dan jenis transaksi dengan benar.' })
    }
    if (type === 'income' && !incomeCategories.includes(category)) return res.status(400).json({ error: `Kategori pemasukan: ${incomeCategories.join(', ')}.` })
    if (type === 'transfer' && typeof to !== 'string') return res.status(400).json({ error: 'Isi rekening tujuan transfer.' })
    if (type === 'expense' && typeof (pos ?? category) !== 'string') return res.status(400).json({ error: 'Isi pos pengeluaran.' })
    const owner = process.env.OWNER_USER_ID
    if (!owner || !process.env.DATABASE_URL) return res.status(500).json({ error: 'OWNER_USER_ID atau DATABASE_URL belum diisi.' })

    const [accounts, items] = await Promise.all([
      db()<{ id: string; name: string }[]>`
        select id, name from public.accounts where user_id = ${owner} and not archived order by sort, created_at`,
      db()<{ id: string; name: string; kind: string; account_id: string | null; debt_id: string | null }[]>`
        select id, name, kind, account_id, debt_id from public.budget_items where user_id = ${owner} and not archived order by sort`,
    ])
    const names = (list: { name: string }[]) => list.map(x => x.name).join(', ')
    const findAccount = (name: unknown) => accounts.find(a => same(a.name, name))
    if (account !== undefined && !findAccount(account)) return res.status(400).json({ error: `Rekening tidak dikenal. Pilihan: ${names(accounts)}.` })

    let row: Record<string, unknown>
    if (type === 'transfer') {
      const target = findAccount(to)
      const source = findAccount(account) ?? accounts[0]
      if (!target || target.id === source?.id) return res.status(400).json({ error: `Isi rekening tujuan yang berbeda. Pilihan: ${names(accounts)}.` })
      row = { category: 'transfer', account_id: source.id, to_account_id: target.id }
    } else if (type === 'income') {
      row = { category, account_id: (findAccount(account) ?? accounts[0])?.id ?? null }
    } else {
      const item = items.find(i => i.kind !== 'tabungan' && same(i.name, pos ?? category))
      if (!item && !same('lainnya', pos ?? category)) {
        return res.status(400).json({ error: `Pos tidak dikenal. Pilihan: ${names(items.filter(i => i.kind !== 'tabungan'))}, lainnya.` })
      }
      row = {
        category: item?.name ?? 'lainnya',
        budget_item_id: item?.id ?? null,
        debt_id: item?.debt_id ?? null,
        account_id: (findAccount(account) ?? accounts.find(a => a.id === item?.account_id) ?? accounts[0])?.id ?? null,
        unplanned: unplanned === true,
      }
    }

    const text = typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : null
    const date = jakartaToday()
    const values = { user_id: owner, type, amount, note: text, date, to_account_id: null, budget_item_id: null, debt_id: null, unplanned: false, ...row }
    await db()`insert into public.transactions ${db()(values)}`
    res.status(201).json({ ok: true, date, category: row.category })
  })
  return router
}
