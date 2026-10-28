import { useState } from 'react'
import type { FormEvent } from 'react'
import type { PlannerSettings } from '../../../../backend/jadwal/core/src'
import { notificationPermission, requestNotificationPermission } from '../lib/notify'
import { TimeField } from './TimeField'

interface Props {
  settings: PlannerSettings
  onSave: (settings: PlannerSettings) => Promise<void>
}

export function Settings({ settings, onSave }: Props) {
  const [draft, setDraft] = useState(settings)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState(notificationPermission())

  const set = <K extends keyof PlannerSettings>(field: K, value: PlannerSettings[K]) => {
    setDraft({ ...draft, [field]: value })
    setSaved(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    try {
      await onSave(draft)
      setSaved(true)
      setError(null)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'gagal menyimpan')
    }
  }

  const enable = async () => {
    await requestNotificationPermission()
    setPermission(notificationPermission())
  }

  return (
    <main className="page wide">
      <header className="masthead">
        <div>
          <p className="eyebrow">Pengingat dan jam tenang</p>
          <h1>Pengaturan</h1>
        </div>
      </header>

      <h2>Notifikasi browser</h2>
      <section className="panel stack">
        <p className="meta">
          Status: {permission === 'unsupported' ? 'tidak didukung browser ini' : permission}. Notifikasi hanya muncul saat
          aplikasi terbuka (tab atau PWA).
        </p>
        {permission === 'default' && (
          <button className="primary" onClick={enable}>
            Aktifkan notifikasi
          </button>
        )}
        {permission === 'denied' && <p className="meta">Diblokir. Ubah izin situs di pengaturan browser.</p>}
      </section>

      <form className="stack" onSubmit={submit}>
        <h2>Jam notifikasi</h2>
        <div className="panel stack">
          <div className="row">
            <label>
              Ringkasan pagi
              <TimeField value={draft.morningSummary} onChange={(v) => set('morningSummary', v)} required />
            </label>
            <label>
              Ringkasan malam
              <TimeField value={draft.eveningSummary} onChange={(v) => set('eveningSummary', v)} required />
            </label>
          </div>
          <div className="row">
            <label>
              Jam tenang mulai
              <TimeField value={draft.quietStart} onChange={(v) => set('quietStart', v)} required />
            </label>
            <label>
              Jam tenang selesai
              <TimeField value={draft.quietEnd} onChange={(v) => set('quietEnd', v)} required />
            </label>
          </div>
          <label>
            Ingatkan (menit sebelum mulai)
            <input
              type="number"
              min={0}
              value={draft.remindBeforeMin}
              onChange={(e) => set('remindBeforeMin', Number(e.target.value))}
            />
          </label>
        </div>

        <h2>Penjadwalan</h2>
        <div className="panel stack">
          <div className="row">
            <label>
              Jarak antar item (menit)
              <input
                type="number"
                min={0}
                value={draft.slotBufferMin}
                onChange={(e) => set('slotBufferMin', Number(e.target.value))}
              />
            </label>
            <label>
              Slot geser paling cepat (menit dari sekarang)
              <input
                type="number"
                min={0}
                value={draft.minLeadMin}
                onChange={(e) => set('minLeadMin', Number(e.target.value))}
              />
            </label>
          </div>
          <label>
            Batas geser sebelum ditanya
            <input
              type="number"
              min={0}
              value={draft.maxFreeShifts}
              onChange={(e) => set('maxFreeShifts', Number(e.target.value))}
            />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {saved && <p className="meta">Tersimpan.</p>}
        <button type="submit" className="primary">
          Simpan pengaturan
        </button>
      </form>
    </main>
  )
}
