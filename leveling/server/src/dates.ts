const jakarta = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const dayMs = 86_400_000

export function jakartaDate(instant: Date) {
  return jakarta.format(instant)
}

export function today() {
  return jakartaDate(new Date())
}

export function toDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}-\d{2}[ T][\d:.]+$/.test(text)) return text.slice(0, 10)
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : jakartaDate(parsed)
}

function utc(date: string) {
  return Date.parse(`${date}T00:00:00Z`)
}

export function addDays(date: string, days: number) {
  return new Date(utc(date) + days * dayMs).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return Math.round((utc(to) - utc(from)) / dayMs)
}

export function isoWeekday(date: string) {
  const day = new Date(utc(date)).getUTCDay()
  return day === 0 ? 7 : day
}

export function weekStart(date: string) {
  return addDays(date, 1 - isoWeekday(date))
}

export function monthEnd(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10)
}

export function eachDay(from: string, to: string) {
  const days: string[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day)
  return days
}
