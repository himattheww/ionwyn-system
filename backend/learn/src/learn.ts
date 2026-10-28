import type { z } from 'zod'
import { db, NotFoundError, unwrap } from './db.js'
import type { topicInput, topicUpdate, trackInput } from './schemas.js'
import { keepReachable } from './urlCheck.js'
import { currentWeek, today } from './week.js'

const doneStatuses = ['selesai', 'sudah_bisa']
const isDone = (status: string) => doneStatuses.includes(status)

type TopicRow = {
  id: number
  order: number
  title: string
  objective: string
  status: string
  est_sessions: number
  prerequisites: string[]
  sources: { title: string; url: string }[]
  summary: string | null
  exercise: { type: 'code' | 'praktik' } | null
  completed_at: string | null
}

async function minutesThisWeek(trackId?: number) {
  const week = currentWeek()
  let query = db.from('learning_sessions').select('track_id, duration_min').gte('occurred_at', week.start).lte('occurred_at', week.end)
  if (trackId) query = query.eq('track_id', trackId)
  const totals = new Map<number, number>()
  for (const r of unwrap(await query)) totals.set(r.track_id, (totals.get(r.track_id) ?? 0) + r.duration_min)
  return totals
}

export async function listTracks() {
  const rows = unwrap(
    await db.from('tracks').select('id, goal, kind, current_level, hours_per_week, status, created_at, topics(status)').order('created_at', { ascending: false }),
  )
  const minutes = await minutesThisWeek()
  return rows.map((t) => ({
    id: t.id,
    goal: t.goal,
    kind: t.kind,
    currentLevel: t.current_level,
    hoursPerWeek: t.hours_per_week,
    status: t.status,
    topicCount: t.topics.length,
    topicsDone: t.topics.filter((x: { status: string }) => isDone(x.status)).length,
    minutesThisWeek: minutes.get(t.id) ?? 0,
  }))
}

export async function trackDetail(id: number) {
  const track = unwrap(
    await db
      .from('tracks')
      .select('*, topics(id, order, title, objective, status, est_sessions, prerequisites, summary, exercise, completed_at)')
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
  return {
    id: track.id,
    goal: track.goal,
    kind: track.kind,
    currentLevel: track.current_level,
    hoursPerWeek: track.hours_per_week,
    status: track.status,
    createdAt: track.created_at,
    minutesThisWeek: minutes.get(id) ?? 0,
    topics: (track.topics as TopicRow[]).map((t) => ({
      id: t.id,
      order: t.order,
      title: t.title,
      objective: t.objective,
      status: t.status,
      estSessions: t.est_sessions,
      prerequisites: t.prerequisites,
      hasContent: Boolean(t.summary && t.exercise),
      exerciseType: t.exercise?.type ?? null,
      completedAt: t.completed_at,
    })),
    sessions: sessions.map((s: any) => ({
      id: s.id,
      topicId: s.topic_id,
      topicTitle: s.topics?.title ?? null,
      occurredAt: s.occurred_at,
      durationMin: s.duration_min,
      summary: s.summary,
    })),
  }
}

async function nextTopic(trackId: number, afterId: number) {
  const topics = unwrap(await db.from('topics').select('id, title, status').eq('track_id', trackId).order('order'))
  const next = topics.find((t) => t.id !== afterId && !isDone(t.status))
  return next ? { id: next.id, title: next.title } : null
}

export async function topicDetail(id: number) {
  const t = unwrap(await db.from('topics').select('*, tracks(id, goal, kind)').eq('id', id).maybeSingle())
  const { data: attempt, error } = await db
    .from('topic_attempts')
    .select('score, total, passed, code, created_at')
    .eq('topic_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return {
    id: t.id,
    order: t.order,
    title: t.title,
    objective: t.objective,
    status: t.status,
    estSessions: t.est_sessions,
    prerequisites: t.prerequisites,
    sources: t.sources,
    summary: t.summary,
    exercise: t.exercise,
    completedAt: t.completed_at,
    track: { id: t.tracks.id, goal: t.tracks.goal, kind: t.tracks.kind },
    lastAttempt: attempt
      ? { score: attempt.score, total: attempt.total, passed: attempt.passed, code: attempt.code, createdAt: attempt.created_at }
      : null,
    nextTopic: await nextTopic(t.track_id, t.id),
  }
}

export async function saveCodeAttempt(id: number, code: string, results: { passed: number; total: number }) {
  unwrap(await db.from('topics').select('id').eq('id', id).maybeSingle())
  const passed = results.passed === results.total
  unwrap(
    await db
      .from('topic_attempts')
      .insert({ topic_id: id, kind: 'code', score: results.passed, total: results.total, passed, code })
      .select('id')
      .single(),
  )
  return { passed }
}

export async function completeTopic(id: number, durationMin: number) {
  const t = unwrap(await db.from('topics').select('id, track_id, title, status').eq('id', id).maybeSingle())
  if (t.status !== 'selesai') {
    unwrap(await db.from('topics').update({ status: 'selesai', completed_at: new Date().toISOString() }).eq('id', id).select('id').single())
    unwrap(
      await db
        .from('learning_sessions')
        .insert({ track_id: t.track_id, topic_id: id, occurred_at: today(), duration_min: durationMin, summary: `Selesai: ${t.title}`.slice(0, 200) })
        .select('id')
        .single(),
    )
  }
  const remaining = unwrap(await db.from('topics').select('status').eq('track_id', t.track_id)).filter((x) => !isDone(x.status))
  if (!remaining.length) unwrap(await db.from('tracks').update({ status: 'selesai' }).eq('id', t.track_id).select('id').single())
  return { trackDone: remaining.length === 0, nextTopic: await nextTopic(t.track_id, id) }
}

export async function logSession(id: number, durationMin: number) {
  const t = unwrap(await db.from('topics').select('id, track_id, title').eq('id', id).maybeSingle())
  unwrap(
    await db
      .from('learning_sessions')
      .insert({ track_id: t.track_id, topic_id: id, occurred_at: today(), duration_min: durationMin, summary: `Belajar: ${t.title}`.slice(0, 200) })
      .select('id')
      .single(),
  )
  return { durationMin }
}

export async function setTrackStatus(id: number, status: string) {
  unwrap(await db.from('tracks').update({ status }).eq('id', id).select('id').maybeSingle())
}

export async function deleteTrack(id: number) {
  const deleted = unwrap(await db.from('tracks').delete().eq('id', id).select('id').maybeSingle())
  if (!deleted) throw new NotFoundError('Jalur tidak ditemukan')
}

async function topicRows(trackId: number, startOrder: number, topics: z.infer<typeof topicInput>[]) {
  return Promise.all(
    topics.map(async (t, i) => ({
      track_id: trackId,
      order: startOrder + i,
      title: t.title,
      objective: t.objective,
      status: 'belum',
      est_sessions: t.estSessions,
      prerequisites: t.prerequisites,
      sources: await keepReachable(t.sources),
      summary: t.summary,
      exercise: t.exercise,
    })),
  )
}

export async function createTrack(input: z.infer<typeof trackInput>) {
  const track = unwrap(
    await db
      .from('tracks')
      .insert({ goal: input.goal, kind: input.kind, current_level: input.currentLevel, hours_per_week: input.hoursPerWeek })
      .select('id')
      .single(),
  )
  try {
    unwrap(await db.from('topics').insert(await topicRows(track.id, 1, input.topics)).select('id'))
  } catch (error) {
    await db.from('tracks').delete().eq('id', track.id)
    throw error
  }
  return track.id as number
}

export async function addTopics(trackId: number, topics: z.infer<typeof topicInput>[]) {
  unwrap(await db.from('tracks').select('id').eq('id', trackId).maybeSingle())
  const { data: last, error } = await db.from('topics').select('order').eq('track_id', trackId).order('order', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  const rows = unwrap(await db.from('topics').insert(await topicRows(trackId, (last?.order ?? 0) + 1, topics)).select('id'))
  await db.from('tracks').update({ status: 'aktif' }).eq('id', trackId).eq('status', 'selesai')
  return rows.map((r) => r.id as number)
}

export async function updateTopic(id: number, patch: z.infer<typeof topicUpdate>) {
  const row: Record<string, unknown> = {}
  if (patch.title) row.title = patch.title
  if (patch.objective) row.objective = patch.objective
  if (patch.summary) row.summary = patch.summary
  if (patch.exercise) row.exercise = patch.exercise
  if (patch.sources) row.sources = await keepReachable(patch.sources)
  if (!Object.keys(row).length) return
  unwrap(await db.from('topics').update(row).eq('id', id).select('id').maybeSingle())
}

export async function learningProgress() {
  const tracks = await listTracks()
  const recent = unwrap(
    await db
      .from('topics')
      .select('title, completed_at, tracks(goal)')
      .eq('status', 'selesai')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(15),
  )
  const week = await minutesThisWeek()
  return {
    tracks: tracks.map((t) => ({ id: t.id, goal: t.goal, kind: t.kind, status: t.status, topicsDone: t.topicsDone, topicCount: t.topicCount })),
    recentlyCompleted: recent.map((r: any) => ({ topic: r.title, track: r.tracks?.goal ?? null, at: r.completed_at })),
    minutesThisWeek: [...week.values()].reduce((a, b) => a + b, 0),
  }
}
