import { describe, expect, it, vi } from 'vitest'
import { openDb } from '../src/db.ts'
import { recalculate } from '../src/recalculate.ts'
import type { Adapter, SourceEvent } from '../src/types.ts'
import { rulesText } from './fixtures.ts'

const fitRun = (id: number, date: string, km: number): SourceEvent => ({ id: `fit:activity:${id}`, source: 'fit', type: 'run', date, value: km, meta: { scheduled: false } })

function setup() {
  const db = openDb(':memory:')
  const sources: Record<string, { enabled: boolean; events: SourceEvent[]; error?: string }> = {
    fit: { enabled: true, events: [fitRun(1, '2026-10-13', 5)] },
    diary: { enabled: true, events: [{ id: 'diary:entry:1', source: 'diary', type: 'entry', date: '2026-10-13', value: 1, meta: {} }] }
  }
  const adapters = (): Adapter[] =>
    Object.entries(sources).map(([name, source]) => ({
      name,
      label: name,
      enabled: source.enabled,
      read: async () => {
        if (source.error) throw new Error(source.error)
        return source.events
      }
    }))
  const notify = vi.fn()
  const count = (table: string) => (db.prepare(`select count(*) as n from ${table}`).get() as { n: number }).n
  const recalc = (text = rulesText, today = '2026-10-19') => recalculate(db, { rulesText: text, adapters, today, notify })
  return { db, sources, notify, count, recalc }
}

describe('hitung ulang', () => {
  it('dua kali tanpa perubahan data tidak membuat kejadian ganda dan tanpa notifikasi', async () => {
    const { count, recalc, notify } = setup()
    const first = await recalc()
    const entries = count('exp_entries')
    const second = await recalc()
    expect(first.silent).toBe(true)
    expect(second.silent).toBe(false)
    expect(second.lines).toEqual([])
    expect(count('events')).toBe(2)
    expect(count('exp_entries')).toBe(entries)
    expect(count('notifications')).toBe(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('semua perubahan dalam satu hitung digabung jadi satu notifikasi', async () => {
    const { sources, count, recalc, notify } = setup()
    await recalc()
    sources.fit.events.push(...Array.from({ length: 12 }, (_, i) => fitRun(100 + i, `2026-10-${String(i + 1).padStart(2, '0')}`, 25)))
    const result = await recalc()
    expect(result.lines).toEqual(expect.arrayContaining(['Achievement: Lari 10 km', 'Achievement: Half marathon']))
    expect(result.lines.some(line => line.startsWith('Level naik'))).toBe(true)
    expect(result.lines.some(line => line.startsWith('Stamina naik ke level'))).toBe(true)
    expect(count('notifications')).toBe(1)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith(result.lines)
  })

  it('aturan berubah: hitung ulang tanpa notifikasi dan log mengikuti aturan baru', async () => {
    const { db, sources, count, recalc, notify } = setup()
    await recalc()
    sources.fit.events.push(fitRun(2, '2026-10-14', 42.2))
    const changed = rulesText.replace('"base": 20', '"base": 30')
    const result = await recalc(changed)
    expect(result.silent).toBe(true)
    expect(count('notifications')).toBe(0)
    expect(notify).not.toHaveBeenCalled()
    const run = db.prepare(`select raw from exp_entries where rule = 'lari' and date = '2026-10-13'`).get() as { raw: number }
    expect(run.raw).toBe(40)
  })

  it('sumber gagal atau mati tidak menghentikan sumber lain', async () => {
    const { db, sources, recalc } = setup()
    await recalc()
    sources.fit.error = 'File database tidak ditemukan: C:/salah.db'
    sources.diary.events.push({ id: 'diary:entry:2', source: 'diary', type: 'entry', date: '2026-10-14', value: 1, meta: {} })
    await recalc()
    const status = db.prepare('select name, enabled, last_error, event_count from sources order by name').all()
    expect(status).toEqual([
      { name: 'diary', enabled: 1, last_error: null, event_count: 2 },
      { name: 'fit', enabled: 1, last_error: 'File database tidak ditemukan: C:/salah.db', event_count: 1 }
    ])
    const exp = db.prepare('select source, sum(awarded) as exp from exp_entries group by source order by source').all()
    expect(exp).toEqual([
      { source: 'diary', exp: 60 },
      { source: 'fit', exp: 60 }
    ])
  })
})
