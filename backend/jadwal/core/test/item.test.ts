import { describe, expect, it } from 'vitest'
import { createItem } from '../src'
import { sequence } from './helpers'

const now = new Date(2026, 9, 14, 5, 0)

describe('createItem', () => {
  it('fixed tanpa jam ditolak', () => {
    expect(() =>
      createItem({ title: 'meeting', kind: 'fixed', date: '2026-10-14', durationMin: 60 }, sequence(), now),
    ).toThrow('item fixed wajib punya jam')
  })

  it('flexible boleh tanpa jam', () => {
    const item = createItem(
      { title: 'baca', kind: 'flexible', date: '2026-10-14', durationMin: 30 },
      sequence(),
      now,
    )
    expect(item.startTime).toBeNull()
    expect(item.status).toBe('terencana')
    expect(item.rescheduleCount).toBe(0)
    expect(item.module).toBe('umum')
  })

  it('menolak durasi nol, jam salah, dan lewat tengah malam', () => {
    const base = { title: 'x', kind: 'flexible' as const, date: '2026-10-14' }
    expect(() => createItem({ ...base, durationMin: 0 }, sequence(), now)).toThrow()
    expect(() => createItem({ ...base, durationMin: 10, startTime: '25:00' }, sequence(), now)).toThrow('jam tidak valid')
    expect(() => createItem({ ...base, durationMin: 60, startTime: '23:30' }, sequence(), now)).toThrow(
      'item melewati tengah malam',
    )
  })
})
