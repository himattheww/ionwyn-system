import { addDays, toHHmm, toMinutes } from '../../../core/src'
import type { Item, Slot } from '../../../core/src'

export const newId = () => crypto.randomUUID()

export const durationLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} mnt`
  return m === 0 ? `${h} j` : `${h} j ${m} mnt`
}

export const timeRange = (item: Pick<Item, 'startTime' | 'durationMin'>) => {
  if (item.startTime === null) return 'kapan saja'
  return `${item.startTime}–${toHHmm(toMinutes(item.startTime) + item.durationMin)}`
}

const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export const relativeLabel = (date: string, today: string) => {
  if (date === today) return 'Hari ini'
  if (date === addDays(today, 1)) return 'Besok'
  if (date === addDays(today, -1)) return 'Kemarin'
  return null
}

export const dateLabel = (date: string, today: string) => {
  const relative = relativeLabel(date, today)
  if (relative) return relative
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return `${dayNames[new Date(y, m - 1, d).getDay()]}, ${d}/${m}`
}

export const slotLabel = (slot: Slot, today: string) =>
  `${dateLabel(slot.date, today)}${slot.startTime ? ` ${slot.startTime}` : ' (kapan saja)'}`

const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]

export const longDateLabel = (date: string) => {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return `${dayNames[new Date(y, m - 1, d).getDay()]}, ${d} ${monthNames[m - 1]}`
}

export const monthLabel = (monthFirst: string) => {
  const [y = 0, m = 1] = monthFirst.split('-').map(Number)
  return `${monthNames[m - 1]} ${y}`
}
