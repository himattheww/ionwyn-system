import { Router } from 'express'
import { deleteTrack, listTracks, setTrackStatus, trackDetail } from '../learn.js'
import { idParam, trackStatusRequest } from '../schemas.js'

export const tracks = Router()

tracks.get('/', async (_req, res) => {
  res.json(await listTracks())
})

tracks.get('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  res.json(await trackDetail(id))
})

tracks.patch('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  const { status } = trackStatusRequest.parse(req.body)
  await setTrackStatus(id, status)
  res.status(204).end()
})

tracks.delete('/:id', async (req, res) => {
  const { id } = idParam.parse(req.params)
  await deleteTrack(id)
  res.status(204).end()
})
