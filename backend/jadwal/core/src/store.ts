import type { ActivityLog, Item, PlannerSettings, RoutineTemplate } from './types'

export interface Store {
  itemsBetween(from: string, to: string): Promise<Item[]>
  saveItems(items: Item[]): Promise<void>
  logsBetween(from: Date, to: Date): Promise<ActivityLog[]>
  openIdle(): Promise<ActivityLog | null>
  saveLog(log: ActivityLog): Promise<void>
  templates(): Promise<RoutineTemplate[]>
  saveTemplates(templates: RoutineTemplate[]): Promise<void>
  deleteTemplate(id: string): Promise<void>
  settings(): Promise<PlannerSettings>
  saveSettings(settings: PlannerSettings): Promise<void>
}
