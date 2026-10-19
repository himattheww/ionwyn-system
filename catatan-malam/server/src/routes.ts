import { Router } from 'express'
import { z } from 'zod'
import * as entries from './db.js'
import type { Db } from './db.js'
import { checkNewEntry, isValidDate, monthBefore, nightStatus } from './time.js'

const dateSchema = z.string().refine(isValidDate, 'Format tanggal harus YYYY-MM-DD.')

const answer = (label: string) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(4000, `${label} maksimal 4000 karakter.`)

const entrySchema = z.object({
  happened: answer('Apa yang terjadi hari ini'),
  goodThings: answer('Hal baik'),
  lessons: answer('Pelajaran'),
  freeText: z
    .string()
    .trim()
    .max(10000, 'Catatan bebas maksimal 10000 karakter.')
    .nullish()
    .transform((v) => v || null),
})

const rangeSchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

const fields = [
  ['happened', 'Apa yang terjadi'],
  ['goodThings', 'Hal baik'],
  ['lessons', 'Pelajaran'],
  ['freeText', 'Catatan bebas'],
] as const

function snippetAround(text: string, keyword: string) {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase())
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + keyword.length + 80)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

export function apiRouter(db: Db) {
  const router = Router()

  router.get('/today', (_req, res) => {
    const status = nightStatus(new Date())
    const year = Number(status.tonight.slice(0, 4))
    const monthAgo = monthBefore(status.tonight)
    const monthAgoEntry = monthAgo ? entries.findEntry(db, monthAgo) : null
    const onThisDay = [
      ...(monthAgoEntry ? [{ label: 'Sebulan lalu', entry: monthAgoEntry }] : []),
      ...entries.listSameDayEarlierYears(db, status.tonight).map((entry) => {
        const yearsAgo = year - Number(entry.date.slice(0, 4))
        return { label: yearsAgo === 1 ? 'Setahun lalu' : `${yearsAgo} tahun lalu`, entry }
      }),
    ]

    res.json({
      ...status,
      tonightEntry: entries.findEntry(db, status.tonight),
      yesterdayEmpty: !entries.findEntry(db, status.yesterday),
      recent: entries.listRecent(db, 5),
      onThisDay,
    })
  })

  router.get('/entries', (req, res) => {
    const month = z
      .string({ error: 'Parameter month wajib diisi.' })
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format month harus YYYY-MM.')
      .parse(req.query.month)
    res.json(entries.listMonth(db, month))
  })

  router.get('/entries/:date', (req, res) => {
    const entry = entries.findEntry(db, dateSchema.parse(req.params.date))
    if (!entry) return res.status(404).json({ error: 'Catatan untuk tanggal ini belum ada.' })
    res.json(entry)
  })

  router.put('/entries/:date', (req, res) => {
    const date = dateSchema.parse(req.params.date)
    const input = entrySchema.parse(req.body)

    if (entries.findEntry(db, date)) return res.json(entries.updateEntry(db, date, input))

    const check = checkNewEntry(date, new Date())
    if (!check.ok) return res.status(422).json({ error: check.reason })
    res.status(201).json(entries.insertEntry(db, date, input, check.isBackfilled))
  })

  router.get('/lessons', (req, res) => {
    const { from, to } = rangeSchema.parse(req.query)
    res.json(entries.listField(db, 'lessons', from, to))
  })

  router.get('/good-things', (req, res) => {
    const { from, to } = rangeSchema.parse(req.query)
    res.json(entries.listField(db, 'good_things', from, to))
  })

  router.get('/search', (req, res) => {
    const keyword = z
      .string({ error: 'Kata kunci wajib diisi.' })
      .trim()
      .min(1, 'Kata kunci wajib diisi.')
      .max(200, 'Kata kunci maksimal 200 karakter.')
      .parse(req.query.q)

    const results = entries.searchEntries(db, keyword).flatMap((entry) => {
      const match = fields.find(([key]) => entry[key]?.toLowerCase().includes(keyword.toLowerCase()))
      if (!match) return []
      const [key, label] = match
      return [{ date: entry.date, field: label, snippet: snippetAround(entry[key]!, keyword) }]
    })
    res.json(results)
  })

  return router
}
