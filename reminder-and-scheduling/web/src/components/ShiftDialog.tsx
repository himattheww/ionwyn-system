import { useMemo, useState } from 'react'
import { formatDate, needsShiftDecision, suggestSlots, toHHmm, toMinutes } from '../../../core/src'
import type { Item, PlannerSettings, Slot } from '../../../core/src'
import { dateLabel, slotLabel, timeRange } from '../lib/format'

interface Props {
  item: Item
  items: Item[]
  settings: PlannerSettings
  now: Date
  onShift: (slot: Slot) => void
  onSplit: (parts: { title: string; durationMin: number }[], date: string) => void
  onDrop: () => void
  onClose: () => void
}

type Step = 'decide' | 'slots' | 'split'

export function ShiftDialog({ item, items, settings, now, onShift, onSplit, onDrop, onClose }: Props) {
  const [step, setStep] = useState<Step>(needsShiftDecision(item, settings) ? 'decide' : 'slots')
  const today = formatDate(now)
  const slots = useMemo(() => suggestSlots(items, item, now, settings), [items, item, now, settings])
  const [manualDate, setManualDate] = useState(item.date)
  const [manualTime, setManualTime] = useState(item.startTime ?? '')
  const half = Math.max(5, Math.round(item.durationMin / 2 / 5) * 5)
  const [parts, setParts] = useState([
    { title: `${item.title} 1`, durationMin: half },
    { title: `${item.title} 2`, durationMin: half },
  ])
  const [splitDate, setSplitDate] = useState(item.date)

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="dialog">
        <div className="kicker">
          Geser · {dateLabel(item.date, today)} {timeRange(item)}
        </div>
        <h2>{item.title}</h2>

        {step === 'decide' && (
          <>
            <p>Sudah digeser {item.rescheduleCount} kali. Mau diapakan?</p>
            <div className="stack">
              <button onClick={() => setStep('slots')}>
                Pertahankan, geser lagi <span>›</span>
              </button>
              <button onClick={() => setStep('split')}>
                Pecah jadi item lebih kecil <span>›</span>
              </button>
              <button className="danger" onClick={onDrop}>
                Buang <span>×</span>
              </button>
            </div>
          </>
        )}

        {step === 'slots' && (
          <>
            {slots.length === 0 ? (
              <p className="meta">Tidak ada slot kosong yang cocok. Pilih sendiri di bawah.</p>
            ) : (
              <p className="meta">Slot kosong yang cocok</p>
            )}
            {slots.length > 0 && (
              <ul className="slot-list">
                {slots.map((slot) => (
                  <li key={`${slot.date}${slot.startTime}`}>
                    <button className="slot" onClick={() => onShift(slot)}>
                      {slotLabel(slot, today)}
                      <span>
                        {slot.startTime
                          ? `${slot.startTime}–${toHHmm(toMinutes(slot.startTime) + item.durationMin)}`
                          : 'kapan saja'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row">
              <label>
                Tanggal
                <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
              </label>
              <label>
                Jam
                <input type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
              </label>
              <button className="primary" onClick={() => onShift({ date: manualDate, startTime: manualTime || null })}>
                Geser ke sini
              </button>
            </div>
          </>
        )}

        {step === 'split' && (
          <>
            {parts.map((part, index) => (
              <div className="row" key={index}>
                <label style={{ flex: 3 }}>
                  Judul
                  <input
                    value={part.title}
                    onChange={(e) =>
                      setParts(parts.map((p, i) => (i === index ? { ...p, title: e.target.value } : p)))
                    }
                  />
                </label>
                <label>
                  Durasi (mnt)
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={part.durationMin}
                    onChange={(e) =>
                      setParts(parts.map((p, i) => (i === index ? { ...p, durationMin: Number(e.target.value) } : p)))
                    }
                  />
                </label>
              </div>
            ))}
            <label>
              Dikerjakan tanggal
              <input type="date" value={splitDate} onChange={(e) => setSplitDate(e.target.value)} />
            </label>
            <button className="primary block" onClick={() => onSplit(parts, splitDate)}>
              Pecah <span>›</span>
            </button>
          </>
        )}

        <div className="row end">
          <button onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}
