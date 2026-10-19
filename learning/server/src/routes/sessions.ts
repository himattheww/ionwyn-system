import { Router } from 'express'
import { z } from 'zod'
import { db, unwrap } from '../db.js'
import { sessionRequest } from '../schemas.js'

export const sessions = Router()

sessions.post('/', async (req, res) => {
  const input = sessionRequest.parse(req.body)
  unwrap(await db.from('tracks').select('id').eq('id', input.trackId).maybeSingle())

  if (input.topicId) {
    const topic = unwrap(await db.from('topics').select('track_id').eq('id', input.topicId).maybeSingle())
    if (topic.track_id !== input.trackId) {
      throw new z.ZodError([{ code: 'custom', path: ['topicId'], message: 'Topik bukan bagian dari jalur ini', input: input.topicId }])
    }
  }

  const created = unwrap(
    await db
      .from('learning_sessions')
      .insert({
        track_id: input.trackId,
        topic_id: input.topicId ?? null,
        occurred_at: input.occurredAt,
        duration_min: input.durationMin,
        summary: input.summary,
      })
      .select('id')
      .single(),
  )

  if (input.topicId) {
    unwrap(await db.from('study_cases').update({ status: 'dikerjakan' }).eq('topic_id', input.topicId).eq('status', 'belum').select('id'))
  }

  res.status(201).json(created)
})
