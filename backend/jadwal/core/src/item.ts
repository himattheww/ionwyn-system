import type { Item, Kind, Module } from './types'
import { isDate, isTime, toMinutes } from './time'

export interface NewItemInput {
  title: string
  kind: Kind
  date: string
  durationMin: number
  module?: Module
  startTime?: string | null
  routineId?: string | null
  activityType?: string | null
}

export const createItem = (input: NewItemInput, newId: () => string, now: Date): Item => {
  const title = input.title.trim()
  const startTime = input.startTime ?? null

  if (!title) throw new Error('judul wajib diisi')
  if (!isDate(input.date)) throw new Error('tanggal tidak valid')
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
    title,
    module: input.module ?? 'umum',
    kind: input.kind,
    date: input.date,
    startTime,
    durationMin: input.durationMin,
    status: 'terencana',
    rescheduleCount: 0,
    rescheduledFromId: null,
    routineId: input.routineId ?? null,
    activityType: input.activityType ?? null,
    remindedAt: null,
    askedAt: null,
    reaskedAt: null,
    completedAt: null,
    createdAt: now.toISOString(),
  }
}
