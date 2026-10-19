import { describe, expect, it } from 'vitest'
import type { Item, RoutineTemplate } from '../../reminder-and-scheduling/core/src/index.ts'
import { runTemplateChanges } from './integrations.ts'
import { fitKind, kindFor, matchItems, type Fact } from './match.ts'

const item = (id: string, date: string, activityType: string | null, extra: Partial<Item> = {}): Item => ({
  id,
  title: id,
  module: 'kesehatan',
  kind: 'flexible',
  date,
  startTime: null,
  durationMin: 60,
  status: 'terencana',
  rescheduleCount: 0,
  rescheduledFromId: null,
  routineId: null,
  activityType,
  remindedAt: null,
  askedAt: null,
  reaskedAt: null,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra
})

const fact = (ref: string, kind: Fact['kind'], date: string, extra: Partial<Fact> = {}): Fact => ({
  source: 'fit',
  kind,
  ref,
  date,
  at: new Date(`${date}T06:00:00+07:00`),
  value: null,
  unit: null,
  ...extra
})

describe('pencocokan fakta ke item jadwal', () => {
  it('lari menyelesaikan item run_done di tanggal yang sama saja', () => {
    const pairs = matchItems(
      [item('a', '2026-10-18', 'run_done'), item('b', '2026-10-19', 'run_done')],
      [fact('fit:1', 'run', '2026-10-18')],
      new Set()
    )
    expect(pairs.map(p => [p.item.id, p.fact.ref])).toEqual([['a', 'fit:1']])
  })

  it('satu fakta hanya menyelesaikan satu item, dua lari untuk dua item', () => {
    const items = [item('a', '2026-10-18', 'run_done', { startTime: '06:00' }), item('b', '2026-10-18', 'run_done', { startTime: '17:00' })]
    expect(matchItems(items, [fact('fit:1', 'run', '2026-10-18')], new Set())).toHaveLength(1)
    const two = matchItems(items, [fact('fit:2', 'run', '2026-10-18', { at: new Date('2026-10-18T17:00:00+07:00') }), fact('fit:1', 'run', '2026-10-18')], new Set())
    expect(two.map(p => [p.item.id, p.fact.ref])).toEqual([
      ['a', 'fit:1'],
      ['b', 'fit:2']
    ])
  })

  it('fakta yang sudah dipakai log sebelumnya tidak dipakai lagi', () => {
    const pairs = matchItems([item('b', '2026-10-18', 'run_done')], [fact('fit:1', 'run', '2026-10-18')], new Set(['fit:1']))
    expect(pairs).toEqual([])
  })

  it('item selesai, dilewati, digeser, atau tanpa tipe terhubung tidak disentuh', () => {
    const items = [
      item('a', '2026-10-18', 'run_done', { status: 'selesai' }),
      item('b', '2026-10-18', 'run_done', { status: 'dilewati' }),
      item('c', '2026-10-18', 'run_done', { status: 'digeser' }),
      item('d', '2026-10-18', null),
      item('e', '2026-10-18', 'task_done')
    ]
    expect(matchItems(items, [fact('fit:1', 'run', '2026-10-18')], new Set())).toEqual([])
  })

  it('learn:<id> hanya cocok dengan sesi jalur itu, learn_done dengan jalur apa pun', () => {
    const facts = [fact('learn:session:9', 'learn', '2026-10-18', { source: 'learn', trackId: '2' })]
    expect(matchItems([item('a', '2026-10-18', 'learn:1')], facts, new Set())).toEqual([])
    expect(matchItems([item('a', '2026-10-18', 'learn:2')], facts, new Set())).toHaveLength(1)
    expect(matchItems([item('a', '2026-10-18', 'learn_done')], facts, new Set())).toHaveLength(1)
  })

  it('tipe aktivitas Garmin dipetakan ke jenis fakta', () => {
    expect(['running', 'treadmill_running', 'strength_training', 'lap_swimming', 'walking', 'badminton'].map(fitKind)).toEqual([
      'run',
      'run',
      'strength',
      'swim',
      null,
      null
    ])
    expect(['run_done', 'learn:3', 'diary_done', 'work_done', 'learn:x', null].map(kindFor)).toEqual(['run', 'learn', 'diary', 'work', null, null])
  })
})

describe('rutinitas lari dari pola Fitness', () => {
  const template = (weekday: number, title: string, active = true): RoutineTemplate => ({
    id: `t${weekday}`,
    weekday,
    title,
    module: 'kesehatan',
    kind: 'flexible',
    startTime: '05:30',
    durationMin: 45,
    activityType: 'run_done',
    active
  })

  it('membuat rutinitas untuk hari di pola, Minggu = 0', () => {
    const changes = runTemplateChanges({ '1': 'easy', '7': 'long run' }, [], 60)
    expect(changes.map(t => [t.weekday, t.title, t.durationMin, t.activityType])).toEqual([
      [1, 'Lari: easy', 60, 'run_done'],
      [0, 'Lari: long run', 60, 'run_done']
    ])
  })

  it('mengubah judul dan menonaktifkan hari yang hilang, jam dan durasi buatanmu tetap', () => {
    const changes = runTemplateChanges({ '1': 'tempo' }, [template(1, 'Lari: easy'), template(3, 'Lari: easy')], 60)
    expect(changes).toEqual([
      { ...template(1, 'Lari: easy'), title: 'Lari: tempo' },
      { ...template(3, 'Lari: easy'), active: false }
    ])
  })

  it('tidak ada perubahan kalau sudah sesuai', () => {
    expect(runTemplateChanges({ '1': 'easy' }, [template(1, 'Lari: easy'), template(3, 'Lari: x', false)], 60)).toEqual([])
  })
})
