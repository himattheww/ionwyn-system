import type { ActivityLog, Item, PlannerSettings, Slot } from './types'
import { defaultSettings } from './types'
import { isDate, isTime } from './time'

const requirePlanned = (item: Item) => {
  if (item.status !== 'terencana') throw new Error(`item sudah ${item.status}`)
}

export const completeItem = (
  item: Item,
  now: Date,
  newId: () => string,
): { item: Item; log: ActivityLog } => {
  requirePlanned(item)
  const stamp = now.toISOString()
  return {
    item: { ...item, status: 'selesai', completedAt: stamp },
    log: {
      id: newId(),
      module: item.module,
      type: item.activityType ?? 'task_done',
      occurredAt: stamp,
      endedAt: null,
      value: item.durationMin,
      unit: 'min',
      note: null,
      meta: { title: item.title, plannedDate: item.date },
      itemId: item.id,
    },
  }
}

export const skipItem = (item: Item): Item => {
  requirePlanned(item)
  return { ...item, status: 'dilewati' }
}

export const needsShiftDecision = (item: Item, settings: PlannerSettings = defaultSettings) =>
  item.rescheduleCount >= settings.maxFreeShifts

export const shiftItem = (
  item: Item,
  slot: Slot,
  now: Date,
  newId: () => string,
): { original: Item; next: Item } => {
  requirePlanned(item)
  if (item.kind !== 'flexible') throw new Error('hanya item flexible yang boleh digeser')
  if (!isDate(slot.date)) throw new Error('tanggal slot tidak valid')
  if (slot.startTime !== null && !isTime(slot.startTime)) throw new Error('jam slot tidak valid')
  if (slot.date === item.date && slot.startTime === item.startTime) {
    throw new Error('slot sama dengan jadwal sekarang')
  }

  return {
    original: { ...item, status: 'digeser' },
    next: {
      ...item,
      id: newId(),
      date: slot.date,
      startTime: slot.startTime,
      status: 'terencana',
      rescheduleCount: item.rescheduleCount + 1,
      rescheduledFromId: item.id,
      remindedAt: null,
      askedAt: null,
      reaskedAt: null,
      completedAt: null,
      createdAt: now.toISOString(),
    },
  }
}

export const splitItem = (
  item: Item,
  parts: { title: string; durationMin: number }[],
  date: string,
  now: Date,
  newId: () => string,
): { original: Item; parts: Item[] } => {
  requirePlanned(item)
  if (item.kind !== 'flexible') throw new Error('hanya item flexible yang boleh dipecah')
  if (parts.length < 2) throw new Error('pecahan minimal dua item')
  if (!isDate(date)) throw new Error('tanggal tidak valid')

  return {
    original: { ...item, status: 'digeser' },
    parts: parts.map((part) => {
      if (!part.title.trim() || !Number.isInteger(part.durationMin) || part.durationMin <= 0) {
        throw new Error('pecahan butuh judul dan durasi positif')
      }
      return {
        ...item,
        id: newId(),
        title: part.title.trim(),
        durationMin: part.durationMin,
        date,
        startTime: null,
        status: 'terencana',
        rescheduleCount: 0,
        rescheduledFromId: item.id,
        remindedAt: null,
        askedAt: null,
        reaskedAt: null,
        completedAt: null,
        createdAt: now.toISOString(),
      }
    }),
  }
}
