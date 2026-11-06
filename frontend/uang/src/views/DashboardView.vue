<script setup lang="ts">
import { cappedPercent, formatRpAbs, percentOf } from '@/lib/format'
import { categoryLabel } from '@/lib/categories'
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { onAppActive } from '@/lib/appActive'
import { pendingItems } from '@/lib/pending'
import { computeAllowance, formatRupiah } from '@/lib/dailyAllowance'
import {
  accountName, activeAccounts, balanceOf, dailyPool, debtStatus, emptyLedger, inMonth, isDaily, itemUsed, ITEM_KINDS,
  loadLedger, monthlyNeed, savingsMoney, sumOf, totalMoney, unplanned, type Tx,
} from '@/lib/ledger'
import { cachedQuery } from '@/lib/offlineCache'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'
import { useExportPDF } from '@/composables/useExportPDF'
import 'dayjs/locale/id'
dayjs.locale('id')

const { user, displayName } = useAuth()
const { exporting, exportMonthlyReport } = useExportPDF()

async function doExport() {
  if (!user.value) return
  await exportMonthlyReport(user.value.id, selectedExportMonth.value, displayName.value)
}

const selectedExportMonth = ref(dayjs().format('YYYY-MM'))
const ledger  = ref(emptyLedger())
const goals   = ref<any[]>([])
const loading = ref(true)

const currentMonth = dayjs().format('YYYY-MM')
const todayLabel   = dayjs().format('dddd, D MMMM YYYY')
const monthName    = dayjs().format('MMMM')

async function load() {
  if (!user.value) return
  const uid = user.value.id
  const [data, goalsRes] = await Promise.all([
    loadLedger(uid),
    cachedQuery(`${uid}:dash-goals`, supabase.from('saving_goals').select('*').eq('user_id', uid).eq('is_completed', false).limit(3)),
  ])
  ledger.value  = data
  goals.value   = goalsRes.data ?? []
  loading.value = false
}

onMounted(load)
onAppActive(load)

const monthTxs     = computed(() => inMonth([...ledger.value.txs, ...(pendingItems.value as Tx[])], currentMonth))
const totalIncome  = computed(() => sumOf(monthTxs.value, 'income'))
const totalExpense = computed(() => sumOf(monthTxs.value, 'expense'))
const surprises    = computed(() => unplanned(monthTxs.value))
const surpriseSum  = computed(() => surprises.value.reduce((s, t) => s + Number(t.amount), 0))
const accounts     = computed(() => activeAccounts(ledger.value).map(a => ({ ...a, balance: balanceOf(a, ledger.value) })))
const total        = computed(() => totalMoney(ledger.value))

const items     = computed(() => ledger.value.items)
const dailyItems = computed(() => items.value.filter(i => i.kind === 'harian'))
const allowance = computed(() =>
  computeAllowance(dailyPool(items.value), [...ledger.value.txs, ...(pendingItems.value as Tx[])], t => isDaily(t, items.value)),
)
const allowanceStatus = computed(() => {
  const a = allowance.value
  if (!a) return ''
  if (a.exhausted) return 'Alokasi habis'
  return { ok: 'Aman', warn: 'Hampir habis', over: 'Melewati jatah', far: 'Jauh melewati jatah' }[a.level]
})
const allowanceTag = computed(() => {
  const a = allowance.value
  if (!a) return ''
  if (a.exhausted) return 'c-tag-outline'
  return { ok: 'c-tag-neutral', warn: 'c-tag-accent', over: 'c-tag-outline', far: 'c-tag-outline' }[a.level]
})

const itemRows = computed(() =>
  items.value.map(i => ({ ...i, used: itemUsed(i, monthTxs.value), saving: i.kind === 'tabungan' })),
)

const need      = computed(() => monthlyNeed(items.value))
const savings   = computed(() => savingsMoney(ledger.value))
const emergency = computed(() => ({
  min: need.value * 3,
  max: need.value * 6,
  months: need.value > 0 ? savings.value / need.value : 0,
  pct: cappedPercent(savings.value, need.value * 6),
}))

const debts = computed(() => ledger.value.debts.map(d => ({ ...d, status: debtStatus(d, ledger.value.txs) })))

const recentTx = computed(() => ledger.value.txs.filter(t => t.date.startsWith(currentMonth)).slice(0, 5))

function txLabel(t: Tx) {
  if (t.type === 'transfer') return `${accountName(ledger.value, t.account_id)} → ${accountName(ledger.value, t.to_account_id)}`
  return categoryLabel(t.category)
}

const goalProgress = (g: any) => cappedPercent(g.current_amount, g.target_amount)
const signed = (n: number) => (n < 0 ? '− ' : '') + formatRpAbs(n)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">Buku besar · {{ todayLabel }}</span>
        <h1 class="page-title">Keuangan</h1>
      </div>
      <div class="header-actions">
        <input type="month" v-model="selectedExportMonth" class="c-input" />
        <button class="c-btn c-btn-secondary" @click="doExport" :disabled="exporting">
          <svg v-if="!exporting" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
          <span v-else class="spinner-sm"></span>
          {{ exporting ? 'Membuat PDF…' : 'Export PDF' }}
        </button>
        <RouterLink to="/payday" class="c-btn c-btn-secondary">Hari gajian</RouterLink>
        <RouterLink to="/transactions" class="c-btn c-btn-primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Catat transaksi
        </RouterLink>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap">
      <div class="loading-spinner"></div>
      <p>Memuat data…</p>
    </div>

    <template v-else>
      <section class="summary">
        <div class="summary-item">
          <span class="c-kicker">Pemasukan</span>
          <span class="summary-value c-num income">+ {{ formatRpAbs(totalIncome) }}</span>
          <span class="summary-sub">bulan ini</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Pengeluaran</span>
          <span class="summary-value c-num expense">− {{ formatRpAbs(totalExpense) }}</span>
          <span class="summary-sub">bulan ini, tanpa transfer</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Dadakan</span>
          <span class="summary-value c-num expense">− {{ formatRpAbs(surpriseSum) }}</span>
          <span class="summary-sub">{{ surprises.length }} transaksi tak terencana</span>
        </div>
        <div class="summary-item balance">
          <span class="c-kicker">Total uang</span>
          <span class="summary-value c-num">{{ signed(total) }}</span>
          <span class="summary-sub">di {{ accounts.length }} rekening</span>
        </div>
      </section>

      <section v-if="allowance" class="allowance">
        <div class="allow-main">
          <div class="allow-head">
            <span class="c-kicker">Sisa jatah hari ini</span>
            <span class="c-tag" :class="allowanceTag">{{ allowanceStatus }}</span>
          </div>
          <p class="allow-amount c-num" :class="`lvl-${allowance.level}`">
            {{ allowance.todayLeft >= 0 ? formatRupiah(allowance.todayLeft) : '− ' + formatRupiah(-allowance.todayLeft) }}
          </p>
          <div class="allow-bar" :class="`lvl-${allowance.level}`">
            <div class="allow-bar-fill" :style="{ width: Math.min(allowance.ratio, 1) * 100 + '%' }"></div>
          </div>
          <div class="allow-meta c-num">
            <span>Terpakai {{ formatRupiah(allowance.spentToday) }}</span>
            <span>Jatah tetap {{ formatRupiah(allowance.todayAllowance) }} per hari</span>
          </div>
        </div>

        <div class="allow-side">
          <div class="side-row">
            <span class="side-label">Sisa pos harian ({{ dailyItems.map(i => i.name).join(' + ') }})</span>
            <span class="side-value c-num">{{ formatRupiah(allowance.poolLeft) }}</span>
            <span class="side-label">untuk {{ allowance.daysLeft }} hari tersisa di {{ monthName }}</span>
          </div>
          <div class="side-row">
            <span class="side-label">{{ allowance.saved >= 0 ? 'Sudah menabung bulan ini sebesar' : 'Defisit bulan ini sebesar' }}</span>
            <span class="side-value c-num" :class="{ deficit: allowance.saved < 0 }">{{ allowance.saved < 0 ? '− ' : '+ ' }}{{ formatRupiah(Math.abs(allowance.saved)) }}</span>
            <span class="side-label">Sisa jatah hari yang sudah lewat. Kelebihan belanja hari ini langsung mengurangi.</span>
          </div>
        </div>
      </section>

      <section v-else class="allow-empty">
        <span class="c-kicker kicker-accent">Jatah harian</span>
        <h2 class="empty-title">Belum ada pos harian</h2>
        <p class="empty-body">Jatah harian dihitung dari pos budget berjenis Harian dibagi jumlah hari di bulan ini.</p>
        <RouterLink to="/budget" class="c-btn c-btn-primary">Atur pos budget</RouterLink>
      </section>

      <section class="two-col">
        <div class="block">
          <div class="block-head">
            <h2 class="block-title">Rekening</h2>
            <RouterLink to="/accounts" class="block-link">Cocokkan saldo</RouterLink>
          </div>
          <p v-if="accounts.length === 0" class="empty-inline">Belum ada rekening. <RouterLink to="/accounts">Tambah rekening</RouterLink></p>
          <div v-else class="rows">
            <div v-for="a in accounts" :key="a.id" class="row-top">
              <span class="row-name">{{ a.name }} <em v-if="a.kind === 'tabungan'" class="row-hint">tabungan</em></span>
              <span class="c-num">{{ signed(a.balance) }}</span>
            </div>
          </div>
        </div>

        <div class="block">
          <div class="block-head">
            <h2 class="block-title">Dana darurat</h2>
            <RouterLink to="/accounts" class="block-link">Rekening tabungan</RouterLink>
          </div>
          <p v-if="need === 0" class="empty-inline">Isi pos budget dulu untuk menghitung target.</p>
          <div v-else class="budget-row">
            <div class="row-top">
              <span class="row-name">{{ formatRpAbs(savings) }} <em class="row-hint">cukup {{ emergency.months.toFixed(1) }} bulan</em></span>
              <span class="row-pct c-num">{{ emergency.pct }}%</span>
            </div>
            <div class="rule-track">
              <div class="rule-fill accent" :style="{ width: emergency.pct + '%' }"></div>
              <span class="rule-mark" title="Target minimal 3 bulan"></span>
            </div>
            <span class="row-amounts c-num">
              minimal 3× {{ formatRpAbs(emergency.min) }} <span class="muted">· ideal 6× {{ formatRpAbs(emergency.max) }}</span>
            </span>
          </div>

          <div class="block-head sub">
            <h3 class="block-title small">Cicilan &amp; utang</h3>
            <RouterLink to="/debts" class="block-link">Semua</RouterLink>
          </div>
          <p v-if="debts.length === 0" class="empty-inline">Belum ada cicilan atau utang. <RouterLink to="/debts">Tambah</RouterLink></p>
          <div v-else class="rows">
            <div v-for="d in debts" :key="d.id" class="budget-row">
              <div class="row-top">
                <span class="row-name">{{ d.name }}</span>
                <span class="row-pct c-num">{{ d.status.done ? 'Lunas' : 'sisa ' + formatRpAbs(d.status.remaining) }}</span>
              </div>
              <div class="rule-track"><div class="rule-fill accent" :style="{ width: cappedPercent(d.status.paid, d.total) + '%' }"></div></div>
              <span v-if="d.status.payoff && !d.status.done" class="row-amounts c-num">
                {{ d.status.monthsLeft }} bulan lagi · lunas {{ d.status.payoff.format('MMMM YYYY') }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="two-col">
        <div class="block">
          <div class="block-head">
            <h2 class="block-title">Pos budget</h2>
            <RouterLink to="/budget" class="block-link">Atur</RouterLink>
          </div>
          <p v-if="itemRows.length === 0" class="empty-inline">Belum ada pos. <RouterLink to="/budget">Buat pos</RouterLink></p>
          <div v-else class="rows">
            <div v-for="i in itemRows" :key="i.id" class="budget-row">
              <div class="row-top">
                <span class="row-name">{{ i.name }} <em class="row-hint">{{ ITEM_KINDS[i.kind].toLowerCase() }}</em></span>
                <span class="row-pct c-num" :class="{ over: !i.saving && i.used > i.amount }">{{ percentOf(i.used, i.amount) }}%</span>
              </div>
              <div class="rule-track">
                <div class="rule-fill" :class="{ over: !i.saving && i.used > i.amount, accent: i.saving }" :style="{ width: Math.min(percentOf(i.used, i.amount), 100) + '%' }"></div>
              </div>
              <span class="row-amounts c-num">{{ formatRpAbs(i.used) }} <span class="muted">/ {{ formatRpAbs(i.amount) }}{{ i.saving ? ' disetor' : '' }}</span></span>
            </div>
          </div>
        </div>

        <div class="block">
          <div class="block-head">
            <h2 class="block-title">Saving goals</h2>
            <RouterLink to="/goals" class="block-link">Semua</RouterLink>
          </div>
          <p v-if="goals.length === 0" class="empty-inline">Belum ada goals. <RouterLink to="/goals">Buat goal</RouterLink></p>
          <div v-else class="rows">
            <div v-for="g in goals" :key="g.id" class="goal-row">
              <span class="goal-pct c-num">{{ goalProgress(g) }}<small>%</small></span>
              <div class="goal-body">
                <span class="row-name">{{ g.name }}</span>
                <div class="rule-track">
                  <div class="rule-fill accent" :style="{ width: goalProgress(g) + '%' }"></div>
                </div>
                <span class="row-amounts c-num">{{ formatRpAbs(g.current_amount) }} <span class="muted">/ {{ formatRpAbs(g.target_amount) }}</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="block">
        <div class="block-head plain">
          <h2 class="block-title">Transaksi terakhir</h2>
          <RouterLink to="/transactions" class="block-link">Semua transaksi</RouterLink>
        </div>
        <p v-if="recentTx.length === 0" class="empty-inline">Belum ada transaksi bulan ini. <RouterLink to="/transactions">Tambah sekarang</RouterLink></p>
        <div v-else class="tx-table">
          <div class="tx-row tx-head">
            <span>Tanggal</span><span>Pos</span><span>Catatan</span><span class="right">Jumlah</span>
          </div>
          <div v-for="tx in recentTx" :key="tx.id" class="tx-row">
            <span class="tx-date c-num">{{ dayjs(tx.date).format('DD MMM') }}</span>
            <span>{{ txLabel(tx) }}</span>
            <span class="tx-note">{{ tx.note }}</span>
            <span class="tx-amount c-num right" :class="{ income: tx.type === 'income', transfer: tx.type === 'transfer' }">
              {{ tx.type === 'income' ? '+' : tx.type === 'transfer' ? '⇄' : '−' }} {{ formatRpAbs(tx.amount) }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
