import type { Item, PlannerSettings } from './types'
import { defaultSettings } from './types'
import { formatDate, minutesOfDay, toMinutes } from './time'
import { freeGaps } from './slots'
import type { Gap } from './slots'

export interface DayView {
  date: string
  timed: Item[]
  anytime: Item[]
  gaps: Gap[]
}

export const buildDay = (
  items: Item[],
  date: string,
  settings: PlannerSettings = defaultSettings,
): DayView => {
  const visible = items.filter((item) => item.date === date && item.status !== 'digeser')
  return {
    date,
    timed: visible
      .filter((item) => item.startTime !== null)
      .sort((a, b) => (a.startTime as string).localeCompare(b.startTime as string)),
    anytime: visible
      .filter((item) => item.startTime === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    gaps: freeGaps(items, date, settings),
  }
}

export const unanswered = (items: Item[], now: Date): Item[] => {
  const today = formatDate(now)
  const minutes = minutesOfDay(now)
  return items.filter((item) => {
    if (item.status !== 'terencana') return false
    if (item.date < today) return true
    if (item.date > today || item.startTime === null) return false
    return toMinutes(item.startTime) + item.durationMin <= minutes
  })
}
