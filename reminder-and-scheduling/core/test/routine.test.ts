import { describe, expect, it } from 'vitest'
import { copyWeek, createTemplate, generateRange, generateWeek } from '../src'
import { makeItem, makeTemplate, sequence } from './helpers'

const now = new Date(2026, 9, 11, 20, 30)

const templates = [
  makeTemplate({ id: 'wfh-sel', weekday: 2, title: 'WFH', kind: 'fixed', startTime: '08:00', durationMin: 480, activityType: null }),
  makeTemplate({ id: 'wfh-kam', weekday: 4, title: 'WFH', kind: 'fixed', startTime: '08:00', durationMin: 480, activityType: null }),
  makeTemplate({ id: 'lari-sen', weekday: 1 }),
  makeTemplate({ id: 'lari-rab', weekday: 3 }),
  makeTemplate({ id: 'lari-jum', weekday: 5 }),
  makeTemplate({ id: 'lari-off', weekday: 6, active: false }),
]

describe('generateWeek', () => {
  it('buat item per template aktif di tanggal yang benar', () => {
    const items = generateWeek(templates, '2026-10-14', [], now, sequence())
    expect(items).toHaveLength(5)
    expect(items.map((i) => [i.routineId, i.date])).toEqual([
      ['wfh-sel', '2026-10-13'],
      ['wfh-kam', '2026-10-15'],
      ['lari-sen', '2026-10-12'],
      ['lari-rab', '2026-10-14'],
      ['lari-jum', '2026-10-16'],
    ])
  })

  it('tidak membuat ulang yang sudah ada, termasuk yang sudah digeser', () => {
    const existing = [
      makeItem({ id: 'a', routineId: 'lari-sen', date: '2026-10-12' }),
      makeItem({ id: 'b', routineId: 'lari-rab', date: '2026-10-17' }),
    ]
    const items = generateWeek(templates, '2026-10-14', existing, now, sequence())
    expect(items.map((i) => i.routineId)).toEqual(['wfh-sel', 'wfh-kam', 'lari-jum'])
  })

  it('jalan dua kali tidak menggandakan', () => {
    const first = generateWeek(templates, '2026-10-14', [], now, sequence())
    expect(generateWeek(templates, '2026-10-14', first, now, sequence())).toHaveLength(0)
  })
})

describe('copyWeek', () => {
  const lastWeek = [
    makeItem({ id: 'a', title: 'lari', date: '2026-10-05', startTime: '06:00' }),
    makeItem({ id: 'b', title: 'lari', date: '2026-10-07', startTime: '06:00', status: 'selesai' }),
    makeItem({ id: 'c', title: 'lari', date: '2026-10-09', startTime: '06:00', status: 'digeser' }),
  ]

  it('salin dengan geser tujuh hari, reset status, lewati arsip digeser', () => {
    const copied = copyWeek(lastWeek, '2026-10-05', '2026-10-12', now, sequence())
    expect(copied.map((i) => i.date)).toEqual(['2026-10-12', '2026-10-14'])
    expect(copied.every((i) => i.status === 'terencana' && i.rescheduleCount === 0)).toBe(true)
  })

  it('tidak menggandakan item yang sudah ada di minggu tujuan', () => {
    const existing = [...lastWeek, makeItem({ id: 'z', title: 'lari', date: '2026-10-12', startTime: '06:00' })]
    const copied = copyWeek(existing, '2026-10-05', '2026-10-12', now, sequence())
    expect(copied.map((i) => i.date)).toEqual(['2026-10-14'])
  })
})

describe('createTemplate', () => {
  it('membuat template aktif dengan default modul umum', () => {
    const t = createTemplate({ weekday: 2, title: ' WFH ', kind: 'fixed', startTime: '08:00', durationMin: 480 }, sequence())
    expect(t).toMatchObject({ id: 'id-1', weekday: 2, title: 'WFH', module: 'umum', active: true, activityType: null })
  })

  it('menolak fixed tanpa jam, hari di luar 0-6, dan durasi nol', () => {
    const base = { title: 'x', kind: 'flexible' as const, durationMin: 30, weekday: 1 }
    expect(() => createTemplate({ ...base, kind: 'fixed' }, sequence())).toThrow('item fixed wajib punya jam')
    expect(() => createTemplate({ ...base, weekday: 7 }, sequence())).toThrow('hari tidak valid')
    expect(() => createTemplate({ ...base, durationMin: 0 }, sequence())).toThrow()
  })
})

describe('generateRange', () => {
  it('membangkitkan beberapa minggu berurutan', () => {
    const items = generateRange(templates, '2026-10-14', 4, [], now, sequence())
    expect(items).toHaveLength(20)
    expect(items.at(0)?.date).toBe('2026-10-13')
    expect(items.at(-1)?.date).toBe('2026-11-06')
  })

  it('melewati tanggal sebelum notBefore', () => {
    const items = generateRange(templates, '2026-10-14', 1, [], now, sequence(), '2026-10-14')
    expect(items.map((i) => i.date)).toEqual(['2026-10-15', '2026-10-14', '2026-10-16'])
  })

  it('aman dijalankan ulang dan menghormati item yang sudah ada', () => {
    const first = generateRange(templates, '2026-10-14', 4, [], now, sequence())
    expect(generateRange(templates, '2026-10-14', 4, first, now, sequence())).toHaveLength(0)
    const partial = first.filter((i) => i.date < '2026-10-19')
    expect(generateRange(templates, '2026-10-14', 4, partial, now, sequence())).toHaveLength(15)
  })
})
