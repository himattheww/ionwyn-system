import { describe, expect, it } from 'vitest'
import { completeItem, needsShiftDecision, shiftItem, skipItem, splitItem } from '../src'
import { makeItem, sequence } from './helpers'

const now = new Date(2026, 9, 14, 7, 0)

describe('completeItem', () => {
  it('menulis satu log dengan activityType item', () => {
    const { item, log } = completeItem(makeItem({ activityType: 'run_done' }), now, sequence())
    expect(item.status).toBe('selesai')
    expect(item.completedAt).toBe(now.toISOString())
    expect(log).toMatchObject({
      module: 'kesehatan',
      type: 'run_done',
      value: 45,
      unit: 'min',
      itemId: 'i1',
    })
  })

  it('tanpa activityType jatuh ke task_done', () => {
    expect(completeItem(makeItem(), now, sequence()).log.type).toBe('task_done')
  })

  it('item yang sudah selesai tidak bisa diselesaikan lagi', () => {
    expect(() => completeItem(makeItem({ status: 'selesai' }), now, sequence())).toThrow('sudah selesai')
  })
})

describe('skipItem', () => {
  it('ubah status ke dilewati', () => {
    expect(skipItem(makeItem()).status).toBe('dilewati')
  })
})

describe('shiftItem', () => {
  it('arsipkan item lama dan buat klon dengan hitungan geser bertambah', () => {
    const { original, next } = shiftItem(
      makeItem(),
      { date: '2026-10-14', startTime: '18:00' },
      now,
      sequence(),
    )
    expect(original.status).toBe('digeser')
    expect(next).toMatchObject({
      id: 'id-1',
      status: 'terencana',
      startTime: '18:00',
      rescheduleCount: 1,
      rescheduledFromId: 'i1',
    })
  })

  it('item fixed tidak boleh digeser', () => {
    expect(() =>
      shiftItem(makeItem({ kind: 'fixed' }), { date: '2026-10-15', startTime: '06:00' }, now, sequence()),
    ).toThrow('hanya item flexible')
  })

  it('slot yang sama ditolak', () => {
    expect(() =>
      shiftItem(makeItem(), { date: '2026-10-14', startTime: '06:00' }, now, sequence()),
    ).toThrow('slot sama')
  })
})

describe('needsShiftDecision', () => {
  it('true pada percobaan geser ketiga', () => {
    expect(needsShiftDecision(makeItem({ rescheduleCount: 1 }))).toBe(false)
    expect(needsShiftDecision(makeItem({ rescheduleCount: 2 }))).toBe(true)
  })
})

describe('splitItem', () => {
  it('pecah jadi item kapan-saja dan arsipkan yang lama', () => {
    const result = splitItem(
      makeItem({ rescheduleCount: 2 }),
      [
        { title: 'lari pemanasan', durationMin: 15 },
        { title: 'lari inti', durationMin: 30 },
      ],
      '2026-10-15',
      now,
      sequence(),
    )
    expect(result.original.status).toBe('digeser')
    expect(result.parts).toHaveLength(2)
    expect(result.parts[0]).toMatchObject({
      startTime: null,
      date: '2026-10-15',
      rescheduleCount: 0,
      rescheduledFromId: 'i1',
    })
  })

  it('minimal dua pecahan', () => {
    expect(() =>
      splitItem(makeItem(), [{ title: 'a', durationMin: 10 }], '2026-10-15', now, sequence()),
    ).toThrow('minimal dua')
  })
})
