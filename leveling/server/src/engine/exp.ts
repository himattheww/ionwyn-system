import { addDays, eachDay, weekStart } from '../dates.ts'
import type { Rules } from '../rules.ts'
import type { Attribute, ExpEntry, Quest, SourceEvent } from '../types.ts'

interface Candidate {
  date: string
  attribute: Attribute
  source: string
  rule: string
  group: string
  eventId: string | null
  note: string
  raw: number
  ruleCap?: number
  exempt?: boolean
}

const km = (value: number) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 2 })} km`

export function diaryStreak(dates: string[], rules: Rules, today: string) {
  const { streakEvery, streakWindowDays, streakMaxMissing } = rules.kebijaksanaan
  const present = new Set(dates)
  const bonuses: { date: string; count: number }[] = []
  const reached = new Map<number, string>()
  let count = 0
  let best = 0
  let recent: boolean[] = []
  const first = [...present].sort()[0]
  if (!first) return { current: 0, best: 0, bonuses, reached }

  for (const day of eachDay(first, today)) {
    const filled = present.has(day)
    recent.push(filled)
    if (recent.length > streakWindowDays) recent.shift()
    if (filled) {
      count++
      best = Math.max(best, count)
      if (!reached.has(count)) reached.set(count, day)
      if (count % streakEvery === 0) bonuses.push({ date: day, count })
    } else if (count === 0 || recent.filter(x => !x).length > streakMaxMissing) {
      count = 0
      recent = []
    }
  }
  return { current: count, best, bonuses, reached }
}

export function questTarget(history: number[], range: { min: number; max: number }, multiplier: number) {
  const average = history.reduce((sum, value) => sum + value, 0) / history.length
  return Math.min(range.max, Math.max(range.min, Math.round(average * multiplier)))
}

const questKinds = [
  { kind: 'runs', attribute: 'stamina', match: (e: SourceEvent) => e.source === 'fit' && e.type === 'run', amount: () => 1, label: (n: number) => `${n} kali lari` },
  { kind: 'minutes', attribute: 'intelek', match: (e: SourceEvent) => e.source === 'learn' && e.type === 'session', amount: (e: SourceEvent) => e.value, label: (n: number) => `${n} menit belajar` },
  { kind: 'nights', attribute: 'kebijaksanaan', match: (e: SourceEvent) => e.source === 'diary' && e.type === 'entry', amount: () => 1, label: (n: number) => `${n} malam Catatan Malam` }
] as const

export function buildQuests(events: SourceEvent[], rules: Rules, today: string): Quest[] {
  const relevant = events.filter(e => questKinds.some(q => q.match(e)) && e.date <= today)
  if (relevant.length === 0) return []
  const daily = new Map<string, number>()
  for (const event of relevant) {
    const quest = questKinds.find(q => q.match(event))!
    const key = `${quest.kind}|${event.date}`
    daily.set(key, (daily.get(key) ?? 0) + quest.amount(event))
  }
  const dayTotal = (kind: string, date: string) => daily.get(`${kind}|${date}`) ?? 0
  const weekTotal = (kind: string, week: string) => eachDay(week, addDays(week, 6)).reduce((sum, day) => sum + dayTotal(kind, day), 0)

  const quests: Quest[] = []
  const firstWeek = weekStart(relevant.map(e => e.date).sort()[0])
  for (let week = firstWeek; week <= weekStart(today); week = addDays(week, 7)) {
    for (const quest of questKinds) {
      const history = Array.from({ length: rules.quest.lookbackWeeks }, (_, i) => weekTotal(quest.kind, addDays(week, -7 * (i + 1))))
      const target = questTarget(history, rules.quest[quest.kind], rules.quest.multiplier)
      let progress = 0
      let doneDate: string | null = null
      for (const day of eachDay(week, addDays(week, 6))) {
        if (day > today) break
        progress += dayTotal(quest.kind, day)
        if (!doneDate && progress >= target) doneDate = day
      }
      quests.push({ id: `${week}:${quest.kind}`, week, kind: quest.kind, attribute: quest.attribute, label: quest.label(target), target, progress: Math.round(progress), doneDate })
    }
  }
  return quests
}

function candidatesFrom(events: SourceEvent[], rules: Rules, today: string) {
  const { stamina, intelek, kebijaksanaan, disiplin, kekayaan } = rules
  const list: Candidate[] = []
  const add = (candidate: Candidate) => list.push({ ...candidate, raw: Math.round(candidate.raw) })
  const of = (source: string, type: string) => events.filter(e => e.source === source && e.type === type)

  const runs = of('fit', 'run')
  const scheduledDays = new Set<string>()
  for (const run of runs) {
    add({ date: run.date, attribute: 'stamina', source: 'fit', rule: 'lari', group: 'run', eventId: run.id, note: km(run.value), raw: stamina.run.base + stamina.run.perKm * run.value, ruleCap: stamina.run.dailyCap })
    if (run.meta.scheduled && !scheduledDays.has(run.date)) {
      scheduledDays.add(run.date)
      add({ date: run.date, attribute: 'stamina', source: 'fit', rule: 'lari terjadwal', group: 'run', eventId: run.id, note: 'hari terjadwal', raw: stamina.run.scheduledBonus })
    }
  }
  const longestByWeek = new Map<string, SourceEvent>()
  for (const run of runs) {
    const week = weekStart(run.date)
    const current = longestByWeek.get(week)
    if (!current || run.value > current.value) longestByWeek.set(week, run)
  }
  for (const [week, run] of longestByWeek) {
    if (addDays(week, 6) >= today) continue
    add({ date: run.date, attribute: 'stamina', source: 'fit', rule: 'lari terjauh minggu', group: 'run', eventId: run.id, note: `minggu ${week}, ${km(run.value)}`, raw: stamina.run.weeklyLongestBonus })
  }
  for (const session of of('fit', 'strength')) {
    add({ date: session.date, attribute: 'stamina', source: 'fit', rule: 'latihan beban', group: 'strength', eventId: session.id, note: String(session.meta.activityType ?? ''), raw: stamina.strength.perSession, ruleCap: stamina.strength.perSession * stamina.strength.maxPerDay })
  }
  for (const sport of of('fit', 'sport')) {
    add({ date: sport.date, attribute: 'stamina', source: 'fit', rule: 'olahraga lain', group: sport.meta.sport === 'swim' ? 'swim' : 'other', eventId: sport.id, note: String(sport.meta.activityType ?? ''), raw: stamina.otherSport.perSession, ruleCap: stamina.otherSport.perSession * stamina.otherSport.maxPerDay })
  }
  for (const sleep of of('fit', 'sleep')) {
    if (sleep.value < stamina.sleep.minHours) continue
    add({ date: sleep.date, attribute: 'stamina', source: 'fit', rule: 'tidur', group: 'body', eventId: sleep.id, note: `${sleep.value} jam`, raw: stamina.sleep.exp })
  }
  for (const meal of of('fit', 'protein')) {
    add({ date: meal.date, attribute: 'stamina', source: 'fit', rule: 'protein', group: 'body', eventId: meal.id, note: 'target protein', raw: stamina.protein.exp })
  }

  const learnGroup = (event: SourceEvent) => `learn:${event.meta.category ?? 'lainnya'}`
  for (const session of of('learn', 'session')) {
    add({ date: session.date, attribute: 'intelek', source: 'learn', rule: 'menit belajar', group: learnGroup(session), eventId: session.id, note: `${session.value} menit · ${session.meta.trackName}`, raw: session.value * intelek.minuteExp, ruleCap: intelek.minuteDailyCap })
  }
  for (const topic of of('learn', 'topic_done')) {
    add({ date: topic.date, attribute: 'intelek', source: 'learn', rule: 'topik selesai', group: learnGroup(topic), eventId: topic.id, note: String(topic.meta.title ?? ''), raw: intelek.topicDone })
  }
  for (const studyCase of of('learn', 'case_done')) {
    add({ date: studyCase.date, attribute: 'intelek', source: 'learn', rule: 'study case selesai', group: learnGroup(studyCase), eventId: studyCase.id, note: String(studyCase.meta.title ?? ''), raw: intelek.studyCaseDone })
  }

  const entries = of('diary', 'entry')
  for (const entry of entries) {
    const backfilled = entry.meta.backfilled === true
    add({ date: entry.date, attribute: 'kebijaksanaan', source: 'diary', rule: backfilled ? 'entri susulan' : 'entri', group: 'diary', eventId: entry.id, note: '', raw: backfilled ? kebijaksanaan.backfilledEntry : kebijaksanaan.entry })
  }
  for (const bonus of diaryStreak(entries.map(e => e.date), rules, today).bonuses) {
    add({ date: bonus.date, attribute: 'kebijaksanaan', source: 'diary', rule: 'bonus streak', group: 'diary', eventId: null, note: `streak ${bonus.count} hari`, raw: kebijaksanaan.streakBonus })
  }

  for (const item of of('schedule', 'item_done')) {
    add({ date: item.date, attribute: 'disiplin', source: 'schedule', rule: 'item jadwal', group: 'schedule', eventId: item.id, note: String(item.meta.module ?? ''), raw: disiplin.scheduleItem, ruleCap: disiplin.scheduleDailyCap })
  }
  for (const day of of('timesheet', 'workday')) {
    add({ date: day.date, attribute: 'disiplin', source: 'timesheet', rule: 'hari kerja', group: 'timesheet', eventId: day.id, note: '', raw: disiplin.workday })
  }

  const perDay = (items: SourceEvent[]) => {
    const days = new Map<string, SourceEvent[]>()
    for (const item of items) days.set(item.date, [...(days.get(item.date) ?? []), item])
    return days
  }
  for (const [date, items] of perDay(of('finance', 'transaction'))) {
    add({ date, attribute: 'kekayaan', source: 'finance', rule: 'transaksi keuangan', group: 'finance', eventId: items[0].id, note: `${items.length} transaksi`, raw: kekayaan.financeDay })
  }
  for (const budget of of('finance', 'budget_kept')) {
    add({ date: budget.date, attribute: 'kekayaan', source: 'finance', rule: 'budget terjaga', group: 'finance', eventId: budget.id, note: `bulan ${budget.meta.month}`, raw: kekayaan.budgetKept })
  }
  for (const [date, items] of perDay(of('stock', 'activity'))) {
    add({ date, attribute: 'kekayaan', source: 'stock', rule: 'catatan saham', group: 'stock', eventId: items[0].id, note: `${items.length} catatan`, raw: kekayaan.stockDay })
  }
  return list
}

export function applyCaps(candidates: Candidate[], rules: Rules): ExpEntry[] {
  const ruleUsed = new Map<string, number>()
  const attributeUsed = new Map<string, number>()
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => a.candidate.date.localeCompare(b.candidate.date) || a.index - b.index)
    .map(({ candidate }) => {
      const { ruleCap, exempt, ...entry } = candidate
      const ruleKey = `${entry.date}|${entry.rule}`
      const attributeKey = `${entry.date}|${entry.attribute}`
      const attributeCap = rules.attributes[entry.attribute].dailyCap
      let awarded = entry.raw
      if (ruleCap !== undefined) awarded = Math.min(awarded, Math.max(0, ruleCap - (ruleUsed.get(ruleKey) ?? 0)))
      if (!exempt && attributeCap !== null) awarded = Math.min(awarded, Math.max(0, attributeCap - (attributeUsed.get(attributeKey) ?? 0)))
      ruleUsed.set(ruleKey, (ruleUsed.get(ruleKey) ?? 0) + awarded)
      attributeUsed.set(attributeKey, (attributeUsed.get(attributeKey) ?? 0) + awarded)
      return { ...entry, awarded, capped: entry.raw - awarded }
    })
}

export function buildExp(events: SourceEvent[], rules: Rules, today: string) {
  const past = events.filter(e => e.date <= today)
  const quests = buildQuests(past, rules, today)
  const candidates = candidatesFrom(past, rules, today)
  for (const quest of quests) {
    if (!quest.doneDate) continue
    candidates.push({ date: quest.doneDate, attribute: quest.attribute, source: 'quest', rule: 'quest', group: 'quest', eventId: null, note: `${quest.label} (minggu ${quest.week})`, raw: rules.quest.exp, exempt: true })
  }
  return { entries: applyCaps(candidates, rules), quests }
}
