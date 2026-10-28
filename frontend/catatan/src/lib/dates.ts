const toUtc = (date: string) => new Date(`${date}T00:00:00Z`)

const longFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const monthFormat = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const shortMonthFormat = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' })
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' })

export const formatDate = (date: string) => longFormat.format(toUtc(date))
export const formatMonth = (month: string) => monthFormat.format(toUtc(`${month}-01`))

export const dayParts = (date: string) => ({
  day: Number(date.slice(8)),
  month: shortMonthFormat.format(toUtc(date)),
  weekday: weekdayFormat.format(toUtc(date)),
})

export function addDays(date: string, days: number) {
  const d = toUtc(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonths(month: string, months: number) {
  const d = toUtc(`${month}-01`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 7)
}

export function weekRange(date: string) {
  const mondayOffset = (toUtc(date).getUTCDay() + 6) % 7
  const from = addDays(date, -mondayOffset)
  return { from, to: addDays(from, 6) }
}

export function monthRange(date: string) {
  const month = date.slice(0, 7)
  return { from: `${month}-01`, to: addDays(`${addMonths(month, 1)}-01`, -1) }
}

export function monthGrid(month: string) {
  const first = `${month}-01`
  const start = addDays(first, -((toUtc(first).getUTCDay() + 6) % 7))
  const end = addDays(`${addMonths(month, 1)}-01`, -1)
  const days: string[] = []
  for (let d = start; d <= end || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d)
  return days
}

const jakartaFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
})

export function jakartaNight() {
  const parts = Object.fromEntries(jakartaFormat.formatToParts(new Date()).map((p) => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  return Number(parts.hour) < 2 ? addDays(date, -1) : date
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const formatClock = (now = new Date()) => clockFormat.format(now).replace(':', '.')

const OPEN_AT = 18 * 60
const WINDOW = 8 * 60

export function writingWindow(now = new Date()) {
  const [h, m] = clockFormat.format(now).split(':').map(Number)
  const minutes = h * 60 + m
  const elapsed = (minutes - OPEN_AT + 1440) % 1440
  const open = elapsed < WINDOW
  return {
    open,
    progress: open ? elapsed / WINDOW : 0,
    minutesLeft: open ? WINDOW - elapsed : 1440 - elapsed,
  }
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return [h && `${h} jam`, m && `${m} menit`].filter(Boolean).join(' ') || 'kurang dari 1 menit'
}
