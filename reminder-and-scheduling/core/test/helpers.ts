import type { ActivityLog, Item, RoutineTemplate } from '../src'

export const sequence = () => {
  let n = 0
  return () => `id-${++n}`
}

export const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 'i1',
  title: 'lari',
  module: 'kesehatan',
  kind: 'flexible',
  date: '2026-10-14',
  startTime: '06:00',
  durationMin: 45,
  status: 'terencana',
  rescheduleCount: 0,
  rescheduledFromId: null,
  routineId: null,
  activityType: null,
  remindedAt: null,
  askedAt: null,
  reaskedAt: null,
  completedAt: null,
  createdAt: '2026-10-13T20:00:00.000Z',
  ...overrides,
})

export const makeTemplate = (overrides: Partial<RoutineTemplate> = {}): RoutineTemplate => ({
  id: 't1',
  weekday: 1,
  title: 'lari',
  module: 'kesehatan',
  kind: 'flexible',
  startTime: '06:00',
  durationMin: 45,
  activityType: 'run_done',
  active: true,
  ...overrides,
})

export const makeLog = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 'l1',
  module: 'kerja',
  type: 'idle',
  occurredAt: '2026-10-14T03:00:00.000Z',
  endedAt: null,
  value: null,
  unit: null,
  note: null,
  meta: {},
  itemId: null,
  ...overrides,
})
