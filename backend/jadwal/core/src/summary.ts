import type { Item, Module } from './types'
import { modules } from './types'

export interface ModuleSummary {
  module: Module
  selesai: number
  dilewati: number
  belum: number
  minutesDone: number
}

export const summarize = (items: Item[], from: string, to: string, today: string): ModuleSummary[] => {
  const rows = new Map<Module, ModuleSummary>()

  for (const item of items) {
    if (item.date < from || item.date > to || item.status === 'digeser') continue
    if (item.status === 'terencana' && item.date >= today) continue
    const row = rows.get(item.module) ?? { module: item.module, selesai: 0, dilewati: 0, belum: 0, minutesDone: 0 }
    if (item.status === 'selesai') {
      row.selesai += 1
      row.minutesDone += item.durationMin
    } else if (item.status === 'dilewati') {
      row.dilewati += 1
    } else {
      row.belum += 1
    }
    rows.set(item.module, row)
  }

  return modules.flatMap((module) => {
    const row = rows.get(module)
    return row ? [row] : []
  })
}
