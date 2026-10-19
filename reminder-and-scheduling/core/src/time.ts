const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const pad = (n: number) => String(n).padStart(2, '0')

export const isDate = (value: string) => datePattern.test(value) && formatDate(parseDate(value)) === value

export const isTime = (value: string) => timePattern.test(value)

export const toMinutes = (hhmm: string): number => {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const toHHmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

export const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseDate = (value: string): Date => {
  const [y = 0, m = 1, d = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const addDays = (date: string, days: number): string => {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export const diffDays = (from: string, to: string): number =>
  Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000)

export const weekdayOf = (date: string) => parseDate(date).getDay()

export const weekStart = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7))

export const isQuiet = (minutes: number, quietStart: string, quietEnd: string) => {
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`

export const addMonths = (monthFirst: string, months: number) => {
  const d = parseDate(monthFirst)
  d.setMonth(d.getMonth() + months, 1)
  return formatDate(d)
}

export const monthGridDates = (monthFirst: string): string[] => {
  const first = weekStart(monthStart(monthFirst))
  return Array.from({ length: 42 }, (_, index) => addDays(first, index))
}
