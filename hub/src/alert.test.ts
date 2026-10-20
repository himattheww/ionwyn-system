import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { alert } from './alert.ts'

describe('alert', () => {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'))

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does nothing without telegram settings', async () => {
    await alert('a', 'pesan')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends once per key inside the quiet window', async () => {
    vi.stubEnv('ALERT_TELEGRAM_TOKEN', 'token')
    vi.stubEnv('ALERT_TELEGRAM_CHAT_ID', '42')
    await alert('b', 'pertama')
    await alert('b', 'kedua')
    await alert('c', 'lain')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body)).text).toContain('pertama')
  })

  it('always sends when the quiet window is zero', async () => {
    vi.stubEnv('ALERT_TELEGRAM_TOKEN', 'token')
    vi.stubEnv('ALERT_TELEGRAM_CHAT_ID', '42')
    await alert('d', 'gagal', 0)
    await alert('d', 'gagal lagi', 0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
