import { describe, expect, it } from 'vitest'
import { freeGaps, suggestSlots } from '../src'
import { makeItem } from './helpers'

const meeting = makeItem({ id: 'm', title: 'meeting', kind: 'fixed', startTime: '09:00', durationMin: 60 })
const sync = makeItem({ id: 's', title: 'sync', kind: 'fixed', startTime: '13:00', durationMin: 120 })
const run = makeItem({ id: 'run', startTime: '06:00', durationMin: 45 })

describe('freeGaps', () => {
  it('celah di dalam jendela bangun 04.00-22.00', () => {
    expect(freeGaps([meeting, sync], '2026-10-14')).toEqual([
      { start: 240, end: 540 },
      { start: 600, end: 780 },
      { start: 900, end: 1320 },
    ])
  })

  it('item dilewati dan digeser tidak menghalangi', () => {
    const gaps = freeGaps([{ ...meeting, status: 'dilewati' }, { ...sync, status: 'digeser' }], '2026-10-14')
    expect(gaps).toEqual([{ start: 240, end: 1320 }])
  })

  it('item kapan-saja tidak menghalangi', () => {
    expect(freeGaps([makeItem({ startTime: null })], '2026-10-14')).toEqual([{ start: 240, end: 1320 }])
  })

  it('padding melebarkan blok sibuk', () => {
    expect(freeGaps([meeting], '2026-10-14', undefined, 10)).toEqual([
      { start: 240, end: 530 },
      { start: 610, end: 1320 },
    ])
  })
})

describe('suggestSlots', () => {
  it('tawarkan terdekat hari ini, terakhir hari ini, dan jam semula besok', () => {
    const now = new Date(2026, 9, 14, 5, 50)
    expect(suggestSlots([run, meeting, sync], run, now)).toEqual([
      { date: '2026-10-14', startTime: '06:20' },
      { date: '2026-10-14', startTime: '21:15' },
      { date: '2026-10-15', startTime: '06:00' },
    ])
  })

  it('malam hari: hanya slot besok', () => {
    const now = new Date(2026, 9, 14, 21, 30)
    expect(suggestSlots([run], run, now)).toEqual([
      { date: '2026-10-15', startTime: '06:00' },
      { date: '2026-10-15', startTime: '21:15' },
    ])
  })

  it('jam semula besok bentrok: pakai celah pertama besok', () => {
    const now = new Date(2026, 9, 14, 21, 30)
    const clash = makeItem({ id: 'c', kind: 'fixed', date: '2026-10-15', startTime: '05:50', durationMin: 30 })
    const slots = suggestSlots([run, clash], run, now)
    expect(slots[0]).toEqual({ date: '2026-10-15', startTime: '04:00' })
  })

  it('item kapan-saja: tawarkan tiga hari berikutnya tanpa jam', () => {
    const anytime = makeItem({ id: 'a', startTime: null })
    expect(suggestSlots([anytime], anytime, new Date(2026, 9, 14, 10, 0))).toEqual([
      { date: '2026-10-15', startTime: null },
      { date: '2026-10-16', startTime: null },
      { date: '2026-10-17', startTime: null },
    ])
  })
})
