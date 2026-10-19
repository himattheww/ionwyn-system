const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

const DAY_LONG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export type PartOfDay = 'Pagi' | 'Siang' | 'Sore' | 'Malam'

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

export function dayName(weekday: number): string {
  return DAY_NAMES[weekday] ?? ''
}

export function dayLong(weekday: number): string {
  return DAY_LONG[weekday] ?? ''
}

export function clock(min: number | null): string {
  return min === null ? '—' : pad2(Math.floor(min / 60) % 24) + '.' + pad2(min % 60)
}

export function duration(min: number | null): string {
  if (min === null) return '—'
  if (min < 60) return min + 'm'
  return Math.floor(min / 60) + 'j ' + pad2(min % 60) + 'm'
}

export function toMinutes(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

export function nowClock(): string {
  const now = new Date()
  return pad2(now.getHours()) + ':' + pad2(now.getMinutes())
}

export function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

export function partOfDay(min: number): PartOfDay {
  if (min < 660) return 'Pagi'
  if (min < 900) return 'Siang'
  if (min < 1080) return 'Sore'
  return 'Malam'
}

export function isoOf(date: Date): string {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

export function firstOfMonth(year: number, month: number): string {
  return year + '-' + pad2(month) + '-01'
}

export function shiftMonth(year: number, month: number, step: number): { year: number; month: number } {
  const t = new Date(year, month - 1 + step, 1)
  return { year: t.getFullYear(), month: t.getMonth() + 1 }
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10))
}
