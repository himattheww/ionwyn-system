import { useMemo } from 'react'
import { monthGridDates } from '../../../core/src'
import type { Item } from '../../../core/src'
import { monthLabel } from '../lib/format'

interface Props {
  month: string
  selected: string
  today: string
  items: Item[]
  onSelect: (date: string) => void
  onPrev: () => void
  onNext: () => void
}

const weekdays = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const maxDots = 4

const dotClass = (item: Item, today: string) => {
  if (item.status === 'selesai') return 'selesai'
  if (item.status === 'dilewati') return 'dilewati'
  return item.date < today ? 'overdue' : 'terencana'
}

export function MonthGrid({ month, selected, today, items, onSelect, onPrev, onNext }: Props) {
  const dates = useMemo(() => monthGridDates(month), [month])
  const byDate = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const item of items) {
      if (item.status === 'digeser') continue
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [items])

  return (
    <section className="side-block month">
      <div className="bar">
        <strong>{monthLabel(month)}</strong>
        <div>
          <button onClick={onPrev} aria-label="Bulan sebelumnya">
            ‹
          </button>
          <button onClick={onNext} aria-label="Bulan berikutnya">
            ›
          </button>
        </div>
      </div>
      <div>
        <div className="grid head">
          {weekdays.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div className="grid days">
          {dates.map((date) => {
            const list = byDate.get(date) ?? []
            const inMonth = date.slice(0, 7) === month.slice(0, 7)
            const classes = [
              'cell',
              inMonth ? '' : 'out',
              date === today ? 'today' : '',
              date === selected ? 'selected' : '',
            ]
            return (
              <button key={date} className={classes.filter(Boolean).join(' ')} onClick={() => onSelect(date)}>
                <span className="day">{Number(date.slice(8))}</span>
                <span className="dots">
                  {list.slice(0, maxDots).map((item) => (
                    <i key={item.id} className={`dot ${dotClass(item, today)}`} />
                  ))}
                  {list.length > maxDots && <small>+{list.length - maxDots}</small>}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="legend">
        <span>
          <i className="dot selesai" />
          selesai
        </span>
        <span>
          <i className="dot" />
          terencana
        </span>
        <span>
          <i className="dot overdue" />
          perlu dijawab
        </span>
        <span>
          <i className="dot dilewati" />
          dilewati
        </span>
      </div>
    </section>
  )
}
