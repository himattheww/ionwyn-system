import type { ActivityLog, Item, Kind, Module, PlannerSettings, RoutineTemplate, Status } from '../../core/src'

export interface ItemRow {
  id: string
  title: string
  module: Module
  kind: Kind
  date: string
  start_time: string | null
  duration_min: number
  status: Status
  reschedule_count: number
  rescheduled_from_id: string | null
  routine_id: string | null
  activity_type: string | null
  reminded_at: string | null
  asked_at: string | null
  reasked_at: string | null
  completed_at: string | null
  created_at: string
}

export interface LogRow {
  id: string
  module: Module
  type: string
  occurred_at: string
  ended_at: string | null
  value: number | null
  unit: string | null
  note: string | null
  meta: Record<string, unknown>
  item_id: string | null
}

export interface TemplateRow {
  id: string
  weekday: number
  title: string
  module: Module
  kind: Kind
  start_time: string | null
  duration_min: number
  activity_type: string | null
  active: boolean
}

export interface SettingsRow {
  quiet_start: string
  quiet_end: string
  slot_buffer_min: number
  min_lead_min: number
  max_free_shifts: number
  remind_before_min: number
  morning_summary: string
  evening_summary: string
}

const hhmm = (value: string | null) => (value === null ? null : value.slice(0, 5))

const iso = (value: string | null) => (value === null ? null : new Date(value).toISOString())

export const itemToRow = (item: Item): ItemRow => ({
  id: item.id,
  title: item.title,
  module: item.module,
  kind: item.kind,
  date: item.date,
  start_time: item.startTime,
  duration_min: item.durationMin,
  status: item.status,
  reschedule_count: item.rescheduleCount,
  rescheduled_from_id: item.rescheduledFromId,
  routine_id: item.routineId,
  activity_type: item.activityType,
  reminded_at: item.remindedAt,
  asked_at: item.askedAt,
  reasked_at: item.reaskedAt,
  completed_at: item.completedAt,
  created_at: item.createdAt,
})

export const itemFromRow = (row: ItemRow): Item => ({
  id: row.id,
  title: row.title,
  module: row.module,
  kind: row.kind,
  date: row.date,
  startTime: hhmm(row.start_time),
  durationMin: row.duration_min,
  status: row.status,
  rescheduleCount: row.reschedule_count,
  rescheduledFromId: row.rescheduled_from_id,
  routineId: row.routine_id,
  activityType: row.activity_type,
  remindedAt: iso(row.reminded_at),
  askedAt: iso(row.asked_at),
  reaskedAt: iso(row.reasked_at),
  completedAt: iso(row.completed_at),
  createdAt: new Date(row.created_at).toISOString(),
})

export const logToRow = (log: ActivityLog): LogRow => ({
  id: log.id,
  module: log.module,
  type: log.type,
  occurred_at: log.occurredAt,
  ended_at: log.endedAt,
  value: log.value,
  unit: log.unit,
  note: log.note,
  meta: log.meta,
  item_id: log.itemId,
})

export const logFromRow = (row: LogRow): ActivityLog => ({
  id: row.id,
  module: row.module,
  type: row.type,
  occurredAt: new Date(row.occurred_at).toISOString(),
  endedAt: iso(row.ended_at),
  value: row.value === null ? null : Number(row.value),
  unit: row.unit,
  note: row.note,
  meta: row.meta,
  itemId: row.item_id,
})

export const templateToRow = (template: RoutineTemplate): TemplateRow => ({
  id: template.id,
  weekday: template.weekday,
  title: template.title,
  module: template.module,
  kind: template.kind,
  start_time: template.startTime,
  duration_min: template.durationMin,
  activity_type: template.activityType,
  active: template.active,
})

export const templateFromRow = (row: TemplateRow): RoutineTemplate => ({
  id: row.id,
  weekday: row.weekday,
  title: row.title,
  module: row.module,
  kind: row.kind,
  startTime: hhmm(row.start_time),
  durationMin: row.duration_min,
  activityType: row.activity_type,
  active: row.active,
})

export const settingsFromRow = (row: SettingsRow): PlannerSettings => ({
  quietStart: row.quiet_start.slice(0, 5),
  quietEnd: row.quiet_end.slice(0, 5),
  slotBufferMin: row.slot_buffer_min,
  minLeadMin: row.min_lead_min,
  maxFreeShifts: row.max_free_shifts,
  remindBeforeMin: row.remind_before_min,
  morningSummary: row.morning_summary.slice(0, 5),
  eveningSummary: row.evening_summary.slice(0, 5),
})

export const settingsToRow = (settings: PlannerSettings): SettingsRow => ({
  quiet_start: settings.quietStart,
  quiet_end: settings.quietEnd,
  slot_buffer_min: settings.slotBufferMin,
  min_lead_min: settings.minLeadMin,
  max_free_shifts: settings.maxFreeShifts,
  remind_before_min: settings.remindBeforeMin,
  morning_summary: settings.morningSummary,
  evening_summary: settings.eveningSummary,
})
