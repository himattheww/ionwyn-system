import { useState } from 'react'
import { toHHmm, toMinutes } from '../../../core/src'
import type { Item } from '../../../core/src'
import { durationLabel } from '../lib/format'

interface Props {
  item: Item
  overdue: boolean
  dayLabel?: string
  onComplete: (item: Item) => void
  onSkip: (item: Item) => void
  onShift: (item: Item) => void
}

const statusLabel: Record<Item['status'], string> = {
  terencana: 'terencana',
  selesai: 'selesai',
  dilewati: 'dilewati',
  digeser: 'digeser',
}

const statusMark = (item: Item, overdue: boolean) => {
  if (overdue) return { symbol: '◆', label: 'perlu dijawab', tone: 'late' }
  if (item.status === 'selesai') return { symbol: '✓', label: 'selesai', tone: 'done' }
  if (item.status === 'dilewati') return { symbol: '—', label: 'dilewati', tone: 'skip' }
  return { symbol: '○', label: statusLabel[item.status], tone: 'plan' }
}

export function ItemCard({ item, overdue, dayLabel, onComplete, onSkip, onShift }: Props) {
  const planned = item.status === 'terencana'
  const fixed = item.kind === 'fixed'
  const [open, setOpen] = useState(false)
  const mark = statusMark(item, overdue)
  const showActions = planned && (overdue || open)
  const toggles = planned && !overdue
  const Row = toggles ? 'button' : 'div'
  return (
    <li className={`item ${item.status}${overdue ? ' overdue' : ''}`}>
      <Row
        className="item-row"
        onClick={toggles ? () => setOpen(!open) : undefined}
        aria-expanded={toggles ? showActions : undefined}
      >
        <span className="item-time">
          {item.startTime === null ? '--:--' : item.startTime}
          <small>{item.startTime === null ? durationLabel(item.durationMin) : toHHmm(toMinutes(item.startTime) + item.durationMin)}</small>
        </span>
        <span className="item-title">{item.title}</span>
        <span className="item-type">
          {item.activityType ?? 'manual'} · {item.module}
          {fixed && ' · tetap'}
          {item.rescheduleCount > 0 && ` · digeser ${item.rescheduleCount}x`}
          {dayLabel && <em>{dayLabel}</em>}
        </span>
        <span className={`item-status ${mark.tone}`}>
          <i aria-hidden="true">{mark.symbol}</i> {mark.label}
        </span>
      </Row>
      {showActions && (
        <div className="item-actions">
          {overdue && <p>Waktunya lewat dan belum ditandai. Pilih satu supaya jadwal tetap jujur.</p>}
          <button className="primary" onClick={() => onComplete(item)}>
            Selesai
          </button>
          <button
            onClick={() => onShift(item)}
            disabled={fixed}
            title={fixed ? 'Jadwal tetap tidak bisa digeser' : undefined}
          >
            Geser
          </button>
          <button onClick={() => onSkip(item)}>Lewati</button>
        </div>
      )}
    </li>
  )
}
