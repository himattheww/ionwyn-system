import type { Item, Kind, Module, RoutineTemplate } from './types'
import { createItem } from './item'
import { addDays, diffDays, isTime, toMinutes, weekStart } from './time'

export interface NewTemplateInput {
  weekday: number
  title: string
  kind: Kind
  durationMin: number
  module?: Module
  startTime?: string | null
  activityType?: string | null
}

export const createTemplate = (input: NewTemplateInput, newId: () => string): RoutineTemplate => {
  const title = input.title.trim()
  const startTime = input.startTime ?? null

  if (!title) throw new Error('judul wajib diisi')
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
    throw new Error('hari tidak valid')
  }
  if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) {
    throw new Error('durasi harus bilangan bulat positif')
  }
  if (input.kind === 'fixed' && startTime === null) throw new Error('item fixed wajib punya jam')
  if (startTime !== null) {
    if (!isTime(startTime)) throw new Error('jam tidak valid')
    if (toMinutes(startTime) + input.durationMin > 1440) throw new Error('item melewati tengah malam')
  }

  return {
    id: newId(),
    weekday: input.weekday,
    title,
    module: input.module ?? 'umum',
    kind: input.kind,
    startTime,
    durationMin: input.durationMin,
    activityType: input.activityType ?? null,
    active: true,
  }
}

export const generateWeek = (
  templates: RoutineTemplate[],
  anyDateInWeek: string,
  existing: Item[],
  now: Date,
  newId: () => string,
): Item[] => {
  const start = weekStart(anyDateInWeek)
  const end = addDays(start, 6)
  const taken = new Set(
    existing
      .filter((item) => item.routineId !== null && item.date >= start && item.date <= end)
      .map((item) => item.routineId),
  )

  return templates
    .filter((t) => t.active && !taken.has(t.id))
    .map((t) =>
      createItem(
        {
          title: t.title,
          module: t.module,
          kind: t.kind,
          date: addDays(start, (t.weekday + 6) % 7),
          startTime: t.startTime,
          durationMin: t.durationMin,
          routineId: t.id,
          activityType: t.activityType,
        },
        newId,
        now,
      ),
    )
}

export const generateRange = (
  templates: RoutineTemplate[],
  startDate: string,
  weeks: number,
  existing: Item[],
  now: Date,
  newId: () => string,
  notBefore = '',
): Item[] => {
  const first = weekStart(startDate)
  const created: Item[] = []
  for (let index = 0; index < weeks; index += 1) {
    const week = addDays(first, index * 7)
    const batch = generateWeek(templates, week, [...existing, ...created], now, newId).filter(
      (item) => item.date >= notBefore,
    )
    created.push(...batch)
  }
  return created
}

export const copyWeek = (
  items: Item[],
  fromDate: string,
  toDate: string,
  now: Date,
  newId: () => string,
): Item[] => {
  const sourceStart = weekStart(fromDate)
  const sourceEnd = addDays(sourceStart, 6)
  const targetStart = weekStart(toDate)
  const targetEnd = addDays(targetStart, 6)
  const offset = diffDays(sourceStart, targetStart)
  const key = (item: Pick<Item, 'title' | 'date' | 'startTime'>) =>
    `${item.date}|${item.startTime ?? ''}|${item.title}`
  const taken = new Set(
    items.filter((i) => i.date >= targetStart && i.date <= targetEnd && i.status !== 'digeser').map(key),
  )

  return items
    .filter((i) => i.date >= sourceStart && i.date <= sourceEnd && i.status !== 'digeser')
    .map((i) => ({ ...i, date: addDays(i.date, offset) }))
    .filter((i) => !taken.has(key(i)))
    .map((i) =>
      createItem(
        {
          title: i.title,
          module: i.module,
          kind: i.kind,
          date: i.date,
          startTime: i.startTime,
          durationMin: i.durationMin,
          routineId: i.routineId,
          activityType: i.activityType,
        },
        newId,
        now,
      ),
    )
}
