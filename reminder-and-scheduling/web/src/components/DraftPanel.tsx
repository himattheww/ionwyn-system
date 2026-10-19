import { useState } from 'react'
import type { Item } from '../../../core/src'
import { timeRange } from '../lib/format'

interface Props {
  label: string
  drafts: Item[]
  onAccept: (items: Item[]) => void
}

export function DraftPanel({ label, drafts, onAccept }: Props) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  if (drafts.length === 0) return null

  const chosen = drafts.filter((item) => !skipped.has(item.routineId ?? item.id))

  const toggle = (key: string) => {
    const next = new Set(skipped)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSkipped(next)
  }

  return (
    <section className="draft">
      <div className="draft-title">{label}</div>
      <ul className="list">
        {drafts.map((item) => {
          const key = item.routineId ?? item.id
          return (
            <li key={key}>
              <label className="check">
                <input type="checkbox" checked={!skipped.has(key)} onChange={() => toggle(key)} />
                <span className="when">{timeRange(item)}</span>
                <strong>{item.title}</strong>
              </label>
            </li>
          )
        })}
      </ul>
      <button className="primary" disabled={chosen.length === 0} onClick={() => onAccept(chosen)}>
        <span>Tambahkan {chosen.length} item</span>
        <span>+</span>
      </button>
    </section>
  )
}
