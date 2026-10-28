import type { ActivityLog, Module } from './types'

export interface NewLogInput {
  module: Module
  type: string
  value?: number | null
  unit?: string | null
  note?: string | null
  occurredAt?: Date
}

export const createLog = (input: NewLogInput, now: Date, newId: () => string): ActivityLog => {
  const type = input.type.trim()
  const value = input.value ?? null

  if (!type) throw new Error('tipe aktivitas wajib diisi')
  if (type === 'idle') throw new Error('sesi kosong dicatat lewat tombol Lagi kosong')
  if (value !== null && !Number.isFinite(value)) throw new Error('nilai harus angka')

  return {
    id: newId(),
    module: input.module,
    type,
    occurredAt: (input.occurredAt ?? now).toISOString(),
    endedAt: null,
    value,
    unit: value === null ? null : (input.unit?.trim() || null),
    note: input.note?.trim() || null,
    meta: { source: 'manual' },
    itemId: null,
  }
}
