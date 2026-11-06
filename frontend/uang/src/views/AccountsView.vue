<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { useAuth } from '@/composables/useAuth'
import { useNotify } from '@/composables/useNotify'
import { onAppActive } from '@/lib/appActive'
import { formatRpAbs } from '@/lib/format'
import { activeAccounts, ADJUSTMENT, balanceOf, emptyLedger, loadLedger, monthlyNeed, savingsMoney, totalMoney } from '@/lib/ledger'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/database.types'

const { user } = useAuth()
const { confirmDelete, toast } = useNotify()

const ledger  = ref(emptyLedger())
const loading = ref(true)
const busy    = ref(false)
const editing = ref<string | null>(null)
const draft   = reactive({ name: '', kind: 'biasa' as Account['kind'] })
const bank    = reactive<Record<string, number | ''>>({})
const fresh   = reactive({ name: '', kind: 'biasa' as Account['kind'], opening_balance: 0, opening_date: dayjs().format('YYYY-MM-DD') })

async function load() {
  if (!user.value) return
  ledger.value = await loadLedger(user.value.id)
  loading.value = false
}

onMounted(load)
onAppActive(load)

const accounts = computed(() => activeAccounts(ledger.value).map(a => ({ ...a, balance: balanceOf(a, ledger.value) })))
const total    = computed(() => totalMoney(ledger.value))
const need     = computed(() => monthlyNeed(ledger.value.items))
const savings  = computed(() => savingsMoney(ledger.value))

const signed = (n: number) => (n < 0 ? '− ' : '') + formatRpAbs(n)
const diffOf = (a: { id: string; balance: number }) => (bank[a.id] === '' || bank[a.id] === undefined ? null : Number(bank[a.id]) - a.balance)

function startEdit(a: Account) {
  editing.value = a.id
  Object.assign(draft, { name: a.name, kind: a.kind })
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

async function saveEdit(id: string) {
  if (!draft.name.trim()) { toast.error('Nama rekening wajib diisi'); return }
  const ok = await run(() => supabase.from('accounts').update({ ...draft, name: draft.name.trim() }).eq('id', id), 'Rekening disimpan')
  if (ok) editing.value = null
}

async function addAccount() {
  if (!fresh.name.trim()) { toast.error('Nama rekening wajib diisi'); return }
  const ok = await run(
    () => supabase.from('accounts').insert({ ...fresh, name: fresh.name.trim(), user_id: user.value!.id, sort: ledger.value.accounts.length }),
    'Rekening ditambahkan',
  )
  if (ok) Object.assign(fresh, { name: '', kind: 'biasa', opening_balance: 0 })
}

async function archive(a: { id: string; name: string; balance: number }) {
  const detail = a.balance !== 0 ? `Saldonya masih ${signed(a.balance)}. Transaksinya tetap tersimpan.` : 'Transaksinya tetap tersimpan.'
  if (!(await confirmDelete(`Arsipkan rekening ${a.name}?`, detail))) return
  await run(() => supabase.from('accounts').update({ archived: true }).eq('id', a.id), 'Rekening diarsipkan')
}

async function adjust(a: { id: string; name: string; balance: number }) {
  const diff = diffOf(a)
  if (!diff) return
  const ok = await run(
    () => supabase.from('transactions').insert({
      user_id: user.value!.id,
      type: diff > 0 ? 'income' : 'expense',
      amount: Math.abs(diff),
      category: ADJUSTMENT,
      note: `Disamakan dengan saldo bank ${a.name}`,
      date: dayjs().format('YYYY-MM-DD'),
      account_id: a.id,
    }),
    'Saldo disamakan dengan bank',
  )
  if (ok) bank[a.id] = ''
}
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="title-block">
        <span class="c-kicker kicker-accent">Saldo per rekening</span>
        <h1 class="page-title">Rekening</h1>
      </div>
    </header>

    <div v-if="loading" class="loading-wrap"><div class="loading-spinner"></div><p>Memuat data…</p></div>

    <template v-else>
      <section class="summary">
        <div class="summary-item balance">
          <span class="c-kicker">Total uang</span>
          <span class="summary-value c-num">{{ signed(total) }}</span>
          <span class="summary-sub">di {{ accounts.length }} rekening</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Tabungan</span>
          <span class="summary-value c-num">{{ signed(savings) }}</span>
          <span class="summary-sub">rekening berjenis tabungan</span>
        </div>
        <div class="summary-item">
          <span class="c-kicker">Target dana darurat</span>
          <span class="summary-value c-num">{{ formatRpAbs(need * 3) }}</span>
          <span class="summary-sub">3× pengeluaran bulanan · ideal 6× {{ formatRpAbs(need * 6) }}</span>
        </div>
      </section>

      <section class="cards">
        <article v-for="a in accounts" :key="a.id" class="card">
          <div class="card-head">
            <h2 class="card-title">{{ a.name }}</h2>
            <span class="c-tag" :class="a.kind === 'tabungan' ? 'c-tag-accent' : 'c-tag-neutral'">{{ a.kind }}</span>
          </div>
          <span class="card-value c-num" :class="{ bad: a.balance < 0 }">{{ signed(a.balance) }}</span>

          <template v-if="editing === a.id">
            <div class="fields">
              <label class="field">Nama<input v-model="draft.name" class="c-input" maxlength="40" /></label>
              <label class="field">Jenis
                <select v-model="draft.kind" class="c-input"><option value="biasa">Biasa</option><option value="tabungan">Tabungan</option></select>
              </label>
            </div>
            <div class="card-actions">
              <button class="c-btn c-btn-primary" :disabled="busy" @click="saveEdit(a.id)">Simpan</button>
              <button class="c-btn c-btn-ghost" @click="editing = null">Batal</button>
            </div>
          </template>
          <div v-else class="card-actions">
            <button class="c-btn c-btn-secondary" @click="startEdit(a)">Ubah nama</button>
            <button class="c-btn c-btn-ghost" @click="archive(a)">Arsipkan</button>
          </div>

          <div class="recon">
            <label class="field">Saldo di bank sekarang<input v-model="bank[a.id]" type="number" class="c-input" placeholder="Lihat aplikasi bank, isi di sini" /></label>
            <div v-if="diffOf(a) !== null" class="recon-lines">
              <span>Menurut catatan</span><span class="c-num">{{ signed(a.balance) }}</span>
              <span>Di bank</span><span class="c-num">{{ signed(Number(bank[a.id])) }}</span>
              <span>Selisih</span>
              <span class="c-num" :class="diffOf(a) === 0 ? 'diff-ok' : 'diff-bad'">{{ diffOf(a) === 0 ? 'Cocok' : signed(diffOf(a)!) }}</span>
            </div>
            <button v-if="diffOf(a)" class="c-btn c-btn-primary" :disabled="busy" @click="adjust(a)">Samakan dengan bank</button>
            <p v-if="diffOf(a)" class="note-text">Selisihnya dicatat sebagai penyesuaian saldo, tidak dihitung sebagai pemasukan atau pengeluaran.</p>
          </div>
        </article>

        <article class="card">
          <h2 class="card-title">Rekening baru</h2>
          <div class="fields">
            <label class="field">Nama<input v-model="fresh.name" class="c-input" maxlength="40" placeholder="Misal: Dompet" /></label>
            <label class="field">Jenis
              <select v-model="fresh.kind" class="c-input"><option value="biasa">Biasa</option><option value="tabungan">Tabungan</option></select>
            </label>
            <label class="field">Saldo sekarang<input v-model.number="fresh.opening_balance" type="number" class="c-input" /></label>
          </div>
          <div class="card-actions"><button class="c-btn c-btn-primary" :disabled="busy" @click="addAccount">Tambah rekening</button></div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped src="../styles/views/dashboard-view.css"></style>
<style scoped src="../styles/views/ledger-view.css"></style>
