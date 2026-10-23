import { Router } from 'express'
import { ai } from '../ai.js'
import { db, NotFoundError, unwrap } from '../db.js'
import { codeAttemptRequest, completeRequest, idParam, studyCaseRequest } from '../schemas.js'

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

function toLesson(l: any) {
  return { summary: l.summary, exercise: l.exercise, createdAt: l.created_at }
}

function toAttempt(a: any) {
  return { id: a.id, kind: a.kind, score: a.score, total: a.total, passed: a.passed, code: a.code, feedback: a.feedback, createdAt: a.created_at }
}

async function loadTopic(id: number) {
  return unwrap(
    await db
      .from('topics')
      .select('*, tracks(id, goal, current_level, domain_hint), study_cases(*), topic_lessons(*)')
      .eq('id', id)
      .maybeSingle(),
  )
}

async function lastAttempt(id: number) {
  const { data, error } = await db.from('topic_attempts').select('*').eq('topic_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data ? toAttempt(data) : null
}

async function saveAttempt(id: number, attempt: { score: number; total: number; passed: boolean; code: string; feedback?: string }) {
  unwrap(
    await db
      .from('topic_attempts')
      .insert({ topic_id: id, kind: 'code', score: attempt.score, total: attempt.total, passed: attempt.passed, code: attempt.code, feedback: attempt.feedback ?? null })
      .select('id')
      .single(),
  )
  if (attempt.passed) unwrap(await db.from('topics').update({ status: 'selesai' }).eq('id', id).select('id').single())
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
    lesson: t.topic_lessons ? toLesson(t.topic_lessons) : null,
    lastAttempt: await lastAttempt(id),
  })
})

topics.post('/:id/lesson', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const t = await loadTopic(id)
  const lesson = await ai.createLesson({
    goal: t.tracks.goal,
    currentLevel: t.tracks.current_level,
    topicTitle: t.title,
    topicObjective: t.objective,
    sources: t.sources,
  })
  const saved = unwrap(
    await db
      .from('topic_lessons')
      .upsert(
        {
          topic_id: id,
          summary: lesson.summary.join('\n\n'),
          exercise: lesson.exercise,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'topic_id' },
      )
      .select()
      .single(),
  )
  if (t.status === 'belum') unwrap(await db.from('topics').update({ status: 'sedang' }).eq('id', id).select('id').single())
  res.json(toLesson(saved))
})

topics.post('/:id/code', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { code, results } = codeAttemptRequest.parse(req.body)
  const t = await loadTopic(id)
  if (!t.topic_lessons) throw new NotFoundError('Materi belum dibuat')
  const exercise = t.topic_lessons.exercise as { language: string; title: string; prompt: string; rubric: string[]; tests: unknown[] }

  if (exercise.language === 'javascript' && exercise.tests.length) {
    if (!results || results.total !== exercise.tests.length) return res.status(400).json({ message: 'Jalankan tes dulu sebelum menyimpan.' })
    const passed = results.passed === results.total
    await saveAttempt(id, { score: results.passed, total: results.total, passed, code })
    return res.json({ passed, score: results.passed, total: results.total, lastAttempt: await lastAttempt(id) })
  }

  const grade = await ai.gradeCode({ topicTitle: t.title, language: exercise.language, prompt: exercise.prompt, rubric: exercise.rubric, code })
  const feedback = [grade.feedback, ...grade.issues.map((i) => `- ${i}`)].join('\n')
  await saveAttempt(id, { score: grade.score, total: 100, passed: grade.passed, code, feedback })
  res.json({ passed: grade.passed, score: grade.score, total: 100, feedback, lastAttempt: await lastAttempt(id) })
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
