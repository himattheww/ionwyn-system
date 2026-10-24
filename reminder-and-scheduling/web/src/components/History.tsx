import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { addDays, createLog, modules, summarize } from '../../../core/src'
import type { ActivityLog, Item, Module } from '../../../core/src'
import { durationLabel, newId } from '../lib/format'

interface Props {
  items: Item[]
  logs: ActivityLog[]
  today: string
  onAddLog: (log: ActivityLog) => Promise<void>
}

const rangeOptions = [
  { label: '7 hari', days: 7 },
  { label: '30 hari', days: 30 },
]

const stamp = (iso: string) => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getDate()}/${d.getMonth() + 1} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function History({ items, logs, today, onAddLog }: Props) {
  const [days, setDays] = useState(7)
  const [filter, setFilter] = useState<Module | 'semua'>('semua')
  const [module, setModule] = useState<Module>('kesehatan')
  const [type, setType] = useState('')
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const summary = useMemo(() => summarize(items, addDays(today, -(days - 1)), today, today), [items, today, days])
  const shown = useMemo(
    () =>
      logs
        .filter((log) => filter === 'semua' || log.module === filter)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [logs, filter],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      const log = createLog(
        { module, type, value: value === '' ? null : Number(value), unit, note },
        new Date(),
        newId,
      )
      await onAddLog(log)
      setType('')
      setValue('')
      setUnit('')
      setNote('')
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'gagal mencatat')
    }
  }

  return (
    <main className="page wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Yang sudah terjadi</p>
          <h1>Riwayat</h1>
        </div>
      </header>

      <h2>Ringkasan</h2>
      <div className="row">
        {rangeOptions.map((option) => (
          <button
            key={option.days}
            className={days === option.days ? 'primary' : ''}
            onClick={() => setDays(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {summary.length === 0 ? (
        <p className="meta">Belum ada data selesai atau terlewat di rentang ini.</p>
      ) : (
        <ul className="list">
          {summary.map((row) => {
            const total = row.selesai + row.dilewati + row.belum
            const rate = total === 0 ? 0 : Math.round((row.selesai / total) * 100)
            return (
              <li key={row.module} className="card">
                <div className="card-main">
                  <span className="time">{rate}%</span>
                  <span className="title">{row.module}</span>
                  <span className="meta">
                    {row.selesai} selesai · {row.dilewati} dilewati · {row.belum} belum terjawab ·{' '}
                    {durationLabel(row.minutesDone)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <h2>Catat langsung</h2>
      <form className="panel stack" onSubmit={submit}>
        <div className="row">
          <label>
            Modul
            <select value={module} onChange={(e) => setModule(e.target.value as Module)}>
              {modules.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <label>
            Tipe
            <input placeholder="mis. run_done" value={type} onChange={(e) => setType(e.target.value)} required />
          </label>
        </div>
        <div className="row">
          <label>
            Nilai
            <input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
          <label>
            Satuan
            <input placeholder="km, min, halaman" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
        </div>
        <label>
          Catatan
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="primary">
          Catat
        </button>
      </form>

      <h2>Aktivitas 30 hari terakhir</h2>
      <div className="row">
        {(['semua', ...modules] as const).map((name) => (
          <button key={name} className={filter === name ? 'primary' : ''} onClick={() => setFilter(name)}>
            {name}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="meta">Belum ada aktivitas.</p>
      ) : (
        <ul className="list">
          {shown.map((log) => (
            <li key={log.id} className="card">
              <div className="card-main">
                <span className="time">{stamp(log.occurredAt)}</span>
                <span className="title">{log.type}</span>
                <span className="meta">
                  {log.module}
                  {log.value !== null ? ` · ${log.value} ${log.unit ?? ''}` : ''}
                  {log.note ? ` · ${log.note}` : ''}
                  {log.itemId ? ' · dari jadwal' : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
