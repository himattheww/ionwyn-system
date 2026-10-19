import type { ActivityLog, Module } from './types'

export const openIdle = (logs: ActivityLog[]): ActivityLog | null =>
  logs.find((log) => log.type === 'idle' && log.endedAt === null) ?? null

export const startIdle = (
  logs: ActivityLog[],
  input: { module: Module; note?: string | null },
  now: Date,
  newId: () => string,
): ActivityLog => {
  if (openIdle(logs)) throw new Error('masih ada sesi kosong yang belum di-stop')
  return {
    id: newId(),
    module: input.module,
    type: 'idle',
    occurredAt: now.toISOString(),
    endedAt: null,
    value: null,
    unit: null,
    note: input.note ?? null,
    meta: {},
    itemId: null,
  }
}

export const stopIdle = (log: ActivityLog, endedAt: Date): ActivityLog => {
  if (log.type !== 'idle') throw new Error('bukan sesi kosong')
  if (log.endedAt !== null) throw new Error('sesi kosong sudah di-stop')
  const ms = endedAt.getTime() - new Date(log.occurredAt).getTime()
  if (ms <= 0) throw new Error('waktu stop harus setelah waktu mulai')
  return { ...log, endedAt: endedAt.toISOString(), value: Math.round(ms / 60_000), unit: 'min' }
}
