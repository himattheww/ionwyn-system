import express, { Router } from 'express'
import { db } from './db.ts'

const categories: Record<string, string[]> = {
  expense: ['utama', 'jajan', 'tabungan', 'dana_darurat', 'lainnya'],
  income: ['gaji', 'freelance', 'bisnis', 'lainnya'],
}
const jakartaToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

export function quickRoutes() {
  const router = Router()
  router.post('/hub/api/quick/expense', express.json(), async (req, res) => {
    const { amount, category, note, type = 'expense' } = req.body ?? {}
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000_000 || !categories[type]?.includes(category)) {
      return res.status(400).json({ error: 'Isi nominal dan kategori dengan benar.' })
    }
    const owner = process.env.OWNER_USER_ID
    if (!owner || !process.env.DATABASE_URL) return res.status(500).json({ error: 'OWNER_USER_ID atau DATABASE_URL belum diisi.' })
    const text = typeof note === 'string' && note.trim() ? note.trim().slice(0, 200) : null
    const date = jakartaToday()
    await db()`
      insert into public.transactions (user_id, type, amount, category, note, date)
      values (${owner}, ${type}, ${amount}, ${category}, ${text}, ${date})`
    res.status(201).json({ ok: true, date })
  })
  return router
}
