import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  buildDay,
  completeItem,
  copyWeek,
  defaultSettings,
  dueNotices,
  formatDate,
  generateRange,
  generateWeek,
  markNotified,
  minutesOfDay,
  monthGridDates,
  monthStart,
  parseDate,
  shiftItem,
  skipItem,
  splitItem,
  startIdle,
  stopIdle,
  toHHmm,
  toMinutes,
  unanswered,
  weekStart,
} from '../../../core/src'
import type { ActivityLog, Item, Module, PlannerSettings, RoutineTemplate, Slot } from '../../../core/src'
import { store } from '../lib/supabase'
import { dateLabel, durationLabel, longDateLabel, newId, relativeLabel } from '../lib/format'
import { markSent, showNotification, wasSent } from '../lib/notify'
import { ItemCard } from './ItemCard'
import { AddItem } from './AddItem'
import { ShiftDialog } from './ShiftDialog'
import { IdleBar } from './IdleBar'
import { DraftPanel } from './DraftPanel'
import { Routines } from './Routines'
import { Settings } from './Settings'
import { History } from './History'
import { NoticeBar } from './NoticeBar'
import { MonthGrid } from './MonthGrid'
import type { Toast } from './NoticeBar'

type Screen = 'home' | 'routines' | 'history' | 'settings'

type Row =
  | { type: 'item'; at: number; item: Item }
  | { type: 'gap'; at: number; end: number }
  | { type: 'now'; at: number }

const minGapMin = 15
const maxPopups = 3
const rowOrder = { gap: 0, item: 1, now: 2 }

export function Planner({ onSignOut }: { onSignOut: () => void }) {
  const [now, setNow] = useState(() => new Date())
  const today = formatDate(now)
  const tomorrow = addDays(today, 1)
  const [screen, setScreen] = useState<Screen>('home')
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<Item[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [idle, setIdle] = useState<ActivityLog | null>(null)
  const [settings, setSettings] = useState<PlannerSettings>(defaultSettings)
  const [templates, setTemplates] = useState<RoutineTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [month, setMonth] = useState(() => monthStart(formatDate(new Date())))
  const [showCalendar, setShowCalendar] = useState(true)
  const [adding, setAdding] = useState(false)
  const [shifting, setShifting] = useState<Item | null>(null)
  const notifying = useRef(false)

  const load = useCallback(async () => {
    const anchor = date < today ? date : today
    const edge = date > today ? date : today
    const grid = monthGridDates(month)
    const from = addDays(anchor, -30) < (grid[0] as string) ? addDays(anchor, -30) : (grid[0] as string)
    const lastCell = grid[grid.length - 1] as string
    const to = addDays(edge, 14) > lastCell ? addDays(edge, 14) : lastCell
    try {
      const [loadedItems, loadedLogs, open, loadedSettings, loadedTemplates] = await Promise.all([
        store.itemsBetween(from, to),
        store.logsBetween(parseDate(addDays(today, -30)), parseDate(addDays(today, 2))),
        store.openIdle(),
        store.settings(),
        store.templates(),
      ])
      setItems(loadedItems)
      setLogs(loadedLogs)
      setIdle(open)
      setSettings(loadedSettings)
      setTemplates(loadedTemplates)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [date, today, month])

  useEffect(() => {
    setMonth(monthStart(date))
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const mutate = async (task: () => Promise<void>) => {
    setError(null)
    setNotice(null)
    try {
      await task()
      await load()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'aksi gagal')
    }
  }

  const draftFor = useCallback(
    (target: string) => generateWeek(templates, target, items, new Date(), newId).filter((item) => item.date === target),
    [templates, items],
  )
  const draftSelected = useMemo(() => draftFor(date), [draftFor, date])
  const draftTomorrow = useMemo(() => (date === today ? draftFor(tomorrow) : []), [draftFor, date, today, tomorrow])

  useEffect(() => {
    if (loading || notifying.current) return
    const sent = { morning: wasSent('morning', today), evening: wasSent('evening', today) }
    const due = dueNotices(items, now, settings, sent, draftTomorrow.length)
    if (due.length === 0) return

    notifying.current = true
    const run = async () => {
      try {
        const stamped = markNotified(items, due, now)
        if (stamped.length > 0) await store.saveItems(stamped)
        for (const notice of due) {
          if (notice.kind === 'morning' || notice.kind === 'evening') markSent(notice.kind, today)
        }
        setToasts((current) => [
          ...current,
          ...due.map((notice) => ({ id: `${notice.key}:${now.getTime()}`, title: notice.title, body: notice.body })),
        ])
        if (due.length > maxPopups) {
          await showNotification(`${due.length} hal perlu perhatian`, due.map((notice) => notice.title).join(' · '))
        } else {
          await Promise.all(due.map((notice) => showNotification(notice.title, notice.body)))
        }
        if (stamped.length > 0) await load()
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'notifikasi gagal')
      } finally {
        notifying.current = false
      }
    }
    run()
  }, [now, items, settings, loading, today, draftTomorrow.length, load])

  const view = useMemo(() => buildDay(items, date, settings), [items, date, settings])
  const late = useMemo(() => unanswered(items, now), [items, now])
  const lateIds = useMemo(() => new Set(late.map((item) => item.id)), [late])
  const lateElsewhere = late.filter((item) => item.date !== date)
  const gaps = view.gaps.filter((gap) => gap.end - gap.start >= minGapMin)

  const nowMinutes = minutesOfDay(now)
  const conflict = idle
    ? (items.find(
        (item) =>
          item.date === today &&
          item.status === 'terencana' &&
          item.startTime !== null &&
          toMinutes(item.startTime) <= nowMinutes &&
          nowMinutes < toMinutes(item.startTime) + item.durationMin,
      ) ?? null)
    : null

  const timeline = useMemo(() => {
    const rows: Row[] = [
      ...view.timed.map((item): Row => ({ type: 'item', at: toMinutes(item.startTime as string), item })),
      ...gaps.map((gap): Row => ({ type: 'gap', at: gap.start, end: gap.end })),
    ]
    if (date === today) rows.push({ type: 'now', at: nowMinutes })
    return rows.sort((a, b) => a.at - b.at || rowOrder[a.type] - rowOrder[b.type])
  }, [view.timed, gaps, date, today, nowMinutes])

  const dayItems = [...view.timed, ...view.anytime].filter((item) => item.status !== 'digeser')
  const doneCount = dayItems.filter((item) => item.status === 'selesai').length
  const lateHere = dayItems.filter((item) => lateIds.has(item.id)).length
  const freeMinutes = gaps.reduce((total, gap) => total + gap.end - gap.start, 0)
  const summary = [
    dayItems.length > 0 ? `${doneCount} dari ${dayItems.length} selesai` : 'Belum ada jadwal',
    lateHere > 0 ? `${lateHere} perlu dijawab` : null,
    `${durationLabel(freeMinutes)} luang`,
  ]
    .filter(Boolean)
    .join('  ·  ')
  const relative = relativeLabel(date, today)

  const addDrafts = (drafts: Item[]) =>
    mutate(async () => {
      await store.saveItems(drafts)
      setNotice(`${drafts.length} item ditambahkan`)
    })

  const fillRoutines = (weeks: number) =>
    mutate(async () => {
      const created = generateRange(templates, date, weeks, items, new Date(), newId, today)
      await store.saveItems(created)
      setNotice(
        created.length > 0
          ? `${created.length} item dari rutinitas ditambahkan`
          : 'Rutinitas untuk rentang ini sudah lengkap',
      )
    })

  const copyLastWeek = () =>
    mutate(async () => {
      const copied = copyWeek(items, addDays(weekStart(date), -7), date, new Date(), newId)
      await store.saveItems(copied)
      setNotice(
        copied.length > 0 ? `${copied.length} item disalin dari minggu lalu` : 'Tidak ada item baru untuk disalin',
      )
    })

  const complete = (item: Item) =>
    mutate(async () => {
      const result = completeItem(item, new Date(), newId)
      await store.saveLog(result.log)
      await store.saveItems([result.item])
    })

  const skip = (item: Item) => mutate(() => store.saveItems([skipItem(item)]))

  const shift = (item: Item, slot: Slot) =>
    mutate(async () => {
      const { original, next } = shiftItem(item, slot, new Date(), newId)
      await store.saveItems([original, next])
      setShifting(null)
    })

  const split = (item: Item, parts: { title: string; durationMin: number }[], target: string) =>
    mutate(async () => {
      const result = splitItem(item, parts, target, new Date(), newId)
      await store.saveItems([result.original, ...result.parts])
      setShifting(null)
    })

  const drop = (item: Item) =>
    mutate(async () => {
      await store.saveItems([skipItem(item)])
      setShifting(null)
    })

  const startIdleSession = (module: Module, note: string) =>
    mutate(async () => {
      const log = startIdle(idle ? [idle] : [], { module, note: note.trim() || null }, new Date(), newId)
      await store.saveLog(log)
    })

  const stopIdleSession = () =>
    mutate(async () => {
      if (idle) await store.saveLog(stopIdle(idle, new Date()))
    })

  const dismissToast = (id: string) => setToasts((current) => current.filter((toast) => toast.id !== id))

  if (screen === 'routines') {
    return (
      <Routines
        templates={templates}
        onSave={(next) => mutate(() => store.saveTemplates(next))}
        onDelete={(id) => mutate(() => store.deleteTemplate(id))}
        onBack={() => setScreen('home')}
      />
    )
  }

  if (screen === 'history') {
    return (
      <History
        items={items}
        logs={logs}
        today={today}
        onAddLog={(log) => store.saveLog(log).then(load)}
        onBack={() => setScreen('home')}
      />
    )
  }

  if (screen === 'settings') {
    return (
      <Settings
        settings={settings}
        onSave={(next) => store.saveSettings(next).then(load)}
        onBack={() => setScreen('home')}
      />
    )
  }

  const card = (item: Item, dayLabel?: string) => (
    <ItemCard
      key={item.id}
      item={item}
      overdue={lateIds.has(item.id)}
      dayLabel={dayLabel}
      onComplete={complete}
      onSkip={skip}
      onShift={setShifting}
    />
  )

  return (
    <main className="app">
      <NoticeBar toasts={toasts} onDismiss={dismissToast} />

      <header className="topnav">
        <span className="brand">Jadwal</span>
        <button className="link" aria-current="page">
          Hari ini
        </button>
        <button className="link" onClick={() => setScreen('routines')}>
          Rutinitas
        </button>
        <button className="link" onClick={() => setScreen('history')}>
          Riwayat
        </button>
        <button className="link" onClick={() => setScreen('settings')}>
          Pengaturan
        </button>
        <button className="link" aria-pressed={showCalendar} onClick={() => setShowCalendar(!showCalendar)}>
          Kalender
        </button>
        <button onClick={onSignOut}>Keluar</button>
      </header>

      <section className="hero">
        <div className="hero-text">
          <div className="kicker">{relative ? `${relative} · ${date}` : date}</div>
          <h1 className="hero-title">{longDateLabel(date)}</h1>
          <div className="hero-summary">{loading ? 'Memuat…' : summary}</div>
        </div>
        <div className="hero-actions">
          <button className="icon" onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya">
            ‹
          </button>
          <button className="icon" onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya">
            ›
          </button>
          {date !== today && <button onClick={() => setDate(today)}>Hari ini</button>}
          <button className="primary" onClick={() => setAdding(true)}>
            Tambah jadwal <span>+</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="notice error">
          <span>{error}</span>
          <button className="ghost" onClick={() => setError(null)}>
            Tutup
          </button>
        </div>
      )}
      {notice && (
        <div className="notice">
          <span>{notice}</span>
          <button className="ghost" onClick={() => setNotice(null)}>
            Tutup
          </button>
        </div>
      )}

      <div className="layout">
        <aside className="side">
          {showCalendar && (
            <MonthGrid
              month={month}
              selected={date}
              today={today}
              items={items}
              onSelect={setDate}
              onPrev={() => setMonth(addMonths(month, -1))}
              onNext={() => setMonth(addMonths(month, 1))}
            />
          )}

          <IdleBar
            idle={idle}
            now={now}
            anytimeCount={items.filter((i) => i.date === today && i.startTime === null && i.status === 'terencana').length}
            conflictTitle={conflict?.title ?? null}
            onStart={startIdleSession}
            onStop={stopIdleSession}
          />

          <section className="side-block">
            <h3>Minggu ini</h3>
            <button className="block" onClick={() => fillRoutines(1)} disabled={templates.length === 0}>
              Isi minggu ini dari rutinitas <span>›</span>
            </button>
            <button className="block" onClick={() => fillRoutines(4)} disabled={templates.length === 0}>
              Isi 4 minggu ke depan <span>›</span>
            </button>
            <button className="block" onClick={copyLastWeek}>
              Salin minggu lalu <span>›</span>
            </button>
            {templates.length === 0 && <p className="meta">Buat rutinitas dulu di menu Rutinitas.</p>}
          </section>
        </aside>

        <div className="main">
          {lateElsewhere.length > 0 && (
            <section>
              <div className="section-head alert">
                <h2>Perlu dijawab</h2>
                <span>{lateElsewhere.length} dari hari lain</span>
              </div>
              <ul className="timeline">{lateElsewhere.map((item) => card(item, dateLabel(item.date, today)))}</ul>
            </section>
          )}

          <DraftPanel
            key={`draft-${date}-${draftSelected.length}`}
            label="Rutinitas hari ini belum masuk jadwal"
            drafts={draftSelected}
            onAccept={addDrafts}
          />
          <DraftPanel
            key={`draft-${tomorrow}-${draftTomorrow.length}`}
            label="Draf besok dari rutinitas"
            drafts={draftTomorrow}
            onAccept={addDrafts}
          />

          <section>
            <div className="section-head">
              <h2>Jadwal</h2>
              {view.timed.length > 0 && <span>{view.timed.length} item berjam</span>}
            </div>
            {view.timed.length === 0 && <p className="empty">Belum ada jadwal berjam.</p>}
            <ul className="timeline">
              {timeline.map((row) => {
                if (row.type === 'item') return card(row.item)
                if (row.type === 'gap')
                  return (
                    <li key={`gap-${row.at}`} className="gap-row">
                      <span>{toHHmm(row.at)}</span>
                      <span>Waktu luang · {durationLabel(row.end - row.at)}</span>
                    </li>
                  )
                return (
                  <li key="now" className="now-row">
                    <span>{toHHmm(row.at)}</span>
                    <span>Sekarang</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <div className="section-head">
              <h2>Kapan saja</h2>
              <span>tanpa jam</span>
            </div>
            {view.anytime.length === 0 ? (
              <p className="empty">Kosong.</p>
            ) : (
              <ul className="timeline">{view.anytime.map((item) => card(item))}</ul>
            )}
          </section>
        </div>
      </div>

      <footer className="footnote">
        <span>
          Jam tenang {settings.quietStart}–{settings.quietEnd}
        </span>
        <span>
          Ringkasan pagi {settings.morningSummary} · malam {settings.eveningSummary}
        </span>
        <span>Pengingat {settings.remindBeforeMin} mnt sebelum mulai</span>
      </footer>

      {adding && (
        <AddItem date={date} onAdd={(item) => store.saveItems([item]).then(load)} onClose={() => setAdding(false)} />
      )}

      {shifting && (
        <ShiftDialog
          item={shifting}
          items={items}
          settings={settings}
          now={now}
          onShift={(slot) => shift(shifting, slot)}
          onSplit={(parts, target) => split(shifting, parts, target)}
          onDrop={() => drop(shifting)}
          onClose={() => setShifting(null)}
        />
      )}
    </main>
  )
}
