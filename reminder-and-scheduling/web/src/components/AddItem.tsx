import { useState } from 'react'
import type { FormEvent } from 'react'
import { createItem, modules } from '../../../core/src'
import type { Item, Kind, Module } from '../../../core/src'
import { newId } from '../lib/format'

interface Props {
  date: string
  onAdd: (item: Item) => Promise<void>
  onClose: () => void
}

export function AddItem({ date, onAdd, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Kind>('flexible')
  const [day, setDay] = useState(date)
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [module, setModule] = useState<Module>('umum')
  const [activityType, setActivityType] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const item = createItem(
        {
          title,
          kind,
          date: day,
          startTime: startTime || null,
          durationMin,
          module,
          activityType: activityType.trim() || null,
        },
        newId,
        new Date(),
      )
      await onAdd(item)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'gagal menyimpan')
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="dialog" onSubmit={submit}>
        <h2>Tambah jadwal</h2>
        <label>
          Judul
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </label>
        <div className="row">
          <label>
            Jenis
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              <option value="flexible">Fleksibel</option>
              <option value="fixed">Tetap (wajib jam)</option>
            </select>
          </label>
          <label>
            Modul
            <select value={module} onChange={(e) => setModule(e.target.value as Module)}>
              {modules.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label>
            Tanggal
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} required />
          </label>
          <label>
            Jam {kind === 'flexible' ? '(boleh kosong)' : ''}
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            Durasi (mnt)
            <input
              type="number"
              min={5}
              step={5}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          Tipe aktivitas (opsional, mis. run_done)
          <input value={activityType} onChange={(e) => setActivityType(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button type="button" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="primary">
            Simpan
          </button>
        </div>
      </form>
    </div>
  )
}
