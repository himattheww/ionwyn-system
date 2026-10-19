const locale = 'id-ID'

export const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export const rupiah = amount => `Rp ${Math.round(amount).toLocaleString(locale)}`

export const decimal = (value, digits = 1) => Number(value).toLocaleString(locale, { maximumFractionDigits: digits })

export const hours = minutes => decimal(minutes / 60)

export const sleep = minutes => `${Math.floor(minutes / 60)}j ${String(Math.round(minutes % 60)).padStart(2, '0')}m`

export const clock = minutes =>
  minutes == null ? '—' : `${String(Math.floor(minutes / 60)).padStart(2, '0')}.${String(minutes % 60).padStart(2, '0')}`

export const hhmm = time => (time ? time.slice(0, 5).replace(':', '.') : '—')

export const dateTime = iso => (iso ? new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export const longDate = isoDate =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const shortWeekday = isoDate => new Date(`${isoDate}T00:00:00`).toLocaleDateString(locale, { weekday: 'short' })

export const timeNow = () => new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
