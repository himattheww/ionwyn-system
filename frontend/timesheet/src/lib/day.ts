import type { AbsenceKind, DayRow } from '../types'

export const LATE_AFTER = 540
export const WORKDAY = 480
export const DEFAULT_LUNCH = 60

export type DayKind = 'weekend' | 'future' | 'empty' | 'absent' | 'present' | 'today'

export const ABSENCE_LABEL: Record<AbsenceKind, string> = { sakit: 'Sakit', izin: 'Izin', cuti: 'Cuti' }

export function absenceOf(day: DayRow): AbsenceKind | null {
  if (day.hadir !== 'N') return null
  const note = day.note.toUpperCase()
  if (note.includes('SAKIT')) return 'sakit'
  if (note.includes('CUTI')) return 'cuti'
  return 'izin'
}

export function dayKind(day: DayRow, today: string): DayKind {
  if (day.hadir === 'N') return 'absent'
  if (day.date === today) return 'today'
  const off = day.weekday === 0 || day.weekday === 6 || day.holiday
  if (off && day.start === null) return 'weekend'
  if (day.date > today) return 'future'
  if (day.start === null && day.hadir !== 'Y') return 'empty'
  return 'present'
}

export function isLate(day: DayRow): boolean {
  return day.start !== null && day.start > LATE_AFTER
}

export function targetEnd(day: DayRow): number | null {
  return day.start === null ? null : day.start + WORKDAY + (day.lunch ?? DEFAULT_LUNCH)
}

export function workedSoFar(day: DayRow, now: number): number {
  if (day.worked !== null) return day.worked
  if (day.start === null) return 0
  return Math.max(0, (day.end ?? now) - day.start - (day.lunch ?? DEFAULT_LUNCH))
}
