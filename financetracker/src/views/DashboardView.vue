<script setup lang="ts">
import { cappedPercent, formatRpAbs, percentOf } from '@/lib/format'
import { categoryLabel } from '@/lib/categories'
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { cachedQuery } from '@/lib/offlineCache'
import { onAppActive } from '@/lib/appActive'
import { pendingItems } from '@/lib/pending'
import { computeAllowance, formatRupiah } from '@/lib/dailyAllowance'
import dayjs from 'dayjs'
import { useExportPDF } from '@/composables/useExportPDF'
import 'dayjs/locale/id'
dayjs.locale('id')

const { user, monthlyIncome, displayName } = useAuth()
const { exporting, exportMonthlyReport } = useExportPDF()

async function doExport() {
  if (!user.value) return
  await exportMonthlyReport(user.value.id, selectedExportMonth.value, displayName.value)
}

const selectedExportMonth = ref(dayjs().format('YYYY-MM'))
const transactions = ref<any[]>([])
const budget       = ref<any>(null)
const goals        = ref<any[]>([])
const loading      = ref(true)

const currentMonth = dayjs().format('YYYY-MM')
const todayLabel   = dayjs().format('dddd, D MMMM YYYY')
const monthName    = dayjs().format('MMMM')
const firstName    = computed(() => (displayName.value ?? '').split(' ')[0])
const greeting     = computed(() => {
  const h = dayjs().hour()
  if (h < 12) return 'Selamat pagi'
  if (h < 18) return 'Selamat siang'
  return 'Selamat malam'
})

async function load() {
  if (!user.value) return
  const uid = user.value.id
  const [txRes, budgetRes, goalsRes] = await Promise.all([
    cachedQuery(`${uid}:dash-transactions`, supabase.from('transactions').select('*').eq('user_id', uid)
      .gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))
      .order('date', { ascending: false })),
    cachedQuery(`${uid}:dash-budget`, supabase.from('budget_allocations').select('*').eq('user_id', uid).eq('month', currentMonth).single()),
    cachedQuery(`${uid}:dash-goals`, supabase.from('saving_goals').select('*').eq('user_id', uid).eq('is_completed', false).limit(3)),
  ])
  transactions.value = txRes.data ?? []
  budget.value       = budgetRes.data
  goals.value        = goalsRes.data ?? []
  loading.value      = false
}

onMounted(load)
onAppActive(load)

const totalIncome  = computed(() => transactions.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const totalExpense = computed(() => transactions.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))
const balance      = computed(() => totalIncome.value - totalExpense.value)
const savingRate   = computed(() => monthlyIncome.value > 0 ? Math.round((balance.value / monthlyIncome.value) * 100) : 0)

const allowance = computed(() => computeAllowance(budget.value, [...transactions.value, ...pendingItems.value]))
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
const tomorrowNote = computed(() => {
  const a = allowance.value
  if (!a) return ''
  const diff = a.tomorrowAllowance - a.todayAllowance
  if (Math.abs(diff) < 1) return 'sama dengan hari ini'
  return diff < 0 ? `turun ${formatRupiah(-diff)} dari hari ini` : `naik ${formatRupiah(diff)} dari hari ini`
})

const categorySpend = computed(() => {
  const cats = ['utama', 'jajan', 'tabungan', 'dana_darurat']
  return cats.map(cat => ({
    key: cat,
    label: { utama: 'Utama', jajan: 'Jajan', tabungan: 'Tabungan', dana_darurat: 'Dana darurat' }[cat] ?? cat,
    hint: cat === 'utama' || cat === 'jajan' ? 'harian' : 'diambil',
    spent:  transactions.value.filter(t => t.category === cat).reduce((s, t) => s + t.amount, 0),
    budget: budget.value?.[`${cat}_amount`] ?? 0,
  }))
})

const recentTx = computed(() => transactions.value.slice(0, 5))

const goalProgress = (g: any) => cappedPercent(g.current_amount, g.target_amount)
const pctSpent = (cat: any) => percentOf(cat.spent, cat.budget)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">{{ todayLabel }}</span>
        <h1 class="page-title">{{ greeting }}, {{ firstName }}</h1>
      </div>
      <div class="header-actions">
        <input type="month" v-model="selectedExportMonth" class="c-input" />
        <button class="c-btn c-btn-secondary" @click="doExport" :disabled="exporting">
          <svg v-if="!exporting" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>
          <span v-else class="spinner-sm"></span>
          {{ exporting ? 'Membuat PDF…' : 'Export PDF' }}
        </button>
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
      <section v-if="allowance" class="allowance">
        <div class="allow-main">
          <div class="allow-head">
            <span class="c-kicker">Bisa dipakai hari ini</span>
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
            <span>Jatah {{ formatRupiah(allowance.todayAllowance) }}</span>
          </div>
        </div>

        <div class="allow-side">
          <div class="side-row">
            <span class="side-label">Sisa alokasi Utama + Jajan</span>
            <span class="side-value c-num">{{ formatRupiah(allowance.poolLeft) }}</span>
            <span class="side-label">untuk {{ allowance.daysLeft }} hari tersisa di {{ monthName }}</span>
          </div>
          <div class="side-row">
            <span class="side-label">Jatah besok</span>
            <span class="side-value c-num">{{ formatRupiah(allowance.tomorrowAllowance) }}</span>
            <span class="side-label">{{ tomorrowNote }}</span>
          </div>
          <p v-if="allowance.takenTabungan > 0" class="allow-note">
            Bulan ini kamu mengambil {{ formatRupiah(allowance.takenTabungan) }} dari tabungan (alokasi {{ formatRupiah(allowance.allocTabungan) }}).
          </p>
          <p v-if="allowance.takenDanaDarurat > 0" class="allow-note">
            Bulan ini kamu mengambil {{ formatRupiah(allowance.takenDanaDarurat) }} dari dana darurat (alokasi {{ formatRupiah(allowance.allocDanaDarurat) }}).
          </p>
        </div>
      </section>

      <section v-else class="allow-empty">
        <span class="c-kicker kicker-accent">Jatah harian</span>
        <h2 class="empty-title">Atur budget bulan ini dulu</h2>
        <p class="empty-body">Jatah harian dihitung dari alokasi Utama + Jajan dibagi sisa hari di bulan ini.</p>
        <RouterLink to="/budget" class="c-btn c-btn-primary">Atur budget</RouterLink>
      </section>

      <section class="summary">
        <div class="summary-item">
          <span class="c-kicker">Pemasukan</span>
          <span class="summary-value c-num income">{{ formatRpAbs(totalIncome) }}</span>
          <span class="summary-sub">bulan ini</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Pengeluaran</span>
          <span class="summary-value c-num">{{ formatRpAbs(totalExpense) }}</span>
          <span class="summary-sub">bulan ini</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Sisa saldo</span>
          <span class="summary-value c-num">{{ balance < 0 ? '− ' : '' }}{{ formatRpAbs(balance) }}</span>
          <span class="summary-sub">{{ balance >= 0 ? 'surplus' : 'defisit' }}</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Saving rate</span>
          <span class="summary-value c-num">{{ savingRate }}%</span>
          <span class="summary-sub">dari pemasukan</span>
        </div>
      </section>

      <section class="two-col">
        <div class="block">
          <div class="block-head">
            <h2 class="block-title">Alokasi budget</h2>
            <RouterLink to="/budget" class="block-link">Detail</RouterLink>
          </div>
          <p v-if="!budget" class="empty-inline">Budget belum diset. <RouterLink to="/budget">Set sekarang</RouterLink></p>
          <div v-else class="rows">
            <div v-for="cat in categorySpend" :key="cat.key" class="budget-row">
              <div class="row-top">
                <span class="row-name">{{ cat.label }} <em class="row-hint">{{ cat.hint }}</em></span>
                <span class="row-pct c-num" :class="{ over: cat.spent > cat.budget }">{{ pctSpent(cat) }}%</span>
              </div>
              <div class="rule-track">
                <div class="rule-fill" :class="{ over: cat.spent > cat.budget }" :style="{ width: Math.min(pctSpent(cat), 100) + '%' }"></div>
              </div>
              <span class="row-amounts c-num">{{ formatRpAbs(cat.spent) }} <span class="muted">/ {{ formatRpAbs(cat.budget) }}</span></span>
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
            <span>Tanggal</span><span>Kategori</span><span>Catatan</span><span class="right">Jumlah</span>
          </div>
          <div v-for="tx in recentTx" :key="tx.id" class="tx-row">
            <span class="tx-date c-num">{{ dayjs(tx.date).format('DD MMM') }}</span>
            <span>{{ categoryLabel(tx.category) }}</span>
            <span class="tx-note">{{ tx.note }}</span>
            <span class="tx-amount c-num right" :class="{ income: tx.type === 'income' }">
              {{ tx.type === 'income' ? '+' : '−' }} {{ formatRpAbs(tx.amount) }}
            </span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
