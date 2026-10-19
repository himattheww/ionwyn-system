<script setup lang="ts">
import { formatRp } from '@/lib/format'
import { categoryLabel } from '@/lib/categories'
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { cachedQuery, isOffline } from '@/lib/offlineCache'
import { pendingItems, addPending, removePending } from '@/lib/pending'
import { onAppActive } from '@/lib/appActive'
import { computeAllowance, describeSpending } from '@/lib/dailyAllowance'
import { useNotify } from '@/composables/useNotify'
import dayjs from 'dayjs'

const { user } = useAuth()
const { confirmDelete, toast } = useNotify()

// ─── State ────────────────────────────────────────────────────────
const transactions = ref<any[]>([])
const recurrings   = ref<any[]>([])
const loading      = ref(true)
const tab          = ref<'transactions' | 'recurring'>('transactions')
const showForm     = ref(false)
const showRecurringForm = ref(false)
const saving       = ref(false)
const error        = ref('')

const filterType  = ref<'all' | 'income' | 'expense'>('all')
const filterMonth = ref(dayjs().format('YYYY-MM'))

// ─── Transaction form ─────────────────────────────────────────────
const form = ref({
  type: 'expense' as 'income' | 'expense',
  amount: '',
  category: 'jajan',
  note: '',
  date: dayjs().format('YYYY-MM-DD'),
})

// ─── Recurring form ───────────────────────────────────────────────
const rForm = ref({
  name: '',
  type: 'expense' as 'income' | 'expense',
  amount: '',
  category: 'utama',
  frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
  start_date: dayjs().format('YYYY-MM-DD'),
})

const expenseCategories = ['utama', 'jajan', 'tabungan', 'dana_darurat']
const incomeCategories  = ['gaji', 'freelance', 'bisnis', 'lainnya']
const frequencyLabels: Record<string, string> = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' }

const categoryOptions = computed(() => form.value.type === 'expense' ? expenseCategories : incomeCategories)
const rCategoryOptions = computed(() => rForm.value.type === 'expense' ? expenseCategories : incomeCategories)

const allTransactions = computed(() =>
  [...pendingItems.value.map(p => ({ ...p, pending: true })), ...transactions.value]
    .sort((a, b) => b.date.localeCompare(a.date))
)

const filtered = computed(() =>
  allTransactions.value.filter(t => {
    const matchType  = filterType.value === 'all' || t.type === filterType.value
    const matchMonth = t.date.startsWith(filterMonth.value)
    return matchType && matchMonth
  })
)

const totalIncome  = computed(() => filtered.value.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))
const totalExpense = computed(() => filtered.value.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))

// Recurring yang jatuh tempo dalam 7 hari ke depan
const dueSoon = computed(() =>
  recurrings.value.filter(r => r.is_active && dayjs(r.next_due_date).diff(dayjs(), 'day') <= 7)
)

// ─── Lifecycle ────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([fetchTransactions(), fetchRecurrings()])
  await processOverdueRecurrings()
})

onAppActive(() => Promise.all([fetchTransactions(), fetchRecurrings()]))

watch(() => pendingItems.value.length, (now, before) => {
  if (now < before) fetchTransactions()
})

async function fetchTransactions() {
  if (!user.value) return
  loading.value = true
  const { data } = await cachedQuery(`${user.value.id}:transactions`,
    supabase.from('transactions').select('*')
      .eq('user_id', user.value.id).order('date', { ascending: false }))
  transactions.value = data ?? []
  loading.value = false
}

async function fetchRecurrings() {
  if (!user.value) return
  const { data } = await cachedQuery(`${user.value.id}:recurrings`,
    supabase.from('recurring_transactions').select('*')
      .eq('user_id', user.value.id).order('next_due_date', { ascending: true }))
  recurrings.value = data ?? []
}

// Auto-generate transaksi untuk recurring yang sudah lewat due date
async function processOverdueRecurrings() {
  if (!user.value || isOffline.value) return
  const overdue = recurrings.value.filter(r => r.is_active && dayjs(r.next_due_date).isBefore(dayjs(), 'day'))
  for (const r of overdue) {
    // Insert transaksi
    await supabase.from('transactions').insert({
      user_id: user.value.id,
      type: r.type,
      amount: r.amount,
      category: r.category,
      note: r.name,
      date: r.next_due_date,
      recurring_id: r.id,
    })
    // Hitung next due date
    const next = calcNextDue(r.next_due_date, r.frequency)
    await supabase.from('recurring_transactions').update({ next_due_date: next }).eq('id', r.id)
  }
  if (overdue.length > 0) {
    await Promise.all([fetchTransactions(), fetchRecurrings()])
  }
}

function calcNextDue(from: string, frequency: string) {
  const map: Record<string, dayjs.ManipulateType> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }
  return dayjs(from).add(1, map[frequency]).format('YYYY-MM-DD')
}

// ─── Transaction CRUD ─────────────────────────────────────────────
function openForm() {
  form.value = { type: 'expense', amount: '', category: 'jajan', note: '', date: dayjs().format('YYYY-MM-DD') }
  error.value = ''
  showForm.value = true
}

function onTypeChange() {
  form.value.category = form.value.type === 'expense' ? 'jajan' : 'gaji'
}

async function saveTransaction() {
  if (!form.value.amount || Number(form.value.amount) <= 0) { error.value = 'Masukkan jumlah yang valid'; return }
  saving.value = true; error.value = ''
  const payload = {
    id: crypto.randomUUID(),
    user_id: user.value!.id,
    type: form.value.type,
    amount: Number(form.value.amount),
    category: form.value.category,
    note: form.value.note || null,
    date: form.value.date,
  }
  const { error: dbErr, status } = await supabase.from('transactions').insert(payload)
  if (dbErr && status === 0) {
    addPending(payload)
    showForm.value = false
    saving.value = false
    toast.info('Tidak ada koneksi, transaksi disimpan sebagai pending')
    return
  }
  if (dbErr) { error.value = dbErr.message; saving.value = false; return }
  showForm.value = false
  await fetchTransactions()
  saving.value = false

  const { data: budget } = await supabase.from('budget_allocations').select('*')
    .eq('user_id', user.value!.id).eq('month', dayjs().format('YYYY-MM')).maybeSingle()
  const allowance = computeAllowance(budget, [...transactions.value, ...pendingItems.value])
  const note = describeSpending(payload, allowance)
  if (note) toast[note.tone](`Tersimpan. ${note.text}`)
  else toast.success('Transaksi disimpan')
}

async function deleteTransaction(id: string) {
  const tx = allTransactions.value.find(t => t.id === id)
  const detail = tx ? `${categoryLabel(tx.category)} · ${formatRp(tx.amount)}${tx.note ? ` · ${tx.note}` : ''}` : undefined
  if (!(await confirmDelete('Hapus transaksi ini?', detail))) return
  if (tx?.pending) {
    removePending(id)
    toast.success('Transaksi dihapus')
    return
  }
  const { error: dbErr } = await supabase.from('transactions').delete().eq('id', id)
  if (dbErr) { toast.error('Gagal menghapus: ' + dbErr.message); return }
  transactions.value = transactions.value.filter(t => t.id !== id)
  toast.success('Transaksi dihapus')
}

// ─── Recurring CRUD ───────────────────────────────────────────────
function openRecurringForm() {
  rForm.value = { name: '', type: 'expense', amount: '', category: 'utama', frequency: 'monthly', start_date: dayjs().format('YYYY-MM-DD') }
  error.value = ''
  showRecurringForm.value = true
}

function onRTypeChange() {
  rForm.value.category = rForm.value.type === 'expense' ? 'utama' : 'gaji'
}

async function saveRecurring() {
  if (!rForm.value.name || !rForm.value.amount) { error.value = 'Nama dan jumlah wajib diisi'; return }
  saving.value = true; error.value = ''
  const { error: dbErr } = await supabase.from('recurring_transactions').insert({
    user_id: user.value!.id,
    name: rForm.value.name,
    type: rForm.value.type,
    amount: Number(rForm.value.amount),
    category: rForm.value.category,
    frequency: rForm.value.frequency,
    start_date: rForm.value.start_date,
    next_due_date: rForm.value.start_date,
    is_active: true,
  })
  if (dbErr) { error.value = dbErr.message; saving.value = false; return }
  showRecurringForm.value = false
  await fetchRecurrings()
  saving.value = false
  toast.success('Tagihan berulang disimpan')
}

async function toggleRecurring(r: any) {
  const { error: dbErr } = await supabase.from('recurring_transactions').update({ is_active: !r.is_active }).eq('id', r.id)
  if (dbErr) { toast.error('Gagal mengubah status: ' + dbErr.message); return }
  r.is_active = !r.is_active
  toast.info(r.is_active ? `${r.name} diaktifkan` : `${r.name} dijeda`)
}

async function deleteRecurring(id: string) {
  const rc = recurrings.value.find(r => r.id === id)
  const detail = rc ? `${rc.name} · ${formatRp(rc.amount)}` : undefined
  if (!(await confirmDelete('Hapus tagihan berulang ini?', detail))) return
  const { error: dbErr } = await supabase.from('recurring_transactions').delete().eq('id', id)
  if (dbErr) { toast.error('Gagal menghapus: ' + dbErr.message); return }
  recurrings.value = recurrings.value.filter(r => r.id !== id)
  toast.success('Tagihan berulang dihapus')
}

// ─── Helpers ─────────────────────────────────────────────────────
function daysUntil(date: string) {
  const diff = dayjs(date).diff(dayjs(), 'day')
  if (diff < 0) return 'Terlewat'
  if (diff === 0) return 'Hari ini'
  return `${diff} hari lagi`
}
function daysUntilClass(date: string) {
  const diff = dayjs(date).diff(dayjs(), 'day')
  if (diff < 0) return 'overdue'
  if (diff <= 3) return 'soon'
  return ''
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Transaksi</h1>
        <p class="page-sub">Kelola pemasukan dan pengeluaranmu</p>
      </div>
      <div class="header-actions">
        <button v-if="tab === 'transactions'" class="btn-add" @click="openForm">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Tambah transaksi
        </button>
        <button v-else class="btn-add" @click="openRecurringForm">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
          Tambah tagihan
        </button>
      </div>
    </div>

    <!-- Due soon alert -->
    <div v-if="dueSoon.length > 0" class="due-alert">
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      <span>{{ dueSoon.length }} tagihan jatuh tempo dalam 7 hari ke depan</span>
      <button class="due-see" @click="tab = 'recurring'">Lihat →</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab-btn" :class="{ active: tab === 'transactions' }" @click="tab = 'transactions'">Transaksi</button>
      <button class="tab-btn" :class="{ active: tab === 'recurring' }" @click="tab = 'recurring'">
        Tagihan Berulang
        <span v-if="recurrings.filter(r => r.is_active).length" class="tab-badge">{{ recurrings.filter(r => r.is_active).length }}</span>
      </button>
    </div>

    <!-- ── TRANSACTIONS TAB ── -->
    <template v-if="tab === 'transactions'">
      <div class="summary-row">
        <div class="summary-card income"><p class="summary-label">Pemasukan</p><p class="summary-val">{{ formatRp(totalIncome) }}</p></div>
        <div class="summary-card expense"><p class="summary-label">Pengeluaran</p><p class="summary-val">{{ formatRp(totalExpense) }}</p></div>
        <div class="summary-card"><p class="summary-label">Selisih</p><p class="summary-val" :class="totalIncome - totalExpense >= 0 ? 'pos' : 'neg'">{{ formatRp(totalIncome - totalExpense) }}</p></div>
      </div>

      <div class="filters">
        <input type="month" v-model="filterMonth" class="filter-input" />
        <div class="filter-tabs">
          <button v-for="t in ['all','income','expense']" :key="t" class="filter-tab" :class="{ active: filterType === t }" @click="filterType = t as any">
            {{ t === 'all' ? 'Semua' : t === 'income' ? 'Pemasukan' : 'Pengeluaran' }}
          </button>
        </div>
      </div>

      <div class="list-card">
        <div v-if="loading" class="empty-state">Memuat...</div>
        <div v-else-if="filtered.length === 0" class="empty-state">Tidak ada transaksi di periode ini.</div>
        <div v-else>
          <div v-for="tx in filtered" :key="tx.id" class="tx-row">
            <div class="tx-icon" :style="{ background: tx.type === 'income' ? 'var(--color-accent-100)' : '#FCEBEB' }">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" :style="{ stroke: tx.type === 'income' ? 'var(--color-accent-700)' : '#E24B4A' }" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" :d="tx.type === 'income' ? 'M5 10l7-7m0 0l7 7m-7-7v18' : 'M19 14l-7 7m0 0l-7-7m7 7V3'"/>
              </svg>
            </div>
            <div class="tx-info">
              <p class="tx-cat">{{ categoryLabel(tx.category) }}<span v-if="tx.recurring_id" class="recurring-tag">Berulang</span><span v-if="tx.pending" class="pending-tag">Pending</span></p>
              <p class="tx-meta">{{ dayjs(tx.date).format('DD MMM YYYY') }}<span v-if="tx.note"> · {{ tx.note }}</span></p>
            </div>
            <div class="tx-amount" :class="tx.type === 'income' ? 'income' : 'expense'">
              {{ tx.type === 'income' ? '+' : '−' }} {{ formatRp(tx.amount) }}
            </div>
            <button class="tx-delete" @click="deleteTransaction(tx.id)" aria-label="Hapus">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── RECURRING TAB ── -->
    <template v-if="tab === 'recurring'">
      <div v-if="recurrings.length === 0" class="empty-big">
        <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--color-border-secondary)" stroke-width="1"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
        <p>Belum ada tagihan berulang.</p>
        <button class="btn-add" @click="openRecurringForm">Tambah tagihan pertama</button>
      </div>

      <div v-else class="recurring-list">
        <div v-for="r in recurrings" :key="r.id" class="recurring-card" :class="{ inactive: !r.is_active }">
          <div class="rc-left">
            <div class="rc-icon" :style="{ background: r.type === 'income' ? 'var(--color-accent-100)' : '#FAECE7' }">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" :style="{ stroke: r.type === 'income' ? 'var(--color-accent-700)' : '#D85A30' }" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </div>
            <div>
              <p class="rc-name">{{ r.name }}</p>
              <p class="rc-meta">{{ categoryLabel(r.category) }} · {{ frequencyLabels[r.frequency] }}</p>
            </div>
          </div>

          <div class="rc-mid">
            <p class="rc-due" :class="daysUntilClass(r.next_due_date)">
              {{ r.is_active ? daysUntil(r.next_due_date) : 'Nonaktif' }}
            </p>
            <p class="rc-date">{{ dayjs(r.next_due_date).format('DD MMM YYYY') }}</p>
          </div>

          <div class="rc-amount" :class="r.type === 'income' ? 'income' : 'expense'">
            {{ r.type === 'income' ? '+' : '−' }} {{ formatRp(r.amount) }}
          </div>

          <div class="rc-actions">
            <button class="rc-toggle" @click="toggleRecurring(r)" :title="r.is_active ? 'Nonaktifkan' : 'Aktifkan'">
              <svg v-if="r.is_active" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
              <svg v-else width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </button>
            <button class="rc-del" @click="deleteRecurring(r.id)" aria-label="Hapus">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── TRANSACTION FORM MODAL ── -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Tambah transaksi</h2>
          <button class="modal-close" @click="showForm = false"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="type-tabs">
          <button :class="['type-tab', { active: form.type === 'expense' }]" @click="form.type = 'expense'; onTypeChange()">Pengeluaran</button>
          <button :class="['type-tab', { active: form.type === 'income' }]" @click="form.type = 'income'; onTypeChange()">Pemasukan</button>
        </div>
        <div class="form-field"><label>Jumlah</label><div class="input-prefix-wrap"><span class="input-prefix">Rp</span><input type="number" v-model="form.amount" placeholder="0" min="0" /></div></div>
        <div class="form-field"><label>Kategori</label><select v-model="form.category"><option v-for="c in categoryOptions" :key="c" :value="c">{{ categoryLabel(c) }}</option></select></div>
        <div class="form-field"><label>Tanggal</label><input type="date" v-model="form.date" /></div>
        <div class="form-field"><label>Catatan (opsional)</label><input type="text" v-model="form.note" placeholder="Misal: makan siang, belanja bulanan..." /></div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showForm = false">Batal</button>
          <button class="btn-save" @click="saveTransaction" :disabled="saving"><span v-if="saving" class="spinner"></span><span v-else>Simpan</span></button>
        </div>
      </div>
    </div>

    <!-- ── RECURRING FORM MODAL ── -->
    <div v-if="showRecurringForm" class="modal-overlay" @click.self="showRecurringForm = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Tambah tagihan berulang</h2>
          <button class="modal-close" @click="showRecurringForm = false"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="type-tabs">
          <button :class="['type-tab', { active: rForm.type === 'expense' }]" @click="rForm.type = 'expense'; onRTypeChange()">Pengeluaran</button>
          <button :class="['type-tab', { active: rForm.type === 'income' }]" @click="rForm.type = 'income'; onRTypeChange()">Pemasukan</button>
        </div>
        <div class="form-field"><label>Nama tagihan</label><input type="text" v-model="rForm.name" placeholder="Misal: Spotify, Kos, Cicilan HP..." /></div>
        <div class="form-field"><label>Jumlah</label><div class="input-prefix-wrap"><span class="input-prefix">Rp</span><input type="number" v-model="rForm.amount" placeholder="0" min="0" /></div></div>
        <div class="form-field"><label>Kategori</label><select v-model="rForm.category"><option v-for="c in rCategoryOptions" :key="c" :value="c">{{ categoryLabel(c) }}</option></select></div>
        <div class="form-field"><label>Frekuensi</label>
          <select v-model="rForm.frequency">
            <option v-for="(label, key) in frequencyLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </div>
        <div class="form-field"><label>Mulai tanggal</label><input type="date" v-model="rForm.start_date" /></div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showRecurringForm = false">Batal</button>
          <button class="btn-save" @click="saveRecurring" :disabled="saving"><span v-if="saving" class="spinner"></span><span v-else>Simpan</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../styles/views/transactions-view.css"></style>
