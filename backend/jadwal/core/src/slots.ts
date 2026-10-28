import type { Item, PlannerSettings, Slot } from './types'
import { defaultSettings } from './types'
import { addDays, formatDate, minutesOfDay, toHHmm, toMinutes } from './time'

export interface Gap {
  start: number
  end: number
}

const occupies = (item: Item) =>
  item.startTime !== null && (item.status === 'terencana' || item.status === 'selesai')

const awakeWindow = (settings: PlannerSettings): Gap => {
  const quietStart = toMinutes(settings.quietStart)
  const quietEnd = toMinutes(settings.quietEnd)
  return quietStart > quietEnd ? { start: quietEnd, end: quietStart } : { start: 0, end: 1440 }
}

export const freeGaps = (
  items: Item[],
  date: string,
  settings: PlannerSettings = defaultSettings,
  padMin = 0,
): Gap[] => {
  const window = awakeWindow(settings)
  const busy = items
    .filter((item) => item.date === date && occupies(item))
    .map((item) => {
      const start = toMinutes(item.startTime as string)
      return { start: start - padMin, end: start + item.durationMin + padMin }
    })
    .sort((a, b) => a.start - b.start)

  const gaps: Gap[] = []
  let cursor = window.start
  for (const block of busy) {
    if (block.start > cursor) gaps.push({ start: cursor, end: Math.min(block.start, window.end) })
    cursor = Math.max(cursor, block.end)
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end })
  return gaps.filter((gap) => gap.end > gap.start)
}

const roundUp = (minutes: number, step: number) => Math.ceil(minutes / step) * step

const sameSlot = (a: Slot, b: Slot) => a.date === b.date && a.startTime === b.startTime

export const suggestSlots = (
  items: Item[],
  item: Item,
  now: Date,
  settings: PlannerSettings = defaultSettings,
  limit = 3,
): Slot[] => {
  const today = formatDate(now)

  if (item.startTime === null) {
    const base = item.date > today ? item.date : today
    return Array.from({ length: limit }, (_, i) => ({ date: addDays(base, i + 1), startTime: null }))
  }

  const others = items.filter((other) => other.id !== item.id)
  const need = item.durationMin
  const fits = (gap: Gap) => gap.end - gap.start >= need

  const todayGaps = freeGaps(others, today, settings, settings.slotBufferMin)
    .map((gap) => ({
      start: Math.max(gap.start, roundUp(minutesOfDay(now) + settings.minLeadMin, 5)),
      end: gap.end,
    }))
    .filter(fits)

  const tomorrow = addDays(today, 1)
  const tomorrowGaps = freeGaps(others, tomorrow, settings, settings.slotBufferMin).filter(fits)
  const original = toMinutes(item.startTime)
  const originalFits = tomorrowGaps.some((gap) => gap.start <= original && original + need <= gap.end)

  const candidates: Slot[] = []
  const first = todayGaps[0]
  const last = todayGaps[todayGaps.length - 1]
  if (first) candidates.push({ date: today, startTime: toHHmm(first.start) })
  if (last) candidates.push({ date: today, startTime: toHHmm(last.end - need) })
  if (originalFits) candidates.push({ date: tomorrow, startTime: item.startTime })
  else if (tomorrowGaps[0]) candidates.push({ date: tomorrow, startTime: toHHmm(tomorrowGaps[0].start) })
  const tomorrowLast = tomorrowGaps[tomorrowGaps.length - 1]
  if (tomorrowLast) candidates.push({ date: tomorrow, startTime: toHHmm(tomorrowLast.end - need) })

  return candidates
    .filter((slot, index) => candidates.findIndex((other) => sameSlot(other, slot)) === index)
    .filter((slot) => !(slot.date === item.date && slot.startTime === item.startTime))
    .slice(0, limit)
}
