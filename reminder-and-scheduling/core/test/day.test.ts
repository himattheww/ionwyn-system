import { describe, expect, it } from 'vitest'
import { buildDay, unanswered } from '../src'
import { makeItem } from './helpers'

describe('buildDay', () => {
  it('pisahkan berjam dan kapan-saja, urut jam, sembunyikan arsip digeser', () => {
    const items = [
      makeItem({ id: 'b', startTime: '13:00', title: 'b' }),
      makeItem({ id: 'a', startTime: '06:00', title: 'a' }),
      makeItem({ id: 'c', startTime: null, title: 'c' }),
      makeItem({ id: 'd', startTime: '08:00', status: 'digeser' }),
      makeItem({ id: 'e', date: '2026-10-15' }),
    ]
    const view = buildDay(items, '2026-10-14')
    expect(view.timed.map((i) => i.id)).toEqual(['a', 'b'])
    expect(view.anytime.map((i) => i.id)).toEqual(['c'])
    expect(view.gaps[0]).toEqual({ start: 240, end: 360 })
  })
})

describe('unanswered', () => {
  const now = new Date(2026, 9, 14, 12, 0)

  it('mengumpulkan item lewat slot dan hari-hari sebelumnya yang masih terencana', () => {
    const items = [
      makeItem({ id: 'selesaiSlot', startTime: '06:00' }),
      makeItem({ id: 'belumSlot', startTime: '13:00' }),
      makeItem({ id: 'kemarin', date: '2026-10-13', startTime: null }),
      makeItem({ id: 'kapanSaja', startTime: null }),
      makeItem({ id: 'sudah', startTime: '06:00', status: 'selesai' }),
    ]
    expect(unanswered(items, now).map((i) => i.id)).toEqual(['selesaiSlot', 'kemarin'])
  })
})
