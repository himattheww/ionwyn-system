export const modules = ['umum', 'kesehatan', 'belajar', 'keuangan', 'kerja'] as const

export type Module = (typeof modules)[number]
export type Kind = 'fixed' | 'flexible'
export type Status = 'terencana' | 'selesai' | 'dilewati' | 'digeser'

export interface Item {
  id: string
  title: string
  module: Module
  kind: Kind
  date: string
  startTime: string | null
  durationMin: number
  status: Status
  rescheduleCount: number
  rescheduledFromId: string | null
  routineId: string | null
  activityType: string | null
  remindedAt: string | null
  askedAt: string | null
  reaskedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface ActivityLog {
  id: string
  module: Module
  type: string
  occurredAt: string
  endedAt: string | null
  value: number | null
  unit: string | null
  note: string | null
  meta: Record<string, unknown>
  itemId: string | null
}

export interface RoutineTemplate {
  id: string
  weekday: number
  title: string
  module: Module
  kind: Kind
  startTime: string | null
  durationMin: number
  activityType: string | null
  active: boolean
}

export interface Slot {
  date: string
  startTime: string | null
}

export interface PlannerSettings {
  quietStart: string
  quietEnd: string
  slotBufferMin: number
  minLeadMin: number
  maxFreeShifts: number
  remindBeforeMin: number
  morningSummary: string
  eveningSummary: string
}

export const defaultSettings: PlannerSettings = {
  quietStart: '22:00',
  quietEnd: '04:00',
  slotBufferMin: 10,
  minLeadMin: 30,
  maxFreeShifts: 2,
  remindBeforeMin: 10,
  morningSummary: '04:30',
  eveningSummary: '20:30',
}
