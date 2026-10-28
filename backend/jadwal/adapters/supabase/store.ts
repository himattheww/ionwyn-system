import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { defaultSettings } from '../../core/src'
import type { Store } from '../../core/src'
import {
  itemFromRow,
  itemToRow,
  logFromRow,
  logToRow,
  settingsFromRow,
  settingsToRow,
  templateFromRow,
  templateToRow,
} from './rows'
import type { ItemRow, LogRow, SettingsRow, TemplateRow } from './rows'

const check = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const createPlannerClient = (url: string, anonKey: string) => createClient(url, anonKey)

export const createSupabaseStore = (client: SupabaseClient): Store => ({
  async itemsBetween(from, to) {
    const { data, error } = await client
      .from('schedule_items')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time', { nullsFirst: false })
    check(error)
    return ((data ?? []) as ItemRow[]).map(itemFromRow)
  },

  async saveItems(items) {
    if (items.length === 0) return
    const { error } = await client.from('schedule_items').upsert(items.map(itemToRow))
    check(error)
  },

  async logsBetween(from, to) {
    const { data, error } = await client
      .from('activity_logs')
      .select('*')
      .gte('occurred_at', from.toISOString())
      .lt('occurred_at', to.toISOString())
      .order('occurred_at')
    check(error)
    return ((data ?? []) as LogRow[]).map(logFromRow)
  },

  async openIdle() {
    const { data, error } = await client
      .from('activity_logs')
      .select('*')
      .eq('type', 'idle')
      .is('ended_at', null)
      .maybeSingle()
    check(error)
    return data ? logFromRow(data as LogRow) : null
  },

  async saveLog(log) {
    const { error } = await client.from('activity_logs').upsert(logToRow(log))
    check(error)
  },

  async templates() {
    const { data, error } = await client.from('routine_templates').select('*').order('weekday')
    check(error)
    return ((data ?? []) as TemplateRow[]).map(templateFromRow)
  },

  async saveTemplates(templates) {
    if (templates.length === 0) return
    const { error } = await client.from('routine_templates').upsert(templates.map(templateToRow))
    check(error)
  },

  async deleteTemplate(id) {
    const { error } = await client.from('routine_templates').delete().eq('id', id)
    check(error)
  },

  async settings() {
    const { data, error } = await client.from('planner_settings').select('*').maybeSingle()
    check(error)
    return data ? settingsFromRow(data as SettingsRow) : defaultSettings
  },

  async saveSettings(settings) {
    const { data, error: authError } = await client.auth.getUser()
    check(authError)
    const owner = data.user?.id
    if (!owner) throw new Error('belum login')
    const { error } = await client.from('planner_settings').upsert({ owner, ...settingsToRow(settings) })
    check(error)
  },
})
