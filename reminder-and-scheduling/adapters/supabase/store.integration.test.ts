import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { completeItem, createItem, defaultSettings, shiftItem, startIdle, stopIdle } from '../../core/src'
import type { RoutineTemplate, Store } from '../../core/src'
import { createPlannerClient, createSupabaseStore } from './store'

const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD } = process.env
const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && TEST_EMAIL && TEST_PASSWORD)

describe.skipIf(!enabled)('SupabaseStore', () => {
  let client: SupabaseClient
  let store: Store
  const date = '2099-01-05'
  const now = new Date(2099, 0, 5, 5, 0)
  const itemIds: string[] = []
  const logIds: string[] = []
  const templateIds: string[] = []

  beforeAll(async () => {
    client = createPlannerClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string)
    store = createSupabaseStore(client)
    const { error } = await client.auth.signInWithPassword({
      email: TEST_EMAIL as string,
      password: TEST_PASSWORD as string,
    })
    if (error) throw error
  })

  afterAll(async () => {
    await client.from('activity_logs').delete().in('id', logIds)
    await client.from('schedule_items').delete().in('id', itemIds)
    await client.from('routine_templates').delete().in('id', templateIds)
  })

  it('simpan template dan item, lalu baca ulang urut jam', async () => {
    const template: RoutineTemplate = {
      id: randomUUID(),
      weekday: 1,
      title: 'lari uji',
      module: 'kesehatan',
      kind: 'flexible',
      startTime: '06:00',
      durationMin: 45,
      activityType: 'run_done',
      active: true,
    }
    templateIds.push(template.id)
    await store.saveTemplates([template])

    const late = createItem({ title: 'uji siang', kind: 'fixed', date, startTime: '13:00', durationMin: 60 }, randomUUID, now)
    const early = createItem(
      { title: 'uji lari', kind: 'flexible', date, startTime: '06:00', durationMin: 45, routineId: template.id, activityType: 'run_done' },
      randomUUID,
      now,
    )
    const anytime = createItem({ title: 'uji kapan saja', kind: 'flexible', date, durationMin: 30 }, randomUUID, now)
    itemIds.push(late.id, early.id, anytime.id)
    await store.saveItems([late, early, anytime])

    const items = await store.itemsBetween(date, date)
    expect(items.map((i) => i.title)).toEqual(['uji lari', 'uji siang', 'uji kapan saja'])
    expect(items[0]).toEqual(early)
    expect((await store.templates()).find((t) => t.id === template.id)).toEqual(template)
  })

  it('hapus template', async () => {
    const template: RoutineTemplate = {
      id: randomUUID(),
      weekday: 3,
      title: 'template hapus uji',
      module: 'umum',
      kind: 'flexible',
      startTime: null,
      durationMin: 20,
      activityType: null,
      active: true,
    }
    templateIds.push(template.id)
    await store.saveTemplates([template])
    await store.deleteTemplate(template.id)
    expect((await store.templates()).some((t) => t.id === template.id)).toBe(false)
  })

  it('geser menyimpan arsip dan klon dalam satu tulis', async () => {
    const [source] = (await store.itemsBetween(date, date)).filter((i) => i.title === 'uji lari')
    const { original, next } = shiftItem(source!, { date, startTime: '18:00' }, now, randomUUID)
    itemIds.push(next.id)
    await store.saveItems([original, next])

    const items = await store.itemsBetween(date, date)
    expect(items.find((i) => i.id === original.id)?.status).toBe('digeser')
    expect(items.find((i) => i.id === next.id)).toMatchObject({ rescheduleCount: 1, rescheduledFromId: original.id })
  })

  it('selesai menulis satu log dan log kedua untuk item sama ditolak', async () => {
    const [target] = (await store.itemsBetween(date, date)).filter((i) => i.title === 'uji lari' && i.status === 'terencana')
    const { item, log } = completeItem(target!, now, randomUUID)
    logIds.push(log.id)
    await store.saveLog(log)
    await store.saveItems([item])

    const logs = await store.logsBetween(new Date(now.getTime() - 60_000), new Date(now.getTime() + 60_000))
    expect(logs.find((l) => l.id === log.id)).toMatchObject({ type: 'run_done', itemId: target!.id, value: 45 })

    const duplicate = { ...log, id: randomUUID() }
    await expect(store.saveLog(duplicate)).rejects.toThrow()
  })

  it('hanya satu sesi kosong terbuka, stop menutupnya', async () => {
    expect(await store.openIdle()).toBeNull()
    const first = startIdle([], { module: 'kerja', note: 'uji' }, now, randomUUID)
    logIds.push(first.id)
    await store.saveLog(first)
    expect((await store.openIdle())?.id).toBe(first.id)

    const second = startIdle([], { module: 'kerja' }, now, randomUUID)
    await expect(store.saveLog(second)).rejects.toThrow()

    await store.saveLog(stopIdle(first, new Date(now.getTime() + 25 * 60_000)))
    expect(await store.openIdle()).toBeNull()
  })

  it('simpan settings, baca ulang, lalu kembalikan kondisi semula', async () => {
    const { data: auth } = await client.auth.getUser()
    const owner = auth.user?.id as string
    const { data: before } = await client.from('planner_settings').select('*').maybeSingle()

    const changed = { ...defaultSettings, morningSummary: '05:15', maxFreeShifts: 3, remindBeforeMin: 20 }
    await store.saveSettings(changed)
    expect(await store.settings()).toEqual(changed)

    if (before) await client.from('planner_settings').upsert(before)
    else await client.from('planner_settings').delete().eq('owner', owner)
  })

  it('kolom reasked_at tersimpan', async () => {
    const item = createItem({ title: 'uji reask', kind: 'flexible', date, durationMin: 10 }, randomUUID, now)
    itemIds.push(item.id)
    const stamp = new Date(2099, 0, 5, 7, 0).toISOString()
    await store.saveItems([{ ...item, askedAt: stamp, reaskedAt: stamp }])
    const saved = (await store.itemsBetween(date, date)).find((i) => i.id === item.id)
    expect(saved?.reaskedAt).toBe(stamp)
  })
})
