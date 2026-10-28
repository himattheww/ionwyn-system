import { ref } from 'vue'
import { supabase } from './supabase'
import type { Database } from './database.types'

export type PendingTx = Database['public']['Tables']['transactions']['Insert'] & { id: string }

export const pendingItems = ref<PendingTx[]>([])

let userId = ''
let flushing = false

const storageKey = () => `pending_tx:${userId}`

function persist() {
  localStorage.setItem(storageKey(), JSON.stringify(pendingItems.value))
}

export function loadPending(uid: string) {
  userId = uid
  const value = localStorage.getItem(storageKey())
  pendingItems.value = value ? JSON.parse(value) : []
}

export function addPending(tx: PendingTx) {
  pendingItems.value = [...pendingItems.value, tx]
  persist()
}

export function removePending(id: string) {
  pendingItems.value = pendingItems.value.filter(t => t.id !== id)
  persist()
}

export async function flushPending() {
  const result = { sent: 0, failed: [] as string[] }
  if (flushing || !userId || pendingItems.value.length === 0) return result
  flushing = true
  try {
    for (const tx of [...pendingItems.value]) {
      const { error, status } = await supabase
        .from('transactions')
        .upsert(tx, { onConflict: 'id', ignoreDuplicates: true })
      if (error && status === 0) break
      removePending(tx.id)
      if (error) result.failed.push(error.message)
      else result.sent++
    }
  } finally {
    flushing = false
  }
  return result
}
