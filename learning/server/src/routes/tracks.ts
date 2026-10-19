import { Router } from 'express'
import { ai } from '../ai.js'
import { db, unwrap } from '../db.js'
import { idParam, planRequest, saveTrackRequest, trackStatusRequest } from '../schemas.js'
import { keepReachable } from '../urlCheck.js'
import { currentWeek } from '../week.js'

export const tracks = Router()

const doneStatuses = ['selesai', 'sudah_bisa']

async function minutesThisWeek(trackId?: number) {
  const week = currentWeek()
  let query = db.from('learning_sessions').select('track_id, duration_min').gte('occurred_at', week.start).lte('occurred_at', week.end)
  if (trackId) query = query.eq('track_id', trackId)
  const rows = unwrap(await query)
  const totals = new Map<number, number>()
  for (const r of rows) totals.set(r.track_id, (totals.get(r.track_id) ?? 0) + r.duration_min)
  return totals
}

tracks.get('/', async (_req, res) => {
  const rows = unwrap(
    await db
      .from('tracks')
      .select('id, goal, current_level, hours_per_week, status, created_at, topics(status)')
      .order('created_at', { ascending: false }),
  )
  const minutes = await minutesThisWeek()
  res.json(
    rows.map((t) => ({
      id: t.id,
      goal: t.goal,
      currentLevel: t.current_level,
      hoursPerWeek: t.hours_per_week,
      status: t.status,
      topicCount: t.topics.length,
      topicsDone: t.topics.filter((x) => doneStatuses.includes(x.status)).length,
      minutesThisWeek: minutes.get(t.id) ?? 0,
    })),
  )
})

tracks.post('/plan', async (req, res) => {
  const input = planRequest.parse(req.body)
  const topics = await ai.planTopics(input)
  const titles = new Set(topics.map((t) => t.title))
  const checked = await Promise.all(
    topics.map(async (t) => ({
      title: t.title,
      objective: t.objective,
      estSessions: t.estSessions,
      prerequisites: t.prerequisites.filter((p) => titles.has(p)),
      sources: await keepReachable(t.sources),
    })),
  )
  res.json({ topics: checked })
})

tracks.post('/', async (req, res) => {
  const { topics, ...track } = saveTrackRequest.parse(req.body)
  const id = unwrap(await db.rpc('create_track', { track, topic_list: topics }))
  res.status(201).json({ id })
})

tracks.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const track = unwrap(
    await db
      .from('tracks')
      .select('*, topics(id, order, title, objective, status, est_sessions, study_cases(status, difficulty))')
      .eq('id', id)
      .order('order', { referencedTable: 'topics' })
      .maybeSingle(),
  )
  const sessions = unwrap(
    await db
      .from('learning_sessions')
      .select('id, topic_id, occurred_at, duration_min, summary, topics(title)')
      .eq('track_id', id)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(100),
  )
  const minutes = await minutesThisWeek(id)

  res.json({
    id: track.id,
    goal: track.goal,
    currentLevel: track.current_level,
    hoursPerWeek: track.hours_per_week,
    domainHint: track.domain_hint,
    status: track.status,
    createdAt: track.created_at,
    minutesThisWeek: minutes.get(id) ?? 0,
    topics: track.topics.map((t: any) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      objective: t.objective,
      status: t.status,
      estSessions: t.est_sessions,
      studyCase: t.study_cases ? { status: t.study_cases.status, difficulty: t.study_cases.difficulty } : null,
    })),
    sessions: sessions.map((s: any) => ({
      id: s.id,
      topicId: s.topic_id,
      topicTitle: s.topics?.title ?? null,
      occurredAt: s.occurred_at,
      durationMin: s.duration_min,
      summary: s.summary,
    })),
  })
})

tracks.patch('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { status } = trackStatusRequest.parse(req.body)
  unwrap(await db.from('tracks').update({ status }).eq('id', id).select('id').maybeSingle())
  res.status(204).end()
})
