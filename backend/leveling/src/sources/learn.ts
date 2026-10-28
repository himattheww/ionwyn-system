import { toDate } from '../dates.ts'
import type { Rules } from '../rules.ts'
import type { SourceEvent } from '../types.ts'

export interface LearnData {
  tracks: { id: number; goal: string; created_at: string }[]
  topics: { id: number; track_id: number; title: string; status: string }[]
  study_cases: { id: number; topic_id: number; title: string; status: string; created_at: string }[]
  learning_sessions: { id: number; track_id: number; topic_id: number | null; occurred_at: string; duration_min: number }[]
}

export function learnEvents(data: LearnData, rules: Rules): SourceEvent[] {
  const trackById = new Map(data.tracks.map(t => [String(t.id), t]))
  const topicById = new Map(data.topics.map(t => [String(t.id), t]))
  const lastSessionByTopic = new Map<string, string>()
  const trackMeta = (trackId: number) => {
    const id = String(trackId)
    return { trackId: id, trackName: trackById.get(id)?.goal ?? `Jalur ${id}`, category: rules.intelek.trackCategories[id] ?? 'lainnya' }
  }

  const events: SourceEvent[] = []
  for (const session of data.learning_sessions) {
    const date = toDate(session.occurred_at)
    if (!date) continue
    if (session.topic_id !== null) {
      const key = String(session.topic_id)
      if ((lastSessionByTopic.get(key) ?? '') < date) lastSessionByTopic.set(key, date)
    }
    events.push({ id: `learn:session:${session.id}`, source: 'learn', type: 'session', date, value: session.duration_min, meta: trackMeta(session.track_id) })
  }

  const isDone = (status: string, allowed: string[]) => allowed.map(s => s.toLowerCase()).includes(status.toLowerCase())

  for (const topic of data.topics) {
    if (!isDone(topic.status, rules.intelek.doneStatuses.topic)) continue
    const date = lastSessionByTopic.get(String(topic.id)) ?? toDate(trackById.get(String(topic.track_id))?.created_at)
    if (!date) continue
    events.push({ id: `learn:topic:${topic.id}`, source: 'learn', type: 'topic_done', date, value: 1, meta: { ...trackMeta(topic.track_id), title: topic.title } })
  }

  for (const studyCase of data.study_cases) {
    if (!isDone(studyCase.status, rules.intelek.doneStatuses.studyCase)) continue
    const topic = topicById.get(String(studyCase.topic_id))
    const date = lastSessionByTopic.get(String(studyCase.topic_id)) ?? toDate(studyCase.created_at)
    if (!date || !topic) continue
    events.push({ id: `learn:case:${studyCase.id}`, source: 'learn', type: 'case_done', date, value: 1, meta: { ...trackMeta(topic.track_id), title: studyCase.title } })
  }
  return events
}

export async function readLearn(apiUrl: string | undefined, rules: Rules) {
  if (!apiUrl) throw new Error('LEARN_API_URL belum diisi')
  let response: Response
  try {
    const headers = process.env.INTERNAL_SECRET ? { 'x-ionwyn-internal': process.env.INTERNAL_SECRET } : undefined
    response = await fetch(`${apiUrl}/api/export`, { headers, signal: AbortSignal.timeout(20_000) })
  } catch {
    throw new Error(`Learn tidak bisa dihubungi di ${apiUrl}`)
  }
  if (!response.ok) throw new Error(`Learn membalas ${response.status}`)
  return learnEvents((await response.json()) as LearnData, rules)
}
