const pad = (n: number) => String(n).padStart(2, '0')

const toDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const today = () => toDate(new Date())

export function currentWeek() {
  const start = new Date()
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: toDate(start), end: toDate(end) }
}
