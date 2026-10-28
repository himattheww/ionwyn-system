export const TIME_ZONE = 'Asia/Jakarta'
const WINDOW_START_HOUR = 18
const WINDOW_END_HOUR = 2

const jakartaFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

export function jakartaClock(now: Date) {
  const parts = Object.fromEntries(jakartaFormat.formatToParts(now).map((p) => [p.type, p.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    time: `${parts.hour}${parts.minute}${parts.second}`,
  }
}

export function isValidDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  return utc.getUTCFullYear() === y && utc.getUTCMonth() === m - 1 && utc.getUTCDate() === d
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function monthBefore(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  const prevYear = m === 1 ? y - 1 : y
  const prevMonth = m === 1 ? 12 : m - 1
  const candidate = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isValidDate(candidate) ? candidate : null
}

export function nightStatus(now: Date) {
  const { date, hour } = jakartaClock(now)
  const tonight = hour < WINDOW_END_HOUR ? addDays(date, -1) : date
  return {
    tonight,
    yesterday: addDays(tonight, -1),
    isOpen: hour >= WINDOW_START_HOUR || hour < WINDOW_END_HOUR,
  }
}

export type NewEntryCheck = { ok: true; isBackfilled: boolean } | { ok: false; reason: string }

export function checkNewEntry(date: string, now: Date): NewEntryCheck {
  const { tonight, yesterday, isOpen } = nightStatus(now)
  if (!isOpen) return { ok: false, reason: 'Catatan baru hanya bisa dibuat antara pukul 18.00 dan 02.00.' }
  if (date === tonight) return { ok: true, isBackfilled: false }
  if (date === yesterday) return { ok: true, isBackfilled: true }
  if (date > tonight) return { ok: false, reason: 'Tanggal ini belum tiba.' }
  return { ok: false, reason: 'Catatan untuk tanggal ini sudah lewat dan tidak bisa dibuat lagi.' }
}
