import { useState } from 'react'
import { modules } from '../../../core/src'
import type { ActivityLog, Module } from '../../../core/src'
import { durationLabel } from '../lib/format'

interface Props {
  idle: ActivityLog | null
  now: Date
  anytimeCount: number
  conflictTitle: string | null
  onStart: (module: Module, note: string) => void
  onStop: () => void
}

const clock = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export function IdleBar({ idle, now, anytimeCount, conflictTitle, onStart, onStop }: Props) {
  const [module, setModule] = useState<Module>('kerja')
  const [note, setNote] = useState('')

  if (idle) {
    const since = new Date(idle.occurredAt)
    const minutes = Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000))
    return (
      <section className="idle-active">
        <div className="kicker">Lagi kosong · sejak {clock(since)}</div>
        <div className="idle-elapsed">{minutes > 0 ? durationLabel(minutes) : 'baru mulai'}</div>
        <div>
          {idle.module}
          {idle.note ? ` · ${idle.note}` : ''}
        </div>
        {anytimeCount > 0 && <div>Ada {anytimeCount} item “kapan saja” hari ini.</div>}
        {conflictTitle && <div className="idle-conflict">“{conflictTitle}” sudah mulai. Stop kosong?</div>}
        <button onClick={onStop}>
          Stop <span>■</span>
        </button>
      </section>
    )
  }

  return (
    <section className="side-block">
      <h3>Lagi kosong</h3>
      <div className="idle-fields">
        <select value={module} onChange={(e) => setModule(e.target.value as Module)} aria-label="Modul">
          {modules.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <input placeholder="catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button
        className="block"
        onClick={() => {
          onStart(module, note)
          setNote('')
        }}
      >
        Mulai sesi kosong <span>›</span>
      </button>
    </section>
  )
}
