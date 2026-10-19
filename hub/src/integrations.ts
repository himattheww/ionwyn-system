import {
  addDays,
  completeItem,
  createTemplate,
  formatDate,
  parseDate,
  type ActivityLog,
  type Item,
  type RoutineTemplate,
  type Store
} from '../../reminder-and-scheduling/core/src/index.ts'
import { config } from './config.ts'
import { kindFor, matchItems, runTemplateTitle, scheduleWeekday, type Fact, type FactKind } from './match.ts'
import { newId, scheduleStore } from './schedule.ts'
import { diaryFacts, fitFacts, getJson, learnFacts, workFacts } from './sources.ts'

interface RelationStatus {
  id: string
  label: string
  lastRunAt: string | null
  lastOkAt: string | null
  lastError: string | null
  lastResult: string | null
}

const relations: { id: string; label: string; kinds: FactKind[]; facts: (from: string, to: string) => Promise<Fact[]> }[] = [
  { id: 'H4', label: 'Garmin menyelesaikan item latihan', kinds: ['run', 'strength', 'swim'], facts: fitFacts },
  { id: 'H5', label: 'Catatan Malam menyelesaikan item diary_done', kinds: ['diary'], facts: diaryFacts },
  { id: 'H6', label: 'Sesi Learn menyelesaikan item belajar', kinds: ['learn'], facts: learnFacts },
  { id: 'H8', label: 'Hadir Timesheet menyelesaikan item work_done', kinds: ['work'], facts: workFacts }
]

const status = new Map<string, RelationStatus>(
  [...relations, { id: 'H7', label: 'Pola lari Fitness menjadi rutinitas lari' }].map(r => [
    r.id,
    { id: r.id, label: r.label, lastRunAt: null, lastOkAt: null, lastError: null, lastResult: null }
  ])
)

export const integrationStatus = () => [...status.values()].sort((a, b) => a.id.localeCompare(b.id))

function record(id: string, result: { ok: string } | { error: unknown }) {
  const s = status.get(id)!
  const now = new Date().toISOString()
  s.lastRunAt = now
  if ('ok' in result) {
    s.lastOkAt = now
    s.lastError = null
    s.lastResult = result.ok
  } else {
    s.lastError = result.error instanceof Error ? result.error.message : String(result.error)
    console.error(`[${id}] ${s.lastError}`)
  }
}

async function complete(store: Store, item: Item, fact: Fact, existingLog: ActivityLog | undefined) {
  const { item: done, log } = completeItem(item, fact.at, newId)
  if (!existingLog) {
    await store.saveLog({
      ...log,
      value: fact.value ?? log.value,
      unit: fact.value != null ? fact.unit : log.unit,
      meta: { ...log.meta, source: fact.source, ref: fact.ref }
    })
  }
  await store.saveItems([done])
}

async function completeFromFacts(store: Store, items: Item[], logs: ActivityLog[], from: string, to: string) {
  const usedRefs = new Set(logs.map(l => l.meta.ref).filter((ref): ref is string => typeof ref === 'string'))
  const logByItem = new Map(logs.filter(l => l.itemId).map(l => [l.itemId!, l]))
  for (const relation of relations) {
    const relevant = items.filter(item => {
      const kind = kindFor(item.activityType)
      return item.status === 'terencana' && kind !== null && relation.kinds.includes(kind)
    })
    if (relevant.length === 0) {
      record(relation.id, { ok: 'tidak ada item terencana yang cocok' })
      continue
    }
    try {
      const pairs = matchItems(relevant, await relation.facts(from, to), usedRefs)
      for (const { item, fact } of pairs) {
        await complete(store, item, fact, logByItem.get(item.id))
        usedRefs.add(fact.ref)
        console.log(`[${relation.id}] ${item.date} "${item.title}" selesai dari ${fact.ref}`)
      }
      record(relation.id, { ok: `${pairs.length} item diselesaikan` })
    } catch (error) {
      record(relation.id, { error })
    }
  }
}

export function runTemplateChanges(pattern: Record<string, string>, templates: RoutineTemplate[], durationMin: number) {
  const managed = templates.filter(t => t.activityType === 'run_done')
  const changes: RoutineTemplate[] = []
  for (let day = 1; day <= 7; day++) {
    const weekday = scheduleWeekday(day)
    const label = pattern[String(day)]
    const [current] = managed.filter(t => t.weekday === weekday)
    if (label && !current) {
      changes.push(
        createTemplate(
          { weekday, title: runTemplateTitle(label), kind: 'flexible', durationMin, module: 'kesehatan', activityType: 'run_done' },
          newId
        )
      )
    } else if (label && current && (current.title !== runTemplateTitle(label) || !current.active)) {
      changes.push({ ...current, title: runTemplateTitle(label), active: true })
    } else if (!label && current?.active) {
      changes.push({ ...current, active: false })
    }
  }
  return changes
}

async function syncRunPattern(store: Store) {
  try {
    const { run_pattern } = await getJson<{ run_pattern: Record<string, string> }>(`${config.apps.fit}/api/settings`)
    const changes = runTemplateChanges(run_pattern, await store.templates(), config.runRoutine.durationMin)
    await store.saveTemplates(changes)
    record('H7', { ok: changes.length ? `${changes.length} rutinitas diperbarui` : 'rutinitas lari sudah sesuai' })
  } catch (error) {
    record('H7', { error })
  }
}

let running: Promise<void> | null = null

export function runIntegrations() {
  running ??= (async () => {
    const today = formatDate(new Date())
    const from = addDays(today, -config.lookbackDays)
    let store: Store
    try {
      store = await scheduleStore()
    } catch (error) {
      for (const id of status.keys()) record(id, { error })
      return
    }
    await syncRunPattern(store)
    try {
      const [items, logs] = await Promise.all([
        store.itemsBetween(from, today),
        store.logsBetween(parseDate(addDays(from, -1)), parseDate(addDays(today, 2)))
      ])
      await completeFromFacts(store, items, logs, from, today)
    } catch (error) {
      for (const r of relations) record(r.id, { error })
    }
  })().finally(() => {
    running = null
  })
  return running
}

export function scheduleIntegrations() {
  if (config.intervalMin <= 0) return console.log('Integrasi otomatis mati (INTEGRATION_INTERVAL_MIN=0).')
  const tick = () => runIntegrations().catch(error => console.error('Integrasi gagal:', error))
  setTimeout(tick, 15_000)
  setInterval(tick, config.intervalMin * 60_000).unref()
}
