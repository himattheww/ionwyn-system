import type { ApiResult, Entry, MonthData, Settings } from '../types'

const STORAGE_KEY = 'timesheet.settings'

export const viaHub = import.meta.env.BASE_URL !== './'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>
      return { url: parsed.url ?? '', apiKey: parsed.apiKey ?? '' }
    }
  } catch {
    return { url: '', apiKey: '' }
  }
  return { url: '', apiKey: '' }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

async function call(body: Record<string, unknown>): Promise<ApiResult> {
  const { url, apiKey } = loadSettings()
  const direct = url !== '' && apiKey !== ''
  if ((direct || !viaHub) && !/^https:\/\/script\.google\.com\/macros\/(a\/[^/]+\/)?s\/[^/]+\/exec$/.test(url)) {
    throw new Error('URL web app tidak valid. Harus berformat https://script.google.com/macros/s/…/exec')
  }
  const response = await fetch(direct || !viaHub ? url : `${import.meta.env.BASE_URL}api`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, apiKey }),
  })
  const text = await response.text()
  let data: ApiResult & { error?: string }
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Respons bukan JSON (HTTP ' + response.status + '). Cek URL web app berakhiran /exec, deployment versi terbaru, dan akses "Anyone".')
  }
  if (data.error) throw new Error(data.error)
  return data
}

const monthKey = (date: string) => `timesheet.bulan:${date.slice(0, 7)}`

export function cachedMonth(date: string): MonthData | null {
  try {
    return JSON.parse(localStorage.getItem(monthKey(date)) ?? 'null')
  } catch {
    return null
  }
}

export function rememberMonth(date: string, month: MonthData) {
  try {
    localStorage.setItem(monthKey(date), JSON.stringify(month))
  } catch {
    return
  }
}

export function fetchMonth(date: string): Promise<ApiResult> {
  return call({ action: 'month', date })
}

export function sendEntry(date: string, entry: Entry): Promise<ApiResult> {
  return call({ action: 'entry', date, ...entry })
}
