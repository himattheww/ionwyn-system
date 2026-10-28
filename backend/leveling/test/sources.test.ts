import { describe, expect, it } from 'vitest'
import { readDiary } from '../src/sources/diary.ts'
import { financeEvents } from '../src/sources/finance.ts'
import { readFit } from '../src/sources/fit.ts'
import { learnEvents, readLearn } from '../src/sources/learn.ts'
import { scheduleEvents } from '../src/sources/schedule.ts'
import { timesheetEvents } from '../src/sources/timesheet.ts'
import { testDb, testRules } from './fixtures.ts'

describe('adapter Fit Tracker', () => {
  it('membaca lari terjadwal, beban, renang, tidur, dan protein', async () => {
    const db = await testDb()
    await db.run(`
      insert into fit_activities (garmin_id, type, start_time, date, distance_m) values
        (1, 'running', '2026-10-19T00:00:00Z', '2026-10-19', 12000),
        (2, 'running', '2026-10-20T00:00:00Z', '2026-10-20', 5000),
        (3, 'strength_training', '2026-10-20T10:00:00Z', '2026-10-20', null),
        (4, 'lap_swimming', '2026-10-21T10:00:00Z', '2026-10-21', 1000)`)
    await db.run(`insert into fit_recovery_daily (date, sleep_min, sleep_score, rhr, source) values ('2026-10-19', 420, 80, 50, 'garmin'), ('2026-10-20', 300, 60, 55, 'garmin')`)
    await db.run(`insert into fit_meals (date, protein_met, rice_portions) values ('2026-10-19', 1, 2), ('2026-10-20', 0, 3)`)
    const events = await readFit(db, testRules())
    expect(events.filter(e => e.type === 'run').map(e => [e.date, e.value, e.meta.scheduled])).toEqual([
      ['2026-10-19', 12, true],
      ['2026-10-20', 5, false]
    ])
    expect(events.find(e => e.id === 'fit:activity:3')?.type).toBe('strength')
    expect(events.find(e => e.id === 'fit:activity:4')?.meta.sport).toBe('swim')
    expect(events.filter(e => e.type === 'sleep').map(e => e.value)).toEqual([7, 5])
    expect(events.filter(e => e.type === 'protein')).toHaveLength(1)
  })
})

describe('adapter Catatan Malam', () => {
  it('menandai entri yang diisi belakangan', async () => {
    const db = await testDb()
    await db.run(`insert into catatan_entries (entry_date, happened, good_things, lessons, is_backfilled) values
      ('2026-10-18', 'a', 'b', 'c', false), ('2026-10-17', 'a', 'b', 'c', true)`)
    expect((await readDiary(db)).map(e => [e.date, e.meta.backfilled])).toEqual([
      ['2026-10-17', true],
      ['2026-10-18', false]
    ])
  })
})

describe('adapter Learn', () => {
  it('membaca ekspor API Learn dan memetakan kategori jalur', () => {
    const rules = testRules(r => {
      r.intelek.trackCategories = { '1': 'pemrograman', '2': 'bahasa' }
    })
    const events = learnEvents(
      {
        tracks: [
          { id: 1, goal: 'C#', created_at: '2026-09-01T01:00:00Z' },
          { id: 2, goal: 'Bahasa Jepang', created_at: '2026-09-01T01:00:00Z' },
          { id: 3, goal: 'Statistik', created_at: '2026-09-01T01:00:00Z' }
        ],
        topics: [
          { id: 10, track_id: 1, title: 'LINQ', status: 'selesai' },
          { id: 11, track_id: 1, title: 'Async', status: 'sedang' },
          { id: 20, track_id: 2, title: 'Hiragana', status: 'sudah_bisa' }
        ],
        study_cases: [{ id: 100, topic_id: 10, title: 'Kasus LINQ', status: 'selesai', created_at: '2026-09-02T01:00:00Z' }],
        learning_sessions: [
          { id: 1, track_id: 1, topic_id: 10, occurred_at: '2026-09-03', duration_min: 45 },
          { id: 2, track_id: 1, topic_id: 10, occurred_at: '2026-09-05', duration_min: 30 },
          { id: 3, track_id: 2, topic_id: null, occurred_at: '2026-09-04', duration_min: 20 },
          { id: 4, track_id: 3, topic_id: null, occurred_at: '2026-09-04', duration_min: 10 }
        ]
      },
      rules
    )
    expect(events.filter(e => e.type === 'session').map(e => [e.meta.trackName, e.meta.category, e.value])).toEqual([
      ['C#', 'pemrograman', 45],
      ['C#', 'pemrograman', 30],
      ['Bahasa Jepang', 'bahasa', 20],
      ['Statistik', 'lainnya', 10]
    ])
    expect(events.filter(e => e.type === 'topic_done')).toMatchObject([{ id: 'learn:topic:10', date: '2026-09-05' }])
    expect(events.filter(e => e.type === 'case_done')).toMatchObject([{ id: 'learn:case:100', date: '2026-09-05', meta: { category: 'pemrograman' } }])
  })

  it('Learn yang mati memberi error yang jelas', async () => {
    await expect(readLearn('http://127.0.0.1:9', testRules())).rejects.toThrow('Learn tidak bisa dihubungi')
  })
})

describe('adapter Timesheet, Scheduling, dan Keuangan', () => {
  it('hari kerja butuh Hadir Y, Start, dan Finish', () => {
    const events = timesheetEvents([
      { date: '2026-10-09', hadir: 'Y', start: 480, end: 1020 },
      { date: '2026-10-10', hadir: 'Y', start: 480, end: null },
      { date: '2026-10-11', hadir: 'N', start: null, end: null },
      { date: '2026-10-12', hadir: '', start: null, end: null }
    ])
    expect(events.map(e => e.date)).toEqual(['2026-10-09'])
  })

  it('item jadwal selesai memakai tanggal selesai di Jakarta', () => {
    const events = scheduleEvents([
      { item_id: 'a', date: '2026-10-18', status: 'selesai', completed_at: '2026-10-18T18:30:00Z' },
      { item_id: 'b', date: '2026-10-18', status: 'dilewati', completed_at: null }
    ])
    expect(events).toMatchObject([{ id: 'schedule:item:a', date: '2026-10-19' }])
  })

  it('item dengan tipe terhubung tidak memberi exp disiplin', () => {
    const linked = testRules().disiplin.linkedActivityTypes
    const events = scheduleEvents(
      [
        { item_id: 'a', date: '2026-10-18', status: 'selesai', activity_type: 'run_done', completed_at: null },
        { item_id: 'b', date: '2026-10-18', status: 'selesai', activity_type: 'learn:3', completed_at: null },
        { item_id: 'c', date: '2026-10-18', status: 'selesai', activity_type: 'task_done', completed_at: null },
        { item_id: 'd', date: '2026-10-18', status: 'selesai', activity_type: null, completed_at: null }
      ],
      linked
    )
    expect(events.map(e => e.id)).toEqual(['schedule:item:c', 'schedule:item:d'])
  })

  it('budget terjaga hanya untuk bulan yang sudah lewat', () => {
    const transactions = [
      { id: 1, date: '2026-09-10', type: 'expense', amount: 500 },
      { id: 2, date: '2026-09-11', type: 'income', amount: 9000 },
      { id: 3, date: '2026-10-02', type: 'expense', amount: 100 }
    ]
    const budgets = [
      { month: '2026-09', utama_amount: 400, jajan_amount: 200 },
      { month: '2026-10', utama_amount: 400, jajan_amount: 200 }
    ]
    const events = financeEvents(transactions, budgets, '2026-10-19')
    expect(events.filter(e => e.type === 'budget_kept')).toMatchObject([{ date: '2026-09-30' }])
    expect(financeEvents(transactions, [], '2026-10-19').some(e => e.type === 'budget_kept')).toBe(false)
  })
})
