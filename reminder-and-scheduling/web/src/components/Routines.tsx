import { useState } from 'react'
import type { FormEvent } from 'react'
import { createTemplate, modules } from '../../../core/src'
import type { Kind, Module, RoutineTemplate } from '../../../core/src'
import { newId, timeRange } from '../lib/format'

interface Props {
  templates: RoutineTemplate[]
  onSave: (templates: RoutineTemplate[]) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const weekOrder = [1, 2, 3, 4, 5, 6, 0]
const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function Routines({ templates, onSave, onDelete }: Props) {
  const [weekday, setWeekday] = useState(1)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Kind>('flexible')
  const [startTime, setStartTime] = useState('')
  const [durationMin, setDurationMin] = useState(30)
  const [module, setModule] = useState<Module>('umum')
  const [activityType, setActivityType] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const template = createTemplate(
        {
          weekday,
          title,
          kind,
          startTime: startTime || null,
          durationMin,
          module,
          activityType: activityType.trim() || null,
        },
        newId,
      )
      await onSave([template])
      setTitle('')
      setStartTime('')
      setActivityType('')
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'gagal menyimpan')
    }
  }

  const remove = async (template: RoutineTemplate) => {
    if (window.confirm(`Hapus rutinitas “${template.title}” (${dayNames[template.weekday]})?`)) {
      await onDelete(template.id)
    }
  }

  return (
    <main className="page wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Diterapkan tiap minggu</p>
          <h1>Rutinitas</h1>
        </div>
      </header>

      {templates.length === 0 && <p className="meta">Belum ada rutinitas.</p>}

      {weekOrder.map((day) => {
        const rows = templates.filter((t) => t.weekday === day)
        if (rows.length === 0) return null
        return (
          <section key={day}>
            <h2>{dayNames[day]}</h2>
            <ul className="list">
              {rows.map((t) => (
                <li key={t.id} className={`card${t.active ? '' : ' selesai'}`}>
                  <div className="card-main">
                    <span className="time">{timeRange(t)}</span>
                    <span className="title">{t.title}</span>
                    <span className="meta">
                      {t.module}
                      {t.kind === 'fixed' ? ' · tetap' : ''}
                      {t.activityType ? ` · ${t.activityType}` : ''}
                      {t.active ? '' : ' · nonaktif'}
                    </span>
                  </div>
                  <div className="actions">
                    <button onClick={() => onSave([{ ...t, active: !t.active }])}>
                      {t.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button className="danger" onClick={() => remove(t)}>
                      Hapus
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <h2>Tambah rutinitas</h2>
      <form className="panel stack" onSubmit={submit}>
        <label>
          Judul
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <div className="row">
          <label>
            Hari
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {weekOrder.map((day) => (
                <option key={day} value={day}>
                  {dayNames[day]}
                </option>
              ))}
            </select>
          </label>
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
          <label>
            Tipe aktivitas
            <input
              placeholder="mis. run_done"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">
          Simpan rutinitas
        </button>
      </form>
    </main>
  )
}
