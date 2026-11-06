<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useNotify } from '@/composables/useNotify'
import { onAppActive } from '@/lib/appActive'
import { cappedPercent, formatRpAbs } from '@/lib/format'
import { debtStatus, emptyLedger, loadLedger } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'
import type { Debt } from '@/lib/database.types'

type Draft = { name: string; kind: Debt['kind']; total: number; paid_before: number; monthly: number | null; note: string }

const { user } = useAuth()
const { confirmDelete, toast } = useNotify()

const ledger  = ref(emptyLedger())
const loading = ref(true)
const busy    = ref(false)
const editing = ref<string | null>(null)
const blank   = (): Draft => ({ name: '', kind: 'cicilan', total: 0, paid_before: 0, monthly: null, note: '' })
const draft   = reactive<Draft>(blank())
const fresh   = reactive<Draft>(blank())

async function load() {
  if (!user.value) return
  ledger.value = await loadLedger(user.value.id)
  loading.value = false
}

onMounted(load)
onAppActive(load)

const debts = computed(() => ledger.value.debts.map(d => ({ ...d, status: debtStatus(d, ledger.value.txs) })))
const totalRemaining = computed(() => debts.value.reduce((s, d) => s + d.status.remaining, 0))
const totalMonthly   = computed(() => debts.value.filter(d => !d.status.done).reduce((s, d) => s + Number(d.monthly ?? 0), 0))

const clean = (d: Draft) => ({ ...d, name: d.name.trim(), monthly: d.monthly || null, note: d.note.trim() || null })
const valid = (d: Draft) => {
  if (!d.name.trim() || !(d.total > 0)) { toast.error('Isi nama dan total pinjaman'); return false }
  return true
}

async function run(task: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
  busy.value = true
  const { error } = await task()
  busy.value = false
  if (error) { toast.error('Gagal: ' + error.message); return false }
  toast.success(done)
  await load()
  return true
}

function startEdit(d: Debt) {
  editing.value = d.id
  Object.assign(draft, { name: d.name, kind: d.kind, total: Number(d.total), paid_before: Number(d.paid_before), monthly: d.monthly ? Number(d.monthly) : null, note: d.note ?? '' })
}

async function saveEdit(id: string) {
  if (!valid(draft)) return
  if (await run(() => supabase.from('debts').update(clean(draft)).eq('id', id), 'Disimpan')) editing.value = null
}

async function addDebt() {
  if (!valid(fresh)) return
  if (await run(() => supabase.from('debts').insert({ ...clean(fresh), user_id: user.value!.id }), 'Ditambahkan')) Object.assign(fresh, blank())
}

async function archive(d: Debt) {
  if (!(await confirmDelete(`Arsipkan ${d.name}?`, 'Pembayaran yang sudah tercatat tetap ada.'))) return
  await run(() => supabase.from('debts').update({ archived: true }).eq('id', d.id), 'Diarsipkan')
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">Kewajiban</span>
        <h1 class="page-title">Cicilan &amp; Utang</h1>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap"><div class="loading-spinner"></div><p>Memuat data…</p></div>

    <template v-else>
      <section class="summary">
        <div class="summary-item balance">
          <span class="c-kicker">Sisa semua kewajiban</span>
          <span class="summary-value c-num">{{ formatRpAbs(totalRemaining) }}</span>
          <span class="summary-sub">{{ debts.filter(d => !d.status.done).length }} belum lunas</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Cicilan per bulan</span>
          <span class="summary-value c-num">{{ formatRpAbs(totalMonthly) }}</span>
          <span class="summary-sub">dari yang belum lunas</span>
        </div>
      </section>

      <p class="note-text">Pembayaran dicatat sebagai pengeluaran dengan pilihan "Bayar cicilan/utang". Pos budget yang terhubung ke cicilan otomatis memilihnya.</p>

      <section class="cards">
        <article v-for="d in debts" :key="d.id" class="card">
          <div class="card-head">
            <h2 class="card-title">{{ d.name }}</h2>
            <span class="c-tag" :class="d.status.done ? 'c-tag-accent' : 'c-tag-neutral'">{{ d.status.done ? 'lunas' : d.kind }}</span>
          </div>
          <span class="card-value c-num">{{ formatRpAbs(d.status.remaining) }}</span>
          <p class="card-meta">sisa dari {{ formatRpAbs(d.total) }} · sudah dibayar {{ formatRpAbs(d.status.paid) }}</p>
          <div class="rule-track"><div class="rule-fill accent" :style="{ width: cappedPercent(d.status.paid, d.total) + '%' }"></div></div>
          <p v-if="d.monthly && !d.status.done" class="card-meta">
            {{ formatRpAbs(d.monthly) }}/bulan · {{ d.status.monthsLeft }} bulan lagi · lunas {{ d.status.payoff?.format('MMMM YYYY') }}
            <template v-if="d.status.paidThisMonth"> · bulan ini sudah dibayar</template>
          </p>
          <p v-if="d.note" class="card-meta">{{ d.note }}</p>

          <template v-if="editing === d.id">
            <div class="fields">
              <label class="field">Nama<input v-model="draft.name" class="c-input" maxlength="60" /></label>
              <label class="field">Jenis
                <select v-model="draft.kind" class="c-input"><option value="cicilan">Cicilan</option><option value="utang">Utang</option></select>
              </label>
              <label class="field">Total<input v-model.number="draft.total" type="number" class="c-input" /></label>
              <label class="field">Sudah dibayar sebelum dicatat<input v-model.number="draft.paid_before" type="number" class="c-input" /></label>
              <label class="field">Per bulan<input v-model.number="draft.monthly" type="number" class="c-input" placeholder="kosongkan bila tidak tetap" /></label>
              <label class="field">Catatan<input v-model="draft.note" class="c-input" /></label>
            </div>
            <div class="card-actions">
              <button class="c-btn c-btn-primary" :disabled="busy" @click="saveEdit(d.id)">Simpan</button>
              <button class="c-btn c-btn-ghost" @click="editing = null">Batal</button>
            </div>
          </template>
          <div v-else class="card-actions">
            <RouterLink v-if="!d.status.done" :to="{ path: '/transactions', query: { bayar: d.id } }" class="c-btn c-btn-primary">Bayar</RouterLink>
            <button class="c-btn c-btn-secondary" @click="startEdit(d)">Ubah</button>
            <button class="c-btn c-btn-ghost" @click="archive(d)">Arsipkan</button>
          </div>
        </article>

        <article class="card">
          <h2 class="card-title">Tambah cicilan / utang</h2>
          <div class="fields">
            <label class="field">Nama<input v-model="fresh.name" class="c-input" maxlength="60" placeholder="Misal: Garmin" /></label>
            <label class="field">Jenis
              <select v-model="fresh.kind" class="c-input"><option value="cicilan">Cicilan</option><option value="utang">Utang</option></select>
            </label>
            <label class="field">Total<input v-model.number="fresh.total" type="number" class="c-input" /></label>
            <label class="field">Sudah dibayar sebelum dicatat<input v-model.number="fresh.paid_before" type="number" class="c-input" /></label>
            <label class="field">Per bulan<input v-model.number="fresh.monthly" type="number" class="c-input" placeholder="kosongkan bila tidak tetap" /></label>
            <label class="field">Catatan<input v-model="fresh.note" class="c-input" placeholder="Misal: ke siapa" /></label>
          </div>
          <div class="card-actions"><button class="c-btn c-btn-primary" :disabled="busy" @click="addDebt">Tambah</button></div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
<style scoped src="../styles/views/ledger-view.css"></style>
