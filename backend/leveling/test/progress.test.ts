import { describe, expect, it } from 'vitest'
import { buildExp } from '../src/engine/exp.ts'
import { buildProgress, classify, levelFromExp, subclassFor, tierFor } from '../src/engine/progress.ts'
import type { Attribute } from '../src/types.ts'
import { run, session, testRules } from './fixtures.ts'

const rules = testRules()
const exp30 = (values: Partial<Record<Attribute, number>>) => ({ stamina: 0, intelek: 0, kebijaksanaan: 0, disiplin: 0, kekayaan: 0, ...values })

describe('kurva level dan tingkatan', () => {
  it('level keseluruhan 500 + 250 x (n - 1)', () => {
    expect(levelFromExp(0, 500, 250).level).toBe(1)
    expect(levelFromExp(499, 500, 250)).toEqual({ level: 1, levelExp: 499, levelNeed: 500 })
    expect(levelFromExp(500, 500, 250)).toEqual({ level: 2, levelExp: 0, levelNeed: 750 })
    expect(levelFromExp(1250, 500, 250)).toEqual({ level: 3, levelExp: 0, levelNeed: 1000 })
  })

  it('level atribut 200 + 100 x (n - 1)', () => {
    expect(levelFromExp(200, 200, 100).level).toBe(2)
    expect(levelFromExp(499, 200, 100).level).toBe(2)
    expect(levelFromExp(500, 200, 100).level).toBe(3)
  })

  it('tingkatan mengikuti level', () => {
    const tiers = rules.level.tiers
    expect([1, 9, 10, 19, 20, 34, 35, 80].map(level => tierFor(level, tiers))).toEqual([
      'Novice', 'Novice', 'Adept', 'Adept', 'Expert', 'Expert', 'Master', 'Master'
    ])
  })
})

describe('penentuan kelas', () => {
  it('tanpa exp menjadi Adventurer', () => {
    expect(classify(exp30({}), rules)).toEqual({ key: 'seimbang', strongest: null })
  })

  it('skor dinormalisasi dengan target 30 hari', () => {
    expect(classify(exp30({ stamina: 1000, kekayaan: 600 }), rules).key).toBe('kekayaan')
  })

  it('atribut kedua ikut kalau minimal 80% skor tertinggi', () => {
    expect(classify(exp30({ stamina: 1800, intelek: 1200 }), rules).key).toBe('stamina+intelek')
    expect(classify(exp30({ stamina: 1800, intelek: 1100 }), rules).key).toBe('stamina')
    expect(classify(exp30({ disiplin: 900, intelek: 1500 }), rules).key).toBe('intelek')
  })

  it('seimbang kalau semua skor minimal 0,5 dan rasio maksimal 1,25', () => {
    const balanced = exp30({ stamina: 1800, intelek: 1500, kebijaksanaan: 900, disiplin: 1800, kekayaan: 500 })
    expect(classify(balanced, rules).key).toBe('seimbang')
    const tooWide = exp30({ stamina: 1800, intelek: 1500, kebijaksanaan: 900, disiplin: 1800, kekayaan: 450 })
    expect(classify(tooWide, rules).key).not.toBe('seimbang')
  })
})

describe('penentuan subkelas', () => {
  const groups = (values: Record<string, number>) => new Map(Object.entries(values))

  it('aktivitas stamina dominan minimal 50%', () => {
    expect(subclassFor('stamina', groups({ 'stamina|run': 300, 'stamina|strength': 200 }), rules)).toBe('run')
    expect(subclassFor('stamina', groups({ 'stamina|swim': 300, 'stamina|run': 100 }), rules)).toBe('swim')
  })

  it('Vanguard kalau tidak ada yang mencapai 50%', () => {
    expect(subclassFor('stamina', groups({ 'stamina|run': 40, 'stamina|strength': 30, 'stamina|swim': 30 }), rules)).toBe('vanguard')
    expect(subclassFor('stamina', groups({ 'stamina|other': 100 }), rules)).toBe('vanguard')
  })

  it('kategori Learn, disiplin, kekayaan, dan kebijaksanaan', () => {
    expect(subclassFor('intelek', groups({ 'intelek|learn:bahasa': 50, 'intelek|learn:pemrograman': 20 }), rules)).toBe('learn:bahasa')
    expect(subclassFor('disiplin', groups({ 'disiplin|timesheet': 300, 'disiplin|schedule': 100 }), rules)).toBe('timesheet')
    expect(subclassFor('kekayaan', groups({ 'kekayaan|stock': 30, 'kekayaan|finance': 15 }), rules)).toBe('stock')
    expect(subclassFor('kebijaksanaan', groups({ 'kebijaksanaan|diary': 500 }), rules)).toBeNull()
  })
})

describe('progres karakter', () => {
  it('sebulan belajar C# mengubah kelas jadi Mage / Technomancer dan tercatat di riwayat', () => {
    const runs = ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-10', '2026-08-12'].map(d => run(d, 10))
    const sessions = Array.from({ length: 30 }, (_, i) => session(`2026-09-${String(i + 1).padStart(2, '0')}`, 90))
    const events = [...runs, ...sessions]
    const { entries, quests } = buildExp(events, rules, '2026-09-30')
    const { state, history } = buildProgress(entries, events, quests, rules, '2026-09-30')
    expect(state.className).toBe('Mage / Ilmuwan')
    expect(state.subclassName).toBe('Technomancer / Engineer')
    expect(state.specialization).toBe('C#')
    expect(state.title).toBe(`${state.tier} Mage / Ilmuwan · Technomancer / Engineer · spesialis C#`)
    const classes = history.filter(h => h.kind === 'class').map(h => h.text)
    expect(classes[0]).toBe('Kelas awal: Warrior / Atlet')
    expect(classes.at(-1)).toMatch(/^Kelas berubah: .+ → Mage \/ Ilmuwan$/)
  })

  it('achievement mencatat tanggal didapat', () => {
    const events = [run('2026-10-01', 8), run('2026-10-05', 10.5), run('2026-10-12', 21.1)]
    const { entries, quests } = buildExp(events, rules, '2026-10-19')
    const { state } = buildProgress(entries, events, quests, rules, '2026-10-19', 16)
    expect(state.achievements).toMatchObject({ 'run-10k': '2026-10-05', 'run-half': '2026-10-12', 'run-long-target': '2026-10-12' })
    expect(state.achievements['run-full']).toBeUndefined()
  })
})
