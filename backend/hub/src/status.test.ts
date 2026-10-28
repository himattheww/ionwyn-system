import { describe, expect, it } from 'vitest'
import { integrationStatus } from './integrations.ts'
import { saveStatus } from './status.ts'

describe('integration status', () => {
  it('lists every relation before any run', async () => {
    const list = await integrationStatus()
    expect(list.map(s => s.id)).toEqual(['H4', 'H5', 'H6', 'H7', 'H8'])
    expect(list.every(s => s.lastRunAt === null)).toBe(true)
  })

  it('returns what was saved and keeps the current label', async () => {
    await saveStatus([{ id: 'H5', label: 'lama', lastRunAt: '2026-10-20T01:00:00.000Z', lastOkAt: null, lastError: 'gagal', lastResult: null }])
    const h5 = (await integrationStatus()).find(s => s.id === 'H5')!
    expect(h5.lastError).toBe('gagal')
    expect(h5.label).toBe('Catatan Malam menyelesaikan item diary_done')
  })
})
