import { describe, expect, it } from 'vitest'
import { checkNewEntry, monthBefore, nightStatus } from './time.js'

const at = (iso: string) => new Date(`${iso}+07:00`)

describe('nightStatus', () => {
  it('tertutup pada 17.59', () => {
    expect(nightStatus(at('2026-10-19T17:59:00'))).toMatchObject({ isOpen: false, tonight: '2026-10-19' })
  })

  it('terbuka untuk hari ini pada 18.00', () => {
    expect(nightStatus(at('2026-10-19T18:00:00'))).toMatchObject({ isOpen: true, tonight: '2026-10-19' })
  })

  it('terbuka untuk tanggal kemarin pada 01.30', () => {
    expect(nightStatus(at('2026-10-20T01:30:00'))).toMatchObject({ isOpen: true, tonight: '2026-10-19' })
  })

  it('tertutup pada 02.00', () => {
    expect(nightStatus(at('2026-10-20T02:00:00'))).toMatchObject({ isOpen: false, tonight: '2026-10-20' })
  })

  it('memakai Asia/Jakarta, bukan zona waktu laptop', () => {
    expect(nightStatus(new Date('2026-10-19T11:00:00Z'))).toMatchObject({ isOpen: true, tonight: '2026-10-19' })
  })

  it('melewati pergantian tahun', () => {
    expect(nightStatus(at('2027-01-01T00:30:00')).tonight).toBe('2026-12-31')
  })
})

describe('checkNewEntry', () => {
  const night = at('2026-10-21T20:00:00')

  it('mengizinkan malam ini tanpa tanda diisi belakangan', () => {
    expect(checkNewEntry('2026-10-21', night)).toEqual({ ok: true, isBackfilled: false })
  })

  it('mengizinkan kemarin dan menandainya diisi belakangan', () => {
    expect(checkNewEntry('2026-10-20', night)).toEqual({ ok: true, isBackfilled: true })
  })

  it('kemarin pada 01.30 dihitung dari tanggal malam ini', () => {
    expect(checkNewEntry('2026-10-20', at('2026-10-22T01:30:00'))).toEqual({ ok: true, isBackfilled: true })
  })

  it('menolak dua hari lalu', () => {
    expect(checkNewEntry('2026-10-19', night).ok).toBe(false)
  })

  it('menolak tanggal yang belum tiba', () => {
    expect(checkNewEntry('2026-10-22', night).ok).toBe(false)
  })

  it('menolak semua entri baru di luar jendela', () => {
    expect(checkNewEntry('2026-10-21', at('2026-10-21T10:00:00')).ok).toBe(false)
  })
})

describe('monthBefore', () => {
  it('mundur satu bulan', () => {
    expect(monthBefore('2026-10-19')).toBe('2026-09-19')
    expect(monthBefore('2026-01-15')).toBe('2025-12-15')
  })

  it('null kalau tanggalnya tidak ada di bulan sebelumnya', () => {
    expect(monthBefore('2026-03-31')).toBeNull()
  })
})
