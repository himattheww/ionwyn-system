import { describe, expect, it } from 'vitest'
import { buildExp, diaryStreak, questTarget } from '../src/engine/exp.ts'
import type { ExpEntry } from '../src/types.ts'
import { entry, event, run, session, testRules } from './fixtures.ts'

const rules = testRules()
const total = (entries: ExpEntry[], filter: (e: ExpEntry) => boolean = () => true) =>
  entries.filter(filter).reduce((sum, e) => sum + e.awarded, 0)
const byRule = (rule: string) => (e: ExpEntry) => e.rule === rule

describe('batas harian', () => {
  it('lari 12 km di Senin terjadwal memberi 20 + 24 + 10', () => {
    const { entries } = buildExp([run('2026-10-19', 12, true)], rules, '2026-10-19')
    expect(total(entries, e => e.attribute === 'stamina')).toBe(54)
  })

  it('dua lari total 40 km berhenti di 80 dan sisanya tercatat terpotong', () => {
    const { entries } = buildExp([run('2026-10-14', 20), run('2026-10-14', 20)], rules, '2026-10-14')
    const runs = entries.filter(byRule('lari'))
    expect(total(runs)).toBe(80)
    expect(runs.reduce((sum, e) => sum + e.capped, 0)).toBe(40)
  })

  it('latihan beban hanya satu sesi per hari', () => {
    const strength = (id: string) => event('fit', 'strength', '2026-10-14', 1, {}, id)
    const { entries } = buildExp([strength('a'), strength('b')], rules, '2026-10-14')
    expect(entries.filter(byRule('latihan beban')).map(e => e.awarded)).toEqual([40, 0])
  })

  it('total stamina per hari dibatasi 150', () => {
    const day = '2026-10-14'
    const events = [
      run(day, 30, true),
      event('fit', 'strength', day),
      event('fit', 'sport', day, 1, { sport: 'other' }),
      event('fit', 'sleep', day, 8),
      event('fit', 'protein', day)
    ]
    const { entries } = buildExp(events, rules, day)
    expect(total(entries)).toBe(150)
    expect(entries.reduce((sum, e) => sum + e.capped, 0)).toBe(25)
  })

  it('batas menit belajar tidak memotong topik dan study case', () => {
    const day = '2026-10-14'
    const events = [session(day, 200), event('learn', 'topic_done', day, 1, { category: 'pemrograman' }), event('learn', 'case_done', day, 1, { category: 'pemrograman' })]
    const { entries } = buildExp(events, rules, day)
    expect(total(entries, byRule('menit belajar'))).toBe(120)
    expect(total(entries, byRule('topik selesai'))).toBe(50)
    expect(total(entries, byRule('study case selesai'))).toBe(100)
  })

  it('item jadwal maksimal 80 per hari dan transaksi keuangan 15 per hari', () => {
    const day = '2026-10-14'
    const items = Array.from({ length: 10 }, (_, i) => event('schedule', 'item_done', day, 1, {}, `s${i}`))
    const transactions = Array.from({ length: 4 }, (_, i) => event('finance', 'transaction', day, 1, {}, `t${i}`))
    const { entries } = buildExp([...items, ...transactions], rules, day)
    expect(total(entries, byRule('item jadwal'))).toBe(80)
    expect(total(entries, byRule('transaksi keuangan'))).toBe(15)
  })
})

describe('bonus lari', () => {
  it('bonus hari terjadwal hanya sekali per hari', () => {
    const { entries } = buildExp([run('2026-10-14', 5, true), run('2026-10-14', 5, true)], rules, '2026-10-14')
    expect(entries.filter(byRule('lari terjadwal'))).toHaveLength(1)
  })

  it('lari terjauh mingguan +30 sekali, setelah minggu selesai', () => {
    const events = [run('2026-10-06', 5), run('2026-10-08', 15), run('2026-10-10', 8)]
    const finished = buildExp(events, rules, '2026-10-19').entries.filter(byRule('lari terjauh minggu'))
    expect(finished).toHaveLength(1)
    expect(finished[0]).toMatchObject({ date: '2026-10-08', awarded: 30 })
    expect(buildExp(events, rules, '2026-10-10').entries.filter(byRule('lari terjauh minggu'))).toHaveLength(0)
  })
})

describe('streak Catatan Malam', () => {
  const days = (from: number, to: number, skip: number[] = []) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i)
      .filter(d => !skip.includes(d))
      .map(d => `2026-10-${String(d).padStart(2, '0')}`)

  it('6 dari 7 malam tetap melanjutkan streak', () => {
    const streak = diaryStreak(days(1, 14, [4]), rules, '2026-10-14')
    expect(streak.current).toBe(13)
    expect(streak.bonuses.map(b => b.date)).toEqual(['2026-10-08'])
  })

  it('dua hari kosong dalam 7 hari memutus streak', () => {
    const streak = diaryStreak(days(1, 14, [4, 6]), rules, '2026-10-14')
    expect(streak.current).toBe(8)
  })

  it('hari ini yang belum diisi tidak memutus streak', () => {
    expect(diaryStreak(days(1, 13), rules, '2026-10-14').current).toBe(13)
  })

  it('entri susulan 15 exp dan bonus streak 50 di kelipatan 7', () => {
    const events = days(1, 7).map((d, i) => entry(d, i === 0))
    const { entries } = buildExp(events, rules, '2026-10-07')
    expect(total(entries, byRule('entri susulan'))).toBe(15)
    expect(total(entries, byRule('entri'))).toBe(180)
    expect(total(entries, byRule('bonus streak'))).toBe(50)
  })
})

describe('quest mingguan', () => {
  it('target memakai rata-rata 4 minggu x 1,1 dengan batas bawah dan atas', () => {
    expect(questTarget([0, 0, 0, 0], rules.quest.runs, 1.1)).toBe(3)
    expect(questTarget([4, 4, 4, 4], rules.quest.runs, 1.1)).toBe(4)
    expect(questTarget([10, 10, 10, 10], rules.quest.runs, 1.1)).toBe(6)
    expect(questTarget([300, 300, 300, 300], rules.quest.minutes, 1.1)).toBe(330)
    expect(questTarget([900, 900, 900, 900], rules.quest.minutes, 1.1)).toBe(600)
    expect(questTarget([1, 1, 1, 1], rules.quest.nights, 1.1)).toBe(5)
  })

  it('quest selesai memberi 100 exp ke atribut terkait', () => {
    const events = ['2026-10-12', '2026-10-13', '2026-10-15'].map(d => run(d, 5))
    const { entries, quests } = buildExp(events, rules, '2026-10-18')
    const runQuest = quests.find(q => q.id === '2026-10-12:runs')
    expect(runQuest).toMatchObject({ target: 3, progress: 3, doneDate: '2026-10-15' })
    expect(entries.filter(byRule('quest'))).toMatchObject([{ attribute: 'stamina', awarded: 100, date: '2026-10-15' }])
  })
})
