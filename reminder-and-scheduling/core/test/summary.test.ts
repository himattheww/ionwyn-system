import { describe, expect, it } from 'vitest'
import { createLog, summarize } from '../src'
import { makeItem, sequence } from './helpers'

describe('summarize', () => {
  const items = [
    makeItem({ id: '1', module: 'kesehatan', status: 'selesai', date: '2026-10-12', durationMin: 45 }),
    makeItem({ id: '2', module: 'kesehatan', status: 'dilewati', date: '2026-10-13' }),
    makeItem({ id: '3', module: 'kesehatan', status: 'terencana', date: '2026-10-13' }),
    makeItem({ id: '4', module: 'kesehatan', status: 'terencana', date: '2026-10-14' }),
    makeItem({ id: '5', module: 'belajar', status: 'selesai', date: '2026-10-11', durationMin: 30 }),
    makeItem({ id: '6', module: 'belajar', status: 'digeser', date: '2026-10-11' }),
    makeItem({ id: '7', module: 'kerja', status: 'selesai', date: '2026-09-01' }),
  ]

  it('hitung per modul, abaikan arsip digeser, item hari ini, dan di luar rentang', () => {
    expect(summarize(items, '2026-10-05', '2026-10-14', '2026-10-14')).toEqual([
      { module: 'kesehatan', selesai: 1, dilewati: 1, belum: 1, minutesDone: 45 },
      { module: 'belajar', selesai: 1, dilewati: 0, belum: 0, minutesDone: 30 },
    ])
  })
})

describe('createLog', () => {
  const now = new Date(2026, 9, 14, 10, 0)

  it('mencatat aktivitas tanpa item dengan sumber manual', () => {
    const log = createLog({ module: 'kesehatan', type: 'run_done', value: 5, unit: 'km', note: ' pagi ' }, now, sequence())
    expect(log).toMatchObject({ type: 'run_done', value: 5, unit: 'km', note: 'pagi', itemId: null, endedAt: null })
    expect(log.meta).toEqual({ source: 'manual' })
  })

  it('unit dibuang kalau tidak ada nilai', () => {
    expect(createLog({ module: 'umum', type: 'catatan', unit: 'km' }, now, sequence()).unit).toBeNull()
  })

  it('menolak tipe kosong, idle, dan nilai bukan angka', () => {
    expect(() => createLog({ module: 'umum', type: ' ' }, now, sequence())).toThrow()
    expect(() => createLog({ module: 'umum', type: 'idle' }, now, sequence())).toThrow()
    expect(() => createLog({ module: 'umum', type: 'x', value: Number.NaN }, now, sequence())).toThrow()
  })
})
