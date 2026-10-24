import { randomUUID } from 'node:crypto'
import express, { Router } from 'express'
import { createPlannerClient, createSupabaseStore } from '../../reminder-and-scheduling/adapters/supabase/store.ts'
import { completeItem, createItem, isDate, isTime, modules, skipItem, type Kind, type Module, type Store } from '../../reminder-and-scheduling/core/src/index.ts'
import { config } from './config.ts'

export const newId = () => randomUUID()

let cached: { store: Store; expiresAt: number } | null = null

export async function scheduleStore() {
  const { url, key, email, password } = config.schedule
  if (!url || !key || !email || !password) throw new Error('SCHEDULE_SUPABASE_URL, SCHEDULE_SUPABASE_KEY, SCHEDULE_EMAIL, atau SCHEDULE_PASSWORD belum diisi')
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.store
  const client = createPlannerClient(url, key)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login Scheduling gagal: ${error.message}`)
  cached = { store: createSupabaseStore(client), expiresAt: (data.session?.expires_at ?? 0) * 1000 }
  return cached.store
}

const badRequest = (message: string) => Object.assign(new Error(message), { status: 400 })

function core<T>(run: () => T) {
  try {
    return run()
  } catch (error) {
    throw badRequest((error as Error).message)
  }
}

function dateParam(value: unknown, name: string) {
  if (typeof value !== 'string' || !isDate(value)) throw badRequest(`${name} harus tanggal YYYY-MM-DD`)
  return value
}

function newItemInput(body: Record<string, unknown>) {
  const { title, date, startTime, durationMin, kind = 'flexible', module = 'umum', activityType } = body
  if (typeof title !== 'string' || !title.trim() || title.length > 200) throw badRequest('Judul wajib diisi, maksimal 200 karakter')
  if (startTime != null && (typeof startTime !== 'string' || !isTime(startTime))) throw badRequest('Jam harus HH:MM')
  if (!Number.isInteger(durationMin) || (durationMin as number) < 5 || (durationMin as number) > 1440) throw badRequest('Durasi 5-1440 menit')
  if (kind !== 'fixed' && kind !== 'flexible') throw badRequest('Jenis harus fixed atau flexible')
  if (!modules.includes(module as Module)) throw badRequest(`Modul harus salah satu: ${modules.join(', ')}`)
  if (activityType != null && (typeof activityType !== 'string' || activityType.length > 60)) throw badRequest('Tipe aktivitas maksimal 60 karakter')
  return {
    title: title.trim(),
    date: dateParam(date, 'Tanggal'),
    startTime: (startTime as string | null | undefined) ?? null,
    durationMin: durationMin as number,
    kind: kind as Kind,
    module: module as Module,
    activityType: (activityType as string | null | undefined)?.trim() || null,
  }
}

async function findItem(store: Store, id: string, date: string) {
  const item = (await store.itemsBetween(date, date)).find(i => i.id === id)
  if (!item) throw Object.assign(new Error('Item jadwal tidak ditemukan di tanggal itu'), { status: 404 })
  return item
}

export function scheduleRoutes() {
  const router = Router()
  router.use('/hub/api/schedule', express.json())

  router.get('/hub/api/schedule', async (req, res) => {
    const from = dateParam(req.query.from, 'from')
    const to = dateParam(req.query.to, 'to')
    const items = await (await scheduleStore()).itemsBetween(from, to)
    res.json(items.map(i => ({ id: i.id, date: i.date, startTime: i.startTime, durationMin: i.durationMin, title: i.title, status: i.status, module: i.module, kind: i.kind, activityType: i.activityType })))
  })

  router.post('/hub/api/schedule', async (req, res) => {
    const item = core(() => createItem(newItemInput(req.body ?? {}), newId, new Date()))
    await (await scheduleStore()).saveItems([item])
    res.status(201).json({ id: item.id, date: item.date, title: item.title })
  })

  router.post('/hub/api/schedule/:id/complete', async (req, res) => {
    const date = dateParam(req.body?.date, 'Tanggal')
    const store = await scheduleStore()
    const found = await findItem(store, req.params.id, date)
    const { item, log } = core(() => completeItem(found, new Date(), newId))
    await store.saveLog(log)
    await store.saveItems([item])
    res.json({ id: item.id, status: item.status })
  })

  router.post('/hub/api/schedule/:id/skip', async (req, res) => {
    const date = dateParam(req.body?.date, 'Tanggal')
    const store = await scheduleStore()
    const found = await findItem(store, req.params.id, date)
    const item = core(() => skipItem(found))
    await store.saveItems([item])
    res.json({ id: item.id, status: item.status })
  })

  return router
}
