import type { Item } from '../../jadwal/core/src/index.ts'

export type FactKind = 'run' | 'strength' | 'swim' | 'diary' | 'learn' | 'work'

export interface Fact {
  source: 'fit' | 'diary' | 'learn' | 'timesheet'
  kind: FactKind
  ref: string
  date: string
  at: Date
  trackId?: string
  value: number | null
  unit: string | null
}

const kindByType: Record<string, FactKind> = {
  run_done: 'run',
  strength_done: 'strength',
  swim_done: 'swim',
  diary_done: 'diary',
  learn_done: 'learn',
  work_done: 'work'
}

export const linkedActivityTypes = [...Object.keys(kindByType), 'learn:']

export function wants(activityType: string | null): ((fact: Fact) => boolean) | null {
  if (!activityType) return null
  const kind = kindByType[activityType]
  if (kind) return fact => fact.kind === kind
  const track = activityType.match(/^learn:(\d+)$/)?.[1]
  if (track) return fact => fact.kind === 'learn' && fact.trackId === track
  return null
}

export function kindFor(activityType: string | null): FactKind | null {
  if (!activityType) return null
  return kindByType[activityType] ?? (/^learn:\d+$/.test(activityType) ? 'learn' : null)
}

export function fitKind(type: string): FactKind | null {
  if (type.includes('running')) return 'run'
  if (type === 'strength_training') return 'strength'
  if (type.includes('swimming')) return 'swim'
  return null
}

export function matchItems(items: Item[], facts: Fact[], usedRefs: Set<string>) {
  const used = new Set(usedRefs)
  const pairs: { item: Item; fact: Fact }[] = []
  const planned = items
    .filter(item => item.status === 'terencana' && wants(item.activityType))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
  for (const item of planned) {
    const accepts = wants(item.activityType)!
    const fact = facts
      .filter(f => f.date === item.date && !used.has(f.ref) && accepts(f))
      .sort((a, b) => a.at.getTime() - b.at.getTime())[0]
    if (!fact) continue
    used.add(fact.ref)
    pairs.push({ item, fact })
  }
  return pairs
}

export function runTemplateTitle(label: string) {
  return `Lari: ${label}`
}

export const scheduleWeekday = (fitWeekday: number) => fitWeekday % 7
