import type { Item, PlannerSettings } from './types'
import { formatDate, isQuiet, minutesOfDay, toMinutes } from './time'
import { unanswered } from './day'

export type NoticeKind = 'reminder' | 'ask' | 'reask' | 'morning' | 'evening'

export interface Notice {
  key: string
  kind: NoticeKind
  title: string
  body: string
  itemId: string | null
}

export interface SentFlags {
  morning: boolean
  evening: boolean
}

const reaskAfterMs = 60 * 60_000
const morningCutoff = 12 * 60

const choices = (item: Item) => (item.kind === 'flexible' ? 'Selesai / Geser / Lewati' : 'Selesai / Lewati')

const titles = (items: Item[]) => items.map((item) => item.title).join(', ')

export const dueNotices = (
  items: Item[],
  now: Date,
  settings: PlannerSettings,
  sent: SentFlags,
  tomorrowDrafts = 0,
): Notice[] => {
  const minutes = minutesOfDay(now)
  if (isQuiet(minutes, settings.quietStart, settings.quietEnd)) return []

  const today = formatDate(now)
  const notices: Notice[] = []

  for (const item of items) {
    if (item.status !== 'terencana' || item.startTime === null) continue
    const start = toMinutes(item.startTime)
    const end = start + item.durationMin

    if (
      item.date === today &&
      item.remindedAt === null &&
      minutes >= start - settings.remindBeforeMin &&
      minutes < end
    ) {
      notices.push({
        key: `reminder:${item.id}`,
        kind: 'reminder',
        title: `Mulai ${item.startTime}: ${item.title}`,
        body: `${item.durationMin} menit`,
        itemId: item.id,
      })
    }

    const slotOver = item.date < today || (item.date === today && minutes >= end)
    if (slotOver && item.askedAt === null) {
      notices.push({
        key: `ask:${item.id}`,
        kind: 'ask',
        title: `Sudah selesai? ${item.title}`,
        body: choices(item),
        itemId: item.id,
      })
    } else if (
      item.askedAt !== null &&
      item.reaskedAt === null &&
      now.getTime() - new Date(item.askedAt).getTime() >= reaskAfterMs
    ) {
      notices.push({
        key: `reask:${item.id}`,
        kind: 'reask',
        title: `Belum dijawab: ${item.title}`,
        body: choices(item),
        itemId: item.id,
      })
    }
  }

  const todayItems = items.filter((item) => item.date === today && item.status !== 'digeser')
  const anytimePending = todayItems.filter((item) => item.startTime === null && item.status === 'terencana')

  if (!sent.morning && minutes >= toMinutes(settings.morningSummary) && minutes < morningCutoff) {
    const timed = todayItems.filter((item) => item.startTime !== null).length
    const backlog = unanswered(items, now).filter((item) => item.date < today).length
    const parts = [`${timed} jadwal berjam`]
    if (anytimePending.length > 0) parts.push(`kapan saja: ${titles(anytimePending)}`)
    if (backlog > 0) parts.push(`${backlog} belum terjawab sebelumnya`)
    notices.push({ key: 'morning', kind: 'morning', title: 'Jadwal hari ini', body: parts.join(' · '), itemId: null })
  }

  if (!sent.evening && minutes >= toMinutes(settings.eveningSummary)) {
    const parts: string[] = []
    if (anytimePending.length > 0) parts.push(`Belum dijawab hari ini: ${titles(anytimePending)}`)
    if (tomorrowDrafts > 0) parts.push(`${tomorrowDrafts} rutinitas siap masuk jadwal besok`)
    if (parts.length === 0) parts.push('Rencanakan jadwal besok')
    notices.push({ key: 'evening', kind: 'evening', title: 'Besok mau ngapain?', body: parts.join(' · '), itemId: null })
  }

  return notices
}

export const markNotified = (items: Item[], notices: Notice[], now: Date): Item[] => {
  const stamp = now.toISOString()
  return items.flatMap((item) => {
    const own = notices.filter((notice) => notice.itemId === item.id)
    if (own.length === 0) return []
    const next = { ...item }
    for (const notice of own) {
      if (notice.kind === 'reminder') next.remindedAt = stamp
      if (notice.kind === 'ask') next.askedAt = stamp
      if (notice.kind === 'reask') next.reaskedAt = stamp
    }
    return [next]
  })
}
