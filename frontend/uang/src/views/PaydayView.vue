<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAuth } from '@/composables/useAuth'
import { useNotify } from '@/composables/useNotify'
import { formatRpAbs } from '@/lib/format'
import { activeAccounts, defaultAccountId, emptyLedger, ITEM_KINDS, loadLedger } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'

const { user, monthlyIncome } = useAuth()
const { toast } = useNotify()
const router = useRouter()

const ledger    = ref(emptyLedger())
const loading   = ref(true)
const saving    = ref(false)
const amount    = ref(0)
const date      = ref(dayjs().format('YYYY-MM-DD'))
const accountId = ref('')
const transfers = ref<Record<string, number>>({})
const extraTo   = ref('')

onMounted(async () => {
  if (!user.value) return
  ledger.value = await loadLedger(user.value.id)
  amount.value = monthlyIncome.value
  accountId.value = defaultAccountId(ledger.value) ?? ''
  extraTo.value = accounts.value.find(a => a.kind === 'tabungan')?.id ?? ''
  loading.value = false
})

const accounts = computed(() => activeAccounts(ledger.value))
const planned  = (id: string) => ledger.value.items.filter(i => (i.account_id ?? defaultAccountId(ledger.value)) === id).reduce((s, i) => s + Number(i.amount), 0)

watch(accountId, id => {
  transfers.value = Object.fromEntries(accounts.value.filter(a => a.id !== id).map(a => [a.id, planned(a.id)]))
})

const stays     = computed(() => planned(accountId.value))
const moved     = computed(() => Object.values(transfers.value).reduce((s, v) => s + Number(v || 0), 0))
const leftover  = computed(() => amount.value - stays.value - moved.value)
const itemsFor  = (id: string) => ledger.value.items.filter(i => (i.account_id ?? defaultAccountId(ledger.value)) === id)
const itemNames = (id: string, withKind = false) =>
  itemsFor(id).map(i => (withKind ? `${i.name} (${ITEM_KINDS[i.kind].toLowerCase()})` : i.name)).join(', ') || '—'
const paidAlready = computed(() =>
  ledger.value.txs.some(t => t.type === 'income' && t.category === 'gaji' && t.date.slice(0, 7) === date.value.slice(0, 7)),
)

async function record() {
  if (!(amount.value > 0)) { toast.error('Isi jumlah gaji'); return }
  saving.value = true
  const uid = user.value!.id
  const plan = { ...transfers.value }
  if (leftover.value > 0 && extraTo.value && extraTo.value !== accountId.value) plan[extraTo.value] = Number(plan[extraTo.value] || 0) + leftover.value
  const rows = [
    { user_id: uid, type: 'income' as const, amount: amount.value, category: 'gaji', note: 'Gaji', date: date.value, account_id: accountId.value },
    ...Object.entries(plan)
      .filter(([, value]) => Number(value) > 0)
      .map(([to, value]) => ({
        user_id: uid,
        type: 'transfer' as const,
        amount: Number(value),
        category: 'transfer',
        note: 'Alokasi gajian',
        date: date.value,
        account_id: accountId.value,
        to_account_id: to,
      })),
  ]
  const { error } = await supabase.from('transactions').insert(rows)
  saving.value = false
  if (error) { toast.error('Gagal mencatat: ' + error.message); return }
  toast.success(`Gaji dan ${rows.length - 1} transfer tercatat`)
  router.push('/dashboard')
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">Rutinitas bulanan</span>
        <h1 class="page-title">Hari gajian</h1>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap"><div class="loading-spinner"></div><p>Memuat data…</p></div>

    <template v-else>
      <p v-if="paidAlready" class="warn-text">Gaji bulan {{ dayjs(date).format('MMMM') }} sudah pernah dicatat. Pastikan tidak tercatat dua kali.</p>

      <section class="card">
        <div class="fields">
          <label class="field">Gaji masuk<input v-model.number="amount" type="number" class="c-input" /></label>
          <label class="field">Tanggal<input v-model="date" type="date" class="c-input" /></label>
          <label class="field">Masuk ke rekening
            <select v-model="accountId" class="c-input"><option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option></select>
          </label>
        </div>
      </section>

      <section class="block">
        <div class="block-head"><h2 class="block-title">Rencana transfer</h2></div>
        <div class="table">
          <div class="table-row head"><span>Rekening</span><span>Transfer</span><span>Pos</span><span></span><span></span></div>
          <div v-for="a in accounts.filter(x => x.id !== accountId)" :key="a.id" class="table-row">
            <span>{{ a.name }}</span>
            <input v-model.number="transfers[a.id]" type="number" class="c-input" :aria-label="'Transfer ke ' + a.name" />
            <span class="card-meta">{{ itemNames(a.id) }}</span>
            <span></span><span></span>
          </div>
          <div class="table-row">
            <span>Tetap di {{ accounts.find(a => a.id === accountId)?.name }}</span>
            <span class="c-num">{{ formatRpAbs(stays) }}</span>
            <span class="card-meta">{{ itemNames(accountId, true) }}</span>
            <span></span><span></span>
          </div>
        </div>

        <div class="plan-total">
          <span>{{ leftover >= 0 ? 'Sisa di luar rencana' : 'Kurang dari rencana' }}</span>
          <span class="c-num" :class="leftover >= 0 ? 'diff-ok' : 'diff-bad'">{{ leftover < 0 ? '− ' : '' }}{{ formatRpAbs(leftover) }}</span>
        </div>
        <label v-if="leftover > 0" class="field">Pindahkan sisa ke
          <select v-model="extraTo" class="c-input">
            <option value="">Biarkan di rekening gaji</option>
            <option v-for="a in accounts.filter(x => x.id !== accountId)" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>
        <p v-if="leftover < 0" class="warn-text">Gaji tidak cukup untuk semua pos. Kurangi transfer atau ubah pos di halaman Budget.</p>

        <div class="card-actions">
          <button class="c-btn c-btn-primary" :disabled="saving" @click="record">{{ saving ? 'Mencatat…' : 'Catat gaji & transfer' }}</button>
          <RouterLink to="/budget" class="c-btn c-btn-ghost">Ubah pos</RouterLink>
        </div>
        <p class="note-text">Transfer di aplikasi bank tetap kamu lakukan sendiri. Halaman ini mencatat gaji dan transfernya supaya saldo tiap rekening ikut berubah.</p>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
<style scoped src="../styles/views/ledger-view.css"></style>
