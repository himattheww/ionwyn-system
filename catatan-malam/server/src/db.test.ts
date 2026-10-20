import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import * as entries from './db.js'
import type { Query } from './db.js'

const migration = readFileSync(new URL('../../../supabase/migrations/20261020100000_catatan_malam.sql', import.meta.url), 'utf8')
const input = { happened: 'lari pagi', goodThings: 'cuaca cerah', lessons: 'tidur lebih awal', freeText: null }

let query: Query

beforeEach(async () => {
  const db = new PGlite()
  await db.exec('create role anon; create role authenticated;')
  await db.exec(migration)
  query = async (text, params = []) => (await db.query(text, params)).rows as never
})

describe('penyimpanan catatan di Postgres', () => {
  it('membuat, membaca, dan mengubah satu catatan', async () => {
    const created = await entries.insertEntry(query, '2026-10-19', input, false)
    expect(created).toMatchObject({ date: '2026-10-19', happened: 'lari pagi', isBackfilled: false, freeText: null })
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    const updated = await entries.updateEntry(query, '2026-10-19', { ...input, lessons: 'minum air' })
    expect(updated.lessons).toBe('minum air')
    expect(await entries.findEntry(query, '2026-10-19')).toMatchObject({ lessons: 'minum air' })
    expect(await entries.findEntry(query, '2026-10-18')).toBeNull()
  })

  it('daftar bulan, terbaru, dan hari yang sama di tahun lalu', async () => {
    await entries.insertEntry(query, '2025-10-19', input, false)
    await entries.insertEntry(query, '2026-09-30', input, false)
    await entries.insertEntry(query, '2026-10-01', input, true)
    await entries.insertEntry(query, '2026-10-19', input, false)
    expect(await entries.listMonth(query, '2026-10')).toEqual([
      { date: '2026-10-01', isBackfilled: true },
      { date: '2026-10-19', isBackfilled: false }
    ])
    expect((await entries.listRecent(query, 2)).map((e) => e.date)).toEqual(['2026-10-19', '2026-10-01'])
    expect((await entries.listSameDayEarlierYears(query, '2026-10-19')).map((e) => e.date)).toEqual(['2025-10-19'])
  })

  it('kumpulan pelajaran per rentang dan pencarian tanpa membedakan huruf besar', async () => {
    await entries.insertEntry(query, '2026-10-10', { ...input, lessons: 'Sabar 100%' }, false)
    await entries.insertEntry(query, '2026-10-12', { ...input, lessons: 'fokus' }, false)
    expect(await entries.listField(query, 'lessons', '2026-10-11', '2026-10-31')).toEqual([{ date: '2026-10-12', text: 'fokus' }])
    expect((await entries.searchEntries(query, 'sabar 100%')).map((e) => e.date)).toEqual(['2026-10-10'])
    expect(await entries.searchEntries(query, '50%')).toEqual([])
  })
})
