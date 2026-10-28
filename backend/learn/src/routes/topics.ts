import { Router } from 'express'
import { completeTopic, logSession, saveCodeAttempt, topicDetail } from '../learn.js'
import { codeAttemptRequest, completeRequest, idParam } from '../schemas.js'

export const topics = Router()

topics.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  res.json(await topicDetail(id))
})

topics.post('/:id/code', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { code, results } = codeAttemptRequest.parse(req.body)
  res.json(await saveCodeAttempt(id, code, results))
})

topics.post('/:id/complete', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { durationMin } = completeRequest.parse(req.body)
  res.json(await completeTopic(id, durationMin))
})

topics.post('/:id/session', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { durationMin } = completeRequest.parse(req.body)
  res.json(await logSession(id, durationMin))
})
