import { Router } from 'express'
import { ai } from '../ai.js'
import { db, NotFoundError, unwrap } from '../db.js'
import { completeRequest, idParam, studyCaseRequest } from '../schemas.js'

export const topics = Router()

function toStudyCase(s: any) {
  return {
    id: s.id,
    title: s.title,
    scenario: s.scenario,
    requirements: s.requirements,
    acceptanceCriteria: s.acceptance_criteria,
    stretchGoals: s.stretch_goals,
    difficulty: s.difficulty,
    estSessions: s.est_sessions,
    status: s.status,
    resultLink: s.result_link,
    createdAt: s.created_at,
  }
}

async function loadTopic(id: number) {
  return unwrap(
    await db
      .from('topics')
      .select('*, tracks(id, goal, current_level, domain_hint), study_cases(*)')
      .eq('id', id)
      .maybeSingle(),
  )
}

topics.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const t = await loadTopic(id)
  res.json({
    id: t.id,
    order: t.order,
    title: t.title,
    objective: t.objective,
    status: t.status,
    estSessions: t.est_sessions,
    prerequisites: t.prerequisites,
    sources: t.sources,
    track: { id: t.tracks.id, goal: t.tracks.goal },
    studyCase: t.study_cases ? toStudyCase(t.study_cases) : null,
  })
})

topics.post('/:id/study-case', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { difficulty } = studyCaseRequest.parse(req.body)
  const t = await loadTopic(id)

  const generated = await ai.createStudyCase({
    goal: t.tracks.goal,
    topicTitle: t.title,
    topicObjective: t.objective,
    currentLevel: t.tracks.current_level,
    difficulty,
    domainHint: t.tracks.domain_hint,
  })

  const saved = unwrap(
    await db
      .from('study_cases')
      .upsert(
        {
          topic_id: id,
          title: generated.title,
          scenario: generated.scenario,
          requirements: generated.requirements,
          acceptance_criteria: generated.acceptanceCriteria,
          stretch_goals: generated.stretchGoals,
          difficulty,
          est_sessions: generated.estSessions,
          status: 'belum',
          result_link: null,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'topic_id' },
      )
      .select()
      .single(),
  )
  unwrap(await db.from('topics').update({ status: 'sedang' }).eq('id', id).select('id').single())

  res.json(toStudyCase(saved))
})

topics.post('/:id/study-case/complete', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { resultLink } = completeRequest.parse(req.body)

  const { data: updated, error } = await db
    .from('study_cases')
    .update({ status: 'selesai', result_link: resultLink })
    .eq('topic_id', id)
    .select()
    .maybeSingle()
  if (error) throw error
  if (!updated) throw new NotFoundError('Study case belum dibuat')
  unwrap(await db.from('topics').update({ status: 'selesai' }).eq('id', id).select('id').single())

  res.json(toStudyCase(updated))
})
