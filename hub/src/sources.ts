import { config } from './config.ts'
import { fitKind, type Fact } from './match.ts'

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  } catch (error) {
    throw new Error(`Tidak bisa terhubung ke ${new URL(url).host}: ${error instanceof Error ? error.message : error}`)
  }
  if (!response.ok) throw new Error(`${new URL(url).pathname} membalas ${response.status}`)
  return (await response.json()) as T
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to
const localAt = (date: string, minutes = 12 * 60) => new Date(`${date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`)

interface Activity {
  garmin_id: number
  type: string
  start_time: string
  date: string
  duration_sec: number | null
  distance_m: number | null
}

export async function fitFacts(from: string, to: string): Promise<Fact[]> {
  const { activities } = await getJson<{ activities: Activity[] }>(`${config.apps.fit}/api/activities`)
  return activities.flatMap(a => {
    const kind = fitKind(a.type)
    if (!kind || !inRange(a.date, from, to)) return []
    const km = kind === 'run' && a.distance_m != null ? Math.round(a.distance_m / 10) / 100 : null
    return [
      {
        source: 'fit' as const,
        kind,
        ref: `fit:${a.garmin_id}`,
        date: a.date,
        at: new Date(a.start_time),
        value: km ?? (a.duration_sec != null ? Math.round(a.duration_sec / 60) : null),
        unit: km != null ? 'km' : 'min'
      }
    ]
  })
}

export interface LearnExport {
  tracks: { id: number; goal: string; hours_per_week: number; status: string; created_at: string }[]
  topics: { id: number; track_id: number; title: string; status: string }[]
  study_cases: { id: number; topic_id: number; title: string; status: string; created_at: string }[]
  learning_sessions: { id: number; track_id: number; topic_id: number | null; occurred_at: string; duration_min: number; summary: string }[]
}

export const learnExport = () => getJson<LearnExport>(`${config.apps.learn}/api/export`)

export async function learnFacts(from: string, to: string): Promise<Fact[]> {
  const { learning_sessions } = await learnExport()
  return learning_sessions
    .filter(s => inRange(s.occurred_at, from, to))
    .map(s => ({
      source: 'learn' as const,
      kind: 'learn' as const,
      ref: `learn:session:${s.id}`,
      date: s.occurred_at,
      at: localAt(s.occurred_at),
      trackId: String(s.track_id),
      value: s.duration_min,
      unit: 'min'
    }))
}

const monthsBetween = (from: string, to: string) => [...new Set([from.slice(0, 7), to.slice(0, 7)])]

export async function diaryFacts(from: string, to: string): Promise<Fact[]> {
  const lists = await Promise.all(
    monthsBetween(from, to).map(month => getJson<{ date: string }[]>(`${config.apps.catatan}/api/entries?month=${month}`))
  )
  const dates = lists.flat().map(e => e.date).filter(date => inRange(date, from, to))
  const entries = await Promise.all(
    dates.map(date => getJson<{ date: string; createdAt: string }>(`${config.apps.catatan}/api/entries/${date}`))
  )
  return entries.map(e => ({
    source: 'diary' as const,
    kind: 'diary' as const,
    ref: `diary:${e.date}`,
    date: e.date,
    at: new Date(e.createdAt),
    value: null,
    unit: null
  }))
}

export interface TimesheetDay {
  date: string
  holiday: boolean
  hadir: '' | 'Y' | 'N'
  start: number | null
  end: number | null
  worked: number | null
  note: string
}

export async function timesheetMonth(date: string) {
  const { url, key } = config.timesheet
  if (!url || !key) throw new Error('TIMESHEET_API_URL atau TIMESHEET_API_KEY belum diisi')
  const body = await getJson<{ error?: string; today: string; month: { days: TimesheetDay[] } }>(url, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'month', date, apiKey: key })
  })
  if (body.error) throw new Error(`Apps Script: ${body.error}`)
  return body
}

export async function workFacts(from: string, to: string): Promise<Fact[]> {
  const months = await Promise.all(monthsBetween(from, to).map(month => timesheetMonth(`${month}-01`)))
  return months
    .flatMap(m => m.month.days)
    .filter(d => d.hadir === 'Y' && d.start != null && inRange(d.date, from, to))
    .map(d => ({
      source: 'timesheet' as const,
      kind: 'work' as const,
      ref: `timesheet:${d.date}`,
      date: d.date,
      at: localAt(d.date, d.start!),
      value: d.worked,
      unit: 'min'
    }))
}
