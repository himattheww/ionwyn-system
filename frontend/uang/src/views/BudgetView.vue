<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import dayjs from 'dayjs'
import { useAuth } from '@/composables/useAuth'
import { useNotify } from '@/composables/useNotify'
import { onAppActive } from '@/lib/appActive'
import { formatRpAbs, percentOf } from '@/lib/format'
import { activeAccounts, emptyLedger, inMonth, itemUsed, ITEM_KINDS, loadLedger } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'
import type { BudgetItemKind } from '@/lib/database.types'

type Row = { id?: string; name: string; amount: number; kind: BudgetItemKind; account_id: string | null; debt_id: string | null }

const { user, monthlyIncome, updateProfile } = useAuth()
const { confirmDelete, toast } = useNotify()

const ledger  = ref(emptyLedger())
const rows    = ref<Row[]>([])
const income  = ref(0)
const loading = ref(true)
const saving  = ref(false)
const dirty   = ref(false)

const kinds = Object.keys(ITEM_KINDS) as BudgetItemKind[]
const month = dayjs().format('YYYY-MM')

async function load() {
  if (!user.value || dirty.value) return
  ledger.value = await loadLedger(user.value.id)
  rows.value = ledger.value.items.map(i => ({ id: i.id, name: i.name, amount: Number(i.amount), kind: i.kind, account_id: i.account_id, debt_id: i.debt_id }))
  income.value = monthlyIncome.value
  loading.value = false
}

onMounted(load)
onAppActive(load)

const accounts  = computed(() => activeAccounts(ledger.value))
const monthTxs  = computed(() => inMonth(ledger.value.txs, month))
const usedOf    = (row: Row) => {
  const item = ledger.value.items.find(i => i.id === row.id)
  return item ? itemUsed(item, monthTxs.value) : 0
}
const spendTotal = computed(() => rows.value.filter(r => r.kind !== 'tabungan').reduce((s, r) => s + Number(r.amount || 0), 0))
const saveTotal  = computed(() => rows.value.filter(r => r.kind === 'tabungan').reduce((s, r) => s + Number(r.amount || 0), 0))
const leftover   = computed(() => income.value - spendTotal.value - saveTotal.value)

function addRow() {
  rows.value.push({ name: '', amount: 0, kind: 'cadangan', account_id: accounts.value[0]?.id ?? null, debt_id: null })
  dirty.value = true
}

async function removeRow(index: number) {
  const row = rows.value[index]
  if (row.id && !(await confirmDelete(`Hapus pos ${row.name}?`, 'Transaksi yang sudah tercatat di pos ini tetap ada.'))) return
  if (row.id) {
    const { error } = await supabase.from('budget_items').update({ archived: true }).eq('id', row.id)
    if (error) { toast.error('Gagal menghapus: ' + error.message); return }
  }
  rows.value.splice(index, 1)
  toast.success('Pos dihapus')
}

async function saveAll() {
  if (rows.value.some(r => !r.name.trim())) { toast.error('Semua pos harus punya nama'); return }
  saving.value = true
  const uid = user.value!.id
  const payload = rows.value.map((r, sort) => ({
    ...(r.id ? { id: r.id } : {}),
    user_id: uid,
    name: r.name.trim(),
    amount: Number(r.amount || 0),
    kind: r.kind,
    account_id: r.account_id,
    debt_id: r.debt_id,
    sort,
  }))
  const updates = payload.filter(p => 'id' in p)
  const inserts = payload.filter(p => !('id' in p))
  const results = await Promise.all([
    updates.length ? supabase.from('budget_items').upsert(updates as any) : Promise.resolve({ error: null }),
    inserts.length ? supabase.from('budget_items').insert(inserts) : Promise.resolve({ error: null }),
    income.value !== monthlyIncome.value ? updateProfile({ monthly_income: income.value }) : Promise.resolve(),
  ])
  saving.value = false
  const failed = results.find(r => r && 'error' in r && r.error) as { error: { message: string } } | undefined
  if (failed) { toast.error('Gagal menyimpan: ' + failed.error.message); return }
  dirty.value = false
  toast.success('Pos budget disimpan')
  await load()
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">Rencana bulanan · berlaku tiap bulan sampai diubah</span>
        <h1 class="page-title">Budget</h1>
      </div>
      <div class="header-actions">
        <button class="c-btn c-btn-secondary" @click="addRow">Tambah pos</button>
        <button class="c-btn c-btn-primary" :disabled="saving || !dirty" @click="saveAll">{{ saving ? 'Menyimpan…' : 'Simpan' }}</button>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap"><div class="loading-spinner"></div><p>Memuat data…</p></div>

    <template v-else>
      <section class="summary">
        <div class="summary-item">
          <span class="c-kicker">Gaji bulanan</span>
          <input v-model.number="income" type="number" class="c-input" aria-label="Gaji bulanan" @input="dirty = true" />
          <span class="summary-sub">dipakai wizard hari gajian</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Kebutuhan</span>
          <span class="summary-value c-num">{{ formatRpAbs(spendTotal) }}</span>
          <span class="summary-sub">{{ percentOf(spendTotal, income) }}% dari gaji</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Tabungan</span>
          <span class="summary-value c-num">{{ formatRpAbs(saveTotal) }}</span>
          <span class="summary-sub">{{ percentOf(saveTotal, income) }}% dari gaji</span>
        </div>
        <div class="summary-item balance">
          <span class="c-kicker">Belum dialokasikan</span>
          <span class="summary-value c-num">{{ leftover < 0 ? '− ' : '' }}{{ formatRpAbs(leftover) }}</span>
          <span class="summary-sub">{{ leftover < 0 ? 'rencana melebihi gaji' : 'sisa gaji di luar pos' }}</span>
        </div>
      </section>

      <p class="note-text">
        Harian = dibagi rata per hari dan jadi jatah harian. Tetap = dibayar sekali sebulan. Cadangan = amplop bulanan yang dipakai bila perlu.
        Tabungan = ditransfer ke rekening tabungan saat gajian.
      </p>

      <section class="table">
        <div class="table-row head"><span>Pos</span><span>Nominal</span><span>Jenis</span><span>Rekening</span><span></span></div>
        <div v-for="(row, index) in rows" :key="row.id ?? 'new' + index" class="table-row">
          <div class="field">
            <input v-model="row.name" class="c-input" maxlength="40" placeholder="Nama pos" @input="dirty = true" />
            <span v-if="row.id" class="c-num">terpakai {{ formatRpAbs(usedOf(row)) }} bulan ini</span>
            <select v-if="ledger.debts.length" v-model="row.debt_id" class="c-input" aria-label="Terhubung ke cicilan" @change="dirty = true">
              <option :value="null">Bukan cicilan</option>
              <option v-for="d in ledger.debts" :key="d.id" :value="d.id">Cicilan: {{ d.name }}</option>
            </select>
          </div>
          <input v-model.number="row.amount" type="number" class="c-input" aria-label="Nominal" @input="dirty = true" />
          <select v-model="row.kind" class="c-input" aria-label="Jenis" @change="dirty = true">
            <option v-for="k in kinds" :key="k" :value="k">{{ ITEM_KINDS[k] }}</option>
          </select>
          <select v-model="row.account_id" class="c-input" aria-label="Rekening" @change="dirty = true">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
          <button class="c-btn c-btn-ghost" :aria-label="'Hapus pos ' + row.name" @click="removeRow(index)">Hapus</button>
        </div>
        <div class="table-row foot">
          <span>Total</span><span class="c-num">{{ formatRpAbs(spendTotal + saveTotal) }}</span><span></span><span></span><span></span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
<style scoped src="../styles/views/ledger-view.css"></style>
