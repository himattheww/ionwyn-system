import { describe, expect, it } from 'vitest'
import { makeItem, makeLog, makeTemplate } from '../../core/test/helpers'
import {
  itemFromRow,
  itemToRow,
  logFromRow,
  logToRow,
  settingsFromRow,
  settingsToRow,
  templateFromRow,
  templateToRow,
} from './rows'

describe('rows', () => {
  it('item bolak-balik tanpa kehilangan data', () => {
    const item = makeItem({ routineId: 'r', rescheduledFromId: 'p', rescheduleCount: 2, activityType: 'run_done' })
    expect(itemFromRow(itemToRow(item))).toEqual(item)
  })

  it('jam dari Postgres (HH:MM:SS) dipotong ke HH:mm', () => {
    const row = { ...itemToRow(makeItem()), start_time: '06:00:00' }
    expect(itemFromRow(row).startTime).toBe('06:00')
    expect(itemFromRow({ ...row, start_time: null }).startTime).toBeNull()
  })

  it('timestamp Postgres (+00:00) dinormalkan ke ISO Z', () => {
    const item = makeItem({ createdAt: '2099-01-04T22:00:00.000Z', completedAt: '2099-01-05T06:00:00.000Z' })
    const row = {
      ...itemToRow(item),
      created_at: '2099-01-04T22:00:00+00:00',
      completed_at: '2099-01-05T06:00:00+00:00',
    }
    expect(itemFromRow(row)).toEqual(item)
    const log = makeLog({ occurredAt: '2099-01-05T05:00:00.000Z', endedAt: '2099-01-05T05:25:00.000Z' })
    const logRow = { ...logToRow(log), occurred_at: '2099-01-05T05:00:00+00:00', ended_at: '2099-01-05T05:25:00+00:00' }
    expect(logFromRow(logRow)).toEqual(log)
  })

  it('log bolak-balik dan numeric string jadi number', () => {
    const log = makeLog({ value: 85, unit: 'min', meta: { a: 1 } })
    expect(logFromRow(logToRow(log))).toEqual(log)
    expect(logFromRow({ ...logToRow(log), value: '85.5' as unknown as number }).value).toBe(85.5)
  })

  it('settings bolak-balik', () => {
    const row = settingsToRow({
      quietStart: '23:00',
      quietEnd: '05:00',
      slotBufferMin: 5,
      minLeadMin: 15,
      maxFreeShifts: 3,
      remindBeforeMin: 20,
      morningSummary: '05:00',
      eveningSummary: '21:00',
    })
    expect(settingsFromRow(row).maxFreeShifts).toBe(3)
    expect(settingsFromRow(row).eveningSummary).toBe('21:00')
  })

  it('template bolak-balik', () => {
    const template = makeTemplate()
    expect(templateFromRow(templateToRow(template))).toEqual(template)
  })

  it('settings dipotong ke HH:mm', () => {
    expect(
      settingsFromRow({
        quiet_start: '22:00:00',
        quiet_end: '04:00:00',
        slot_buffer_min: 10,
        min_lead_min: 30,
        max_free_shifts: 2,
        remind_before_min: 10,
        morning_summary: '04:30:00',
        evening_summary: '20:30:00',
      }),
    ).toEqual({
      quietStart: '22:00',
      quietEnd: '04:00',
      slotBufferMin: 10,
      minLeadMin: 30,
      maxFreeShifts: 2,
      remindBeforeMin: 10,
      morningSummary: '04:30',
      eveningSummary: '20:30',
    })
  })
})
