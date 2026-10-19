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

export function ItemCard({ item, overdue, dayLabel, onComplete, onSkip, onShift }: Props) {
  const planned = item.status === 'terencana'
  const fixed = item.kind === 'fixed'
  return (
    <li className={`item ${item.status}${overdue ? ' overdue' : ''}`}>
      {item.startTime === null ? (
        <div className="item-time anytime">{durationLabel(item.durationMin)}</div>
      ) : (
        <div className="item-time">
          {item.startTime}
          <span>{toHHmm(toMinutes(item.startTime) + item.durationMin)}</span>
        </div>
      )}
      <div className="item-body">
        <div className="item-text">
          <span className="item-title">{item.title}</span>
          <span className="tags">
            {dayLabel ? (
              <span className="tag accent">{dayLabel}</span>
            ) : (
              overdue && <span className="tag accent">perlu dijawab</span>
            )}
            <span className="tag">{item.module}</span>
            {fixed && <span className="tag line">tetap</span>}
            {item.rescheduleCount > 0 && <span className="tag line">digeser {item.rescheduleCount}x</span>}
            {!planned && <span className="tag ink">{statusLabel[item.status]}</span>}
          </span>
        </div>
        {planned && (
          <div className="item-actions">
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
            <button className="ghost" onClick={() => onSkip(item)}>
              Lewati
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
