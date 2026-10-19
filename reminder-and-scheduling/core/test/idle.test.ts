import { describe, expect, it } from 'vitest'
import { openIdle, startIdle, stopIdle } from '../src'
import { makeLog, sequence } from './helpers'

describe('idle', () => {
  it('start membuat sesi terbuka', () => {
    const log = startIdle([], { module: 'kerja', note: 'tunggu review' }, new Date(2026, 9, 14, 10, 0), sequence())
    expect(log).toMatchObject({ type: 'idle', module: 'kerja', endedAt: null, note: 'tunggu review' })
    expect(openIdle([log])).toBe(log)
  })

  it('tidak boleh start dua kali', () => {
    expect(() =>
      startIdle([makeLog()], { module: 'kerja' }, new Date(2026, 9, 14, 10, 0), sequence()),
    ).toThrow('masih ada sesi kosong')
  })

  it('stop mengisi endedAt dan menit', () => {
    const start = new Date(2026, 9, 14, 10, 0)
    const log = makeLog({ occurredAt: start.toISOString() })
    const stopped = stopIdle(log, new Date(2026, 9, 14, 11, 25))
    expect(stopped.value).toBe(85)
    expect(stopped.unit).toBe('min')
    expect(openIdle([stopped])).toBeNull()
  })

  it('stop sebelum mulai ditolak', () => {
    const log = makeLog({ occurredAt: new Date(2026, 9, 14, 10, 0).toISOString() })
    expect(() => stopIdle(log, new Date(2026, 9, 14, 9, 0))).toThrow('setelah waktu mulai')
  })

  it('stop dua kali ditolak', () => {
    const log = makeLog({ endedAt: '2026-10-14T05:00:00.000Z' })
    expect(() => stopIdle(log, new Date())).toThrow('sudah di-stop')
  })
})
