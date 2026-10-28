import { addDays, eachDay } from '../dates.ts'
import type { Rules } from '../rules.ts'
import { attributeKeys, attributeNames, type Attribute, type CharacterState, type ExpEntry, type HistoryItem, type Quest, type SourceEvent } from '../types.ts'
import { diaryStreak } from './exp.ts'

export const classNames: Record<string, string> = {
  stamina: 'Warrior / Atlet',
  intelek: 'Mage / Ilmuwan',
  kebijaksanaan: 'Monk / Filsuf',
  disiplin: 'Knight / Komandan',
  kekayaan: 'Merchant / Investor',
  'stamina+intelek': 'Spellblade / Dokter',
  'stamina+kebijaksanaan': 'Druid / Pelatih',
  'stamina+disiplin': 'Paladin / Prajurit',
  'stamina+kekayaan': 'Mercenary / Atlet Profesional',
  'intelek+kebijaksanaan': 'Sage / Profesor',
  'intelek+disiplin': 'Artificer / Insinyur',
  'intelek+kekayaan': 'Alchemist / Analis',
  'kebijaksanaan+disiplin': 'Templar / Mentor',
  'kebijaksanaan+kekayaan': 'Oracle / Penasihat',
  'disiplin+kekayaan': 'Lord / Pengusaha',
  seimbang: 'Adventurer / Generalis'
}

export const subclassNames: Record<string, string> = {
  run: 'Ranger / Pelari',
  strength: 'Berserker / Lifter',
  swim: 'Tidecaller / Perenang',
  vanguard: 'Vanguard / Multisport',
  'learn:pemrograman': 'Technomancer / Engineer',
  'learn:bahasa': 'Polyglot / Linguis',
  'learn:lainnya': 'Scholar / Peneliti',
  schedule: 'Strategist / Perencana',
  timesheet: 'Sentinel / Profesional',
  finance: 'Treasurer / Akuntan',
  stock: 'Speculator / Trader'
}

export function levelFromExp(exp: number, base: number, step: number) {
  let level = 1
  let rest = exp
  let need = base
  while (rest >= need) {
    rest -= need
    level++
    need = base + step * (level - 1)
  }
  return { level, levelExp: rest, levelNeed: need }
}

export function tierFor(level: number, tiers: Rules['level']['tiers']) {
  return [...tiers].sort((a, b) => a.from - b.from).filter(t => t.from <= level).at(-1)?.name ?? tiers[0].name
}

export function classify(exp30: Record<Attribute, number>, rules: Rules) {
  const scores = attributeKeys.map(key => ({ key, score: exp30[key] / rules.attributes[key].target30d }))
  const max = Math.max(...scores.map(s => s.score))
  const min = Math.min(...scores.map(s => s.score))
  if (max === 0) return { key: 'seimbang', strongest: null }
  const [top, second] = [...scores].sort((a, b) => b.score - a.score)
  if (min >= rules.class.balancedMinScore && max / min <= rules.class.balancedMaxRatio) return { key: 'seimbang', strongest: top.key }
  if (second.score > 0 && second.score >= top.score * rules.class.secondRatio) {
    const pair = [top.key, second.key].sort((a, b) => attributeKeys.indexOf(a) - attributeKeys.indexOf(b))
    return { key: pair.join('+'), strongest: top.key }
  }
  return { key: top.key, strongest: top.key }
}

const subclassGroups: Record<Attribute, string[]> = {
  stamina: ['run', 'strength', 'swim', 'other'],
  intelek: ['learn:pemrograman', 'learn:bahasa', 'learn:lainnya'],
  kebijaksanaan: [],
  disiplin: ['schedule', 'timesheet'],
  kekayaan: ['finance', 'stock']
}

export function subclassFor(strongest: Attribute | null, groupExp: Map<string, number>, rules: Rules) {
  if (!strongest) return null
  const groups = subclassGroups[strongest].map(group => ({ group, exp: groupExp.get(`${strongest}|${group}`) ?? 0 }))
  if (groups.length === 0) return null
  const total = groups.reduce((sum, g) => sum + g.exp, 0)
  const top = groups.reduce((best, g) => (g.exp > best.exp ? g : best))
  if (strongest === 'stamina') {
    const dominant = top.exp > 0 && top.group !== 'other' && top.exp / total >= rules.class.subclassMinShare
    return dominant ? top.group : 'vanguard'
  }
  return top.exp > 0 ? top.group : null
}

function nthDate(dates: string[], n: number) {
  return [...dates].sort()[n - 1] ?? null
}

export function earnAchievements(
  events: SourceEvent[],
  rules: Rules,
  today: string,
  levelReached: Map<number, string>,
  targetLongRunKm?: number
) {
  const of = (source: string, type: string) => events.filter(e => e.source === source && e.type === type)
  const runs = [...of('fit', 'run')].sort((a, b) => a.date.localeCompare(b.date))
  const streak = diaryStreak(of('diary', 'entry').map(e => e.date), rules, today)
  const firstRunOver = (distance: number) => runs.find(r => r.value >= distance)?.date ?? null

  const learnMinutes = [...of('learn', 'session')].sort((a, b) => a.date.localeCompare(b.date))
  const minutesReached = (minutes: number) => {
    let total = 0
    for (const session of learnMinutes) {
      total += session.value
      if (total >= minutes) return session.date
    }
    return null
  }

  const financeDays = [...new Set(of('finance', 'transaction').map(e => e.date))].sort()
  const financeStreak = (length: number) => {
    let run = 0
    for (let i = 0; i < financeDays.length; i++) {
      run = i > 0 && addDays(financeDays[i - 1], 1) === financeDays[i] ? run + 1 : 1
      if (run >= length) return financeDays[i]
    }
    return null
  }

  const earned: Record<string, string> = {}
  for (const achievement of rules.achievements) {
    const value = achievement.value ?? 0
    const dateOf = {
      run_distance: () => firstRunOver(value),
      run_long_target: () => (targetLongRunKm ? firstRunOver(targetLongRunKm) : null),
      strength_sessions: () => nthDate(of('fit', 'strength').map(e => e.date), value),
      diary_streak: () => streak.reached.get(value) ?? null,
      case_done: () => nthDate(of('learn', 'case_done').map(e => e.date), value),
      topic_done: () => nthDate(of('learn', 'topic_done').map(e => e.date), value),
      learn_hours: () => minutesReached(value * 60),
      schedule_items: () => nthDate(of('schedule', 'item_done').map(e => e.date), value),
      finance_streak: () => financeStreak(value),
      level: () => levelReached.get(value) ?? null
    }[achievement.kind]()
    if (dateOf) earned[achievement.id] = dateOf
  }
  return earned
}

export function buildProgress(
  entries: ExpEntry[],
  events: SourceEvent[],
  quests: Quest[],
  rules: Rules,
  today: string,
  targetLongRunKm?: number
) {
  const { overallBase, overallStep, attributeBase, attributeStep, tiers } = rules.level
  const windowDays = rules.class.windowDays
  const byDate = new Map<string, ExpEntry[]>()
  for (const entry of entries) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entry])

  const total = Object.fromEntries(attributeKeys.map(k => [k, 0])) as Record<Attribute, number>
  const window = Object.fromEntries(attributeKeys.map(k => [k, 0])) as Record<Attribute, number>
  const windowGroups = new Map<string, number>()
  const shift = (day: string, sign: number) => {
    for (const entry of byDate.get(day) ?? []) {
      window[entry.attribute] += sign * entry.awarded
      const key = `${entry.attribute}|${entry.group}`
      windowGroups.set(key, (windowGroups.get(key) ?? 0) + sign * entry.awarded)
    }
  }

  const history: HistoryItem[] = []
  const levelReached = new Map<number, string>([[1, entries[0]?.date ?? today]])
  let level = 1
  let tier = tierFor(1, tiers)
  const attributeLevel = Object.fromEntries(attributeKeys.map(k => [k, 1])) as Record<Attribute, number>
  let classKey: string | null = null
  let subclassKey: string | null = null
  let strongest: Attribute | null = null

  const firstDate = entries.map(e => e.date).sort()[0]
  for (const day of firstDate ? eachDay(firstDate, today) : []) {
    for (const entry of byDate.get(day) ?? []) total[entry.attribute] += entry.awarded
    shift(day, 1)
    shift(addDays(day, -windowDays), -1)

    const overall = levelFromExp(attributeKeys.reduce((sum, k) => sum + total[k], 0), overallBase, overallStep).level
    if (overall > level) {
      for (let n = level + 1; n <= overall; n++) levelReached.set(n, day)
      history.push({ date: day, kind: 'level', text: `Naik ke level ${overall}` })
      const nextTier = tierFor(overall, tiers)
      if (nextTier !== tier) history.push({ date: day, kind: 'tier', text: `Naik tingkatan menjadi ${nextTier}` })
      level = overall
      tier = nextTier
    }
    for (const key of attributeKeys) {
      const next = levelFromExp(total[key], attributeBase, attributeStep).level
      if (next > attributeLevel[key]) history.push({ date: day, kind: 'attribute', text: `${attributeNames[key]} naik ke level ${next}` })
      attributeLevel[key] = next
    }
    const result = classify(window, rules)
    strongest = result.strongest
    if (result.key !== classKey) {
      history.push({ date: day, kind: 'class', text: classKey ? `Kelas berubah: ${classNames[classKey]} → ${classNames[result.key]}` : `Kelas awal: ${classNames[result.key]}` })
      classKey = result.key
    }
    const nextSubclass = subclassFor(strongest, windowGroups, rules)
    if (nextSubclass !== subclassKey) {
      const from = subclassKey ? subclassNames[subclassKey] : 'tanpa subkelas'
      const to = nextSubclass ? subclassNames[nextSubclass] : 'tanpa subkelas'
      history.push({ date: day, kind: 'subclass', text: `Subkelas: ${from} → ${to}` })
      subclassKey = nextSubclass
    }
  }

  const achievements = earnAchievements(events, rules, today, levelReached, targetLongRunKm)
  for (const [id, date] of Object.entries(achievements)) {
    history.push({ date, kind: 'achievement', text: `Achievement: ${rules.achievements.find(a => a.id === id)?.name ?? id}` })
  }
  const questsDone = quests.filter(q => q.doneDate).map(q => ({ id: q.id, label: `${q.label} (minggu ${q.week})`, date: q.doneDate! }))
  for (const quest of questsDone) history.push({ date: quest.date, kind: 'quest', text: `Quest selesai: ${quest.label}` })
  history.sort((a, b) => a.date.localeCompare(b.date))

  const windowStart = addDays(today, -windowDays + 1)
  const minutesByTrack = new Map<string, number>()
  for (const session of events.filter(e => e.source === 'learn' && e.type === 'session' && e.date >= windowStart && e.date <= today)) {
    const track = String(session.meta.trackName)
    minutesByTrack.set(track, (minutesByTrack.get(track) ?? 0) + session.value)
  }
  const specialization = [...minutesByTrack].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const finalClass = classKey ?? 'seimbang'
  const totalExp = attributeKeys.reduce((sum, k) => sum + total[k], 0)
  const overall = levelFromExp(totalExp, overallBase, overallStep)
  const subclassName = subclassKey ? subclassNames[subclassKey] : null
  const streak = diaryStreak(events.filter(e => e.source === 'diary' && e.type === 'entry').map(e => e.date), rules, today)
  const currentWeek = quests.at(-1)?.week

  const state: CharacterState = {
    today,
    totalExp,
    ...overall,
    tier: tierFor(overall.level, tiers),
    attributes: attributeKeys.map(key => ({
      key,
      name: attributeNames[key],
      exp: total[key],
      ...levelFromExp(total[key], attributeBase, attributeStep),
      exp30: window[key],
      score: Math.round((window[key] / rules.attributes[key].target30d) * 100) / 100
    })),
    classKey: finalClass,
    className: classNames[finalClass],
    subclassKey,
    subclassName,
    specialization,
    title: [`${tierFor(overall.level, tiers)} ${classNames[finalClass]}`, subclassName, specialization && `spesialis ${specialization}`].filter(Boolean).join(' · '),
    streak: { current: streak.current, best: streak.best },
    achievements,
    quests: quests.filter(q => q.week === currentWeek),
    questsDone: questsDone.map(({ id, label }) => ({ id, label }))
  }
  return { state, history }
}
