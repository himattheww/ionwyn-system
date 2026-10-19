import { describe, expect, it } from 'vitest'
import { defaultSettings, dueNotices, markNotified } from '../src'
import { makeItem } from './helpers'

const none = { morning: true, evening: true }
const at = (h: number, m: number) => new Date(2026, 9, 14, h, m)
const kinds = (items: ReturnType<typeof makeItem>[], now: Date, sent = none, drafts = 0) =>
  dueNotices(items, now, defaultSettings, sent, drafts).map((n) => n.kind)

describe('dueNotices', () => {
  const run = makeItem({ startTime: '06:00', durationMin: 45 })

  it('pengingat 10 menit sebelum mulai', () => {
    expect(kinds([run], at(5, 49))).toEqual([])
    expect(kinds([run], at(5, 50))).toEqual(['reminder'])
  })

  it('pengingat tidak diulang setelah remindedAt terisi', () => {
    const reminded = makeItem({ remindedAt: '2026-10-14T05:50:00.000Z' })
    expect(kinds([reminded], at(5, 55))).toEqual([])
  })

  it('tanya selesai setelah slot berakhir, sekali', () => {
    expect(kinds([run], at(6, 44))).toEqual(['reminder'])
    expect(kinds([makeItem({ remindedAt: 'x', startTime: '06:00' })], at(6, 45))).toEqual(['ask'])
  })

  it('tanya ulang sekali setelah 60 menit', () => {
    const asked = makeItem({ remindedAt: 'x', askedAt: new Date(2026, 9, 14, 6, 45).toISOString() })
    expect(kinds([asked], at(7, 44))).toEqual([])
    expect(kinds([asked], at(7, 45))).toEqual(['reask'])
    expect(kinds([{ ...asked, reaskedAt: new Date(2026, 9, 14, 7, 45).toISOString() }], at(9, 0))).toEqual([])
  })

  it('item fixed tidak menawarkan Geser', () => {
    const fixed = makeItem({ kind: 'fixed', remindedAt: 'x' })
    const [ask] = dueNotices([fixed], at(7, 0), defaultSettings, none)
    expect(ask?.body).toBe('Selesai / Lewati')
  })

  it('item selesai atau dilewati tidak memicu notifikasi', () => {
    expect(kinds([makeItem({ status: 'selesai' }), makeItem({ id: 'b', status: 'dilewati' })], at(7, 0))).toEqual([])
  })

  it('tidak ada notifikasi di jam tenang', () => {
    const late = makeItem({ date: '2026-10-14', startTime: '21:00' })
    expect(kinds([late], at(23, 0))).toEqual([])
    expect(kinds([late], at(3, 0))).toEqual([])
  })

  it('ringkasan pagi muncul setelah 04.30 dan sebelum siang, sekali', () => {
    const items = [makeItem({ startTime: null, title: 'baca' })]
    const unsent = { morning: false, evening: true }
    expect(kinds(items, at(4, 29), unsent)).toEqual([])
    expect(kinds(items, at(4, 30), unsent)).toEqual(['morning'])
    expect(kinds(items, at(13, 0), unsent)).toEqual([])
  })

  it('ringkasan malam memuat item kapan-saja yang belum dijawab dan draf besok', () => {
    const items = [makeItem({ startTime: null, title: 'baca' })]
    const [evening] = dueNotices(items, at(20, 30), defaultSettings, { morning: true, evening: false }, 3)
    expect(evening?.kind).toBe('evening')
    expect(evening?.body).toContain('baca')
    expect(evening?.body).toContain('3 rutinitas')
  })

  it('item hari lalu yang belum ditanya langsung ditanya', () => {
    const old = makeItem({ date: '2026-10-13' })
    expect(kinds([old], at(8, 0))).toEqual(['ask'])
  })
})

describe('markNotified', () => {
  it('mengisi penanda sesuai jenis notifikasi dan hanya item terkait', () => {
    const a = makeItem({ id: 'a' })
    const b = makeItem({ id: 'b' })
    const now = at(6, 50)
    const notices = dueNotices([a, b], at(5, 55), defaultSettings, none).filter((n) => n.itemId === 'a')
    const changed = markNotified([a, b], notices, now)
    expect(changed).toHaveLength(1)
    expect(changed[0]).toMatchObject({ id: 'a', remindedAt: now.toISOString() })
  })
})
