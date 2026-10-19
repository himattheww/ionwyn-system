import type { SourceEvent } from '../types.ts'

export interface TimesheetDay {
  date: string
  hadir: string
  start: number | null
  end: number | null
}

interface MonthReply {
  error?: string
  today: string
  month: { days: TimesheetDay[] }
}

export function timesheetEvents(days: TimesheetDay[]): SourceEvent[] {
  return days.flatMap(day => {
    if (day.hadir !== 'Y' || day.start === null || day.end === null) return []
    return [{ id: `timesheet:day:${day.date}`, source: 'timesheet', type: 'workday', date: day.date, value: 1, meta: {} }]
  })
}

const pastMonths = new Map<string, TimesheetDay[]>()

async function readMonth(url: string, apiKey: string, month: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'month', date: `${month}-01`, apiKey }),
    signal: AbortSignal.timeout(30_000)
  })
  if (!response.ok) throw new Error(`Apps Script membalas ${response.status}`)
  const body = (await response.json()) as MonthReply
  if (body.error) throw new Error(`Apps Script: ${body.error}`)
  return body
}

const previousMonth = (month: string) => {
  const [year, m] = month.split('-').map(Number)
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`
}

export async function readTimesheet(url: string | undefined, apiKey: string | undefined, today: string) {
  if (!url || !apiKey) throw new Error('TIMESHEET_API_URL atau TIMESHEET_API_KEY belum diisi')
  const current = await readMonth(url, apiKey, today.slice(0, 7))
  const days = [...current.month.days]
  let month = previousMonth(today.slice(0, 7))
  for (let i = 0; i < 36; i++, month = previousMonth(month)) {
    if (!pastMonths.has(month)) {
      try {
        pastMonths.set(month, (await readMonth(url, apiKey, month)).month.days)
      } catch (error) {
        if (error instanceof Error && error.message.includes('belum ada')) break
        throw error
      }
    }
    days.push(...pastMonths.get(month)!)
  }
  return timesheetEvents(days)
}
