import { describe, expect, it } from 'vitest'
import { addDays, addMonths, diffDays, isDate, isQuiet, monthGridDates, monthStart, toHHmm, toMinutes, weekStart } from '../src'

describe('time', () => {
  it('konversi jam dan menit', () => {
    expect(toMinutes('06:30')).toBe(390)
    expect(toHHmm(390)).toBe('06:30')
    expect(toHHmm(0)).toBe('00:00')
  })

  it('addDays lintas bulan dan tahun', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-10-14', -14)).toBe('2026-09-30')
  })

  it('weekStart jatuh di hari Senin', () => {
    expect(weekStart('2026-10-14')).toBe('2026-10-12')
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12')
  })

  it('diffDays', () => {
    expect(diffDays('2026-10-05', '2026-10-12')).toBe(7)
  })

  it('isDate menolak tanggal yang tidak ada', () => {
    expect(isDate('2026-02-30')).toBe(false)
    expect(isDate('2026-10-14')).toBe(true)
    expect(isDate('14-10-2026')).toBe(false)
  })

  it('isQuiet menangani rentang lewat tengah malam', () => {
    expect(isQuiet(toMinutes('23:30'), '22:00', '04:00')).toBe(true)
    expect(isQuiet(toMinutes('03:59'), '22:00', '04:00')).toBe(true)
    expect(isQuiet(toMinutes('04:00'), '22:00', '04:00')).toBe(false)
    expect(isQuiet(toMinutes('12:00'), '22:00', '04:00')).toBe(false)
  })

  it('monthStart dan addMonths lintas tahun', () => {
    expect(monthStart('2026-10-14')).toBe('2026-10-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
  })

  it('monthGridDates: 42 hari mulai Senin, memuat seluruh bulan', () => {
    const grid = monthGridDates('2026-10-01')
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-28')
    expect(grid).toContain('2026-10-31')
    expect(grid.at(-1)).toBe('2026-11-08')
  })
})
