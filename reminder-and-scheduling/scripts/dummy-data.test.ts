import { describe, expect, it } from 'vitest'
import { defaultSettings, dueNotices, openIdle } from '../core/src'
import { buildDummy, itemIdPrefix, logIdPrefix } from './dummy-data'

const now = new Date(2026, 9, 14, 12, 0)
const { items, logs } = buildDummy(now)

describe('buildDummy', () => {
  it('mengisi satu bulan kalender dengan id yang bisa dikenali dan unik', () => {
    expect(items.length).toBeGreaterThan(40)
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length)
    expect(new Set(logs.map((l) => l.id)).size).toBe(logs.length)
    expect(items.every((i) => i.id.startsWith(itemIdPrefix))).toBe(true)
    expect(logs.every((l) => l.id.startsWith(logIdPrefix))).toBe(true)
    expect(items.every((i) => i.date.startsWith('2026-10'))).toBe(true)
  })

  it('item fixed selalu punya jam', () => {
    expect(items.filter((i) => i.kind === 'fixed').every((i) => i.startTime !== null)).toBe(true)
  })

  it('setiap item selesai punya tepat satu log, dan log dari jadwal tidak yatim', () => {
    const done = items.filter((i) => i.status === 'selesai')
    expect(done.length).toBeGreaterThan(10)
    for (const item of done) {
      expect(logs.filter((l) => l.itemId === item.id)).toHaveLength(1)
    }
    const ids = new Set(items.map((i) => i.id))
    expect(logs.filter((l) => l.itemId !== null).every((l) => ids.has(l.itemId as string))).toBe(true)
  })

  it('geseran konsisten: klon menunjuk arsip yang berstatus digeser', () => {
    const byId = new Map(items.map((i) => [i.id, i]))
    const clones = items.filter((i) => i.rescheduledFromId !== null)
    expect(clones.length).toBeGreaterThan(0)
    for (const clone of clones) {
      expect(byId.get(clone.rescheduledFromId as string)?.status).toBe('digeser')
      expect(clone.rescheduleCount).toBe(1)
    }
  })

  it('tidak ada sesi kosong yang terbuka dan jadwal masa depan masih terencana', () => {
    expect(openIdle(logs)).toBeNull()
    expect(logs.filter((l) => l.type === 'idle').length).toBeGreaterThan(0)
    expect(items.filter((i) => i.date > '2026-10-14').every((i) => i.status === 'terencana')).toBe(true)
  })

  it('tidak memicu banjir notifikasi tanya saat dibuka', () => {
    const due = dueNotices(items, now, defaultSettings, { morning: true, evening: true })
    const asks = due.filter((n) => n.kind === 'ask' || n.kind === 'reask')
    expect(asks).toEqual([])
  })
})
