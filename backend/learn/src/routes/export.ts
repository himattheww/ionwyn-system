import { Router } from 'express'
import { db, unwrap } from '../db.js'

export const exportRoute = Router()

exportRoute.get('/', async (_req, res) => {
  const [tracks, topics, studyCases, sessions] = await Promise.all([
    db.from('tracks').select('id, goal, hours_per_week, status, created_at').order('id'),
    db.from('topics').select('id, track_id, title, status').order('id'),
    db.from('study_cases').select('id, topic_id, title, status, created_at').order('id'),
    db.from('learning_sessions').select('id, track_id, topic_id, occurred_at, duration_min, summary').order('id'),
  ])
  res.json({
    tracks: unwrap(tracks),
    topics: unwrap(topics),
    study_cases: unwrap(studyCases),
    learning_sessions: unwrap(sessions),
  })
})
