<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { cachedQuery } from '@/lib/offlineCache'
import { onAppActive } from '@/lib/appActive'
import { useNotify } from '@/composables/useNotify'
import dayjs from 'dayjs'

const { user, monthlyIncome, updateProfile } = useAuth()
const { toast } = useNotify()
const budget = ref<any>(null)
const transactions = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const editMode = ref(false)
const error = ref('')

const currentMonth = dayjs().format('YYYY-MM')

const utamaPct       = ref(50)
const jajanPct       = ref(30)
const tabunganPct    = ref(20)
const danaDaruratPct = ref(10)
const incomeEdit     = ref(0)

const totalPct   = computed(() => utamaPct.value + jajanPct.value + tabunganPct.value)
const isValid    = computed(() => totalPct.value === 100 && danaDaruratPct.value <= tabunganPct.value)

function amounts(pct: number) { return Math.round((pct / 100) * incomeEdit.value) }

const categories = computed(() => [
  { key: 'utama',       label: 'Utama',       color: '#378ADD', budget: budget.value?.utama_amount ?? 0 },
  { key: 'jajan',       label: 'Jajan',       color: '#EF9F27', budget: budget.value?.jajan_amount ?? 0 },
  { key: 'tabungan',    label: 'Tabungan',    color: '#1D9E75', budget: budget.value?.tabungan_amount ?? 0 },
  { key: 'dana_darurat',label: 'Dana Darurat',color: '#D85A30', budget: budget.value?.dana_darurat_amount ?? 0 },
])

const spendMap = computed(() => {
  const m: Record<string, number> = {}
  transactions.value.forEach(t => { m[t.category] = (m[t.category] ?? 0) + t.amount })
  return m
})

async function load() {
  if (!user.value) return
  const uid = user.value.id
  const [budgetRes, txRes] = await Promise.all([
    cachedQuery(`${uid}:budget`, supabase.from('budget_allocations').select('*').eq('user_id', uid).eq('month', currentMonth).single()),
    cachedQuery(`${uid}:budget-transactions`, supabase.from('transactions').select('*').eq('user_id', uid).gte('date', dayjs().startOf('month').format('YYYY-MM-DD'))),
  ])
  budget.value = budgetRes.data
  transactions.value = txRes.data ?? []
  if (budget.value) {
    utamaPct.value = budget.value.utama_pct
    jajanPct.value = budget.value.jajan_pct
    tabunganPct.value = budget.value.tabungan_pct
    danaDaruratPct.value = budget.value.dana_darurat_pct
  }
  incomeEdit.value = monthlyIncome.value
  loading.value = false
}

onMounted(load)
onAppActive(load)

async function saveBudget() {
  if (!isValid.value) { error.value = 'Total harus 100% dan dana darurat ≤ tabungan'; return }
  saving.value = true; error.value = ''
  await updateProfile({ monthly_income: incomeEdit.value })
  const payload = {
    user_id: user.value!.id, month: currentMonth,
    utama_pct: utamaPct.value, jajan_pct: jajanPct.value,
    tabungan_pct: tabunganPct.value, dana_darurat_pct: danaDaruratPct.value,
    utama_amount: amounts(utamaPct.value), jajan_amount: amounts(jajanPct.value),
    tabungan_amount: amounts(tabunganPct.value), dana_darurat_amount: amounts(danaDaruratPct.value),
  }
  const { error: dbErr } = await supabase.from('budget_allocations').upsert(payload, { onConflict: 'user_id,month' })
  if (dbErr) { error.value = dbErr.message; saving.value = false; toast.error('Gagal menyimpan budget'); return }
  budget.value = { ...budget.value, ...payload }
  editMode.value = false; saving.value = false
  toast.success('Budget disimpan')
}

function resetDefault() { utamaPct.value = 50; jajanPct.value = 30; tabunganPct.value = 20; danaDaruratPct.value = 10 }
function formatRp(v: number) { return 'Rp ' + v.toLocaleString('id-ID') }
function pct(spent: number, bud: number) { return bud > 0 ? Math.min(100, Math.round((spent / bud) * 100)) : 0 }
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Budget</h1>
        <p class="page-sub">Alokasi {{ dayjs().format('MMMM YYYY') }}</p>
      </div>
      <button class="btn-edit" @click="editMode = !editMode">{{ editMode ? 'Batal' : 'Edit budget' }}</button>
    </div>

    <div v-if="loading" class="empty-state">Memuat...</div>
    <template v-else>
      <!-- Edit mode -->
      <div v-if="editMode" class="edit-card">
        <div class="edit-header">
          <h2 class="section-title">Edit alokasi</h2>
          <button class="btn-reset" @click="resetDefault">Reset 50/30/20</button>
        </div>

        <div class="form-field">
          <label>Income bulanan</label>
          <div class="input-prefix-wrap"><span class="input-prefix">Rp</span><input type="number" v-model.number="incomeEdit" /></div>
        </div>

        <div class="total-bar" :class="{ valid: totalPct === 100, invalid: totalPct !== 100 }">
          <span>Total alokasi</span><span>{{ totalPct }}% / 100%</span>
        </div>

        <div class="alloc-rows">
          <div class="alloc-row"><div class="alloc-info"><span class="alloc-dot" style="background:#378ADD"></span><span>Utama</span></div><div class="alloc-inputs"><div class="pct-wrap"><input type="number" v-model.number="utamaPct" min="0" max="100" /><span>%</span></div><span class="rp-val">{{ formatRp(amounts(utamaPct)) }}</span></div></div>
          <div class="alloc-row"><div class="alloc-info"><span class="alloc-dot" style="background:#EF9F27"></span><span>Jajan</span></div><div class="alloc-inputs"><div class="pct-wrap"><input type="number" v-model.number="jajanPct" min="0" max="100" /><span>%</span></div><span class="rp-val">{{ formatRp(amounts(jajanPct)) }}</span></div></div>
          <div class="alloc-row"><div class="alloc-info"><span class="alloc-dot" style="background:#1D9E75"></span><span>Tabungan</span></div><div class="alloc-inputs"><div class="pct-wrap"><input type="number" v-model.number="tabunganPct" min="0" max="100" /><span>%</span></div><span class="rp-val">{{ formatRp(amounts(tabunganPct)) }}</span></div></div>
          <div class="alloc-row sub"><div class="alloc-info"><span class="alloc-dot" style="background:#D85A30"></span><span>↳ Dana Darurat</span></div><div class="alloc-inputs"><div class="pct-wrap"><input type="number" v-model.number="danaDaruratPct" min="0" :max="tabunganPct" /><span>%</span></div><span class="rp-val">{{ formatRp(amounts(danaDaruratPct)) }}</span></div></div>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
        <button class="btn-save" @click="saveBudget" :disabled="saving || !isValid">
          <span v-if="saving" class="spinner"></span><span v-else>Simpan perubahan</span>
        </button>
      </div>

      <!-- View mode -->
      <div v-else>
        <div v-if="!budget" class="empty-state">Budget bulan ini belum diset. <button class="link-btn" @click="editMode = true">Set sekarang</button></div>
        <div v-else class="budget-grid">
          <div v-for="cat in categories" :key="cat.key" class="budget-card">
            <div class="bcard-header">
              <div class="bcard-name"><span class="bcard-dot" :style="{ background: cat.color }"></span>{{ cat.label }}</div>
              <span class="bcard-pct" :class="{ over: (spendMap[cat.key] ?? 0) > cat.budget }">
                {{ pct(spendMap[cat.key] ?? 0, cat.budget) }}%
              </span>
            </div>
            <div class="progress-bar"><div class="progress-fill" :style="{ width: pct(spendMap[cat.key] ?? 0, cat.budget) + '%', background: (spendMap[cat.key] ?? 0) > cat.budget ? '#E24B4A' : cat.color }"></div></div>
            <div class="bcard-amounts">
              <span class="spent">{{ formatRp(spendMap[cat.key] ?? 0) }}</span>
              <span class="of">dari</span>
              <span class="bud">{{ formatRp(cat.budget) }}</span>
            </div>
            <div class="remaining" :class="{ over: (spendMap[cat.key] ?? 0) > cat.budget }">
              {{ (spendMap[cat.key] ?? 0) > cat.budget ? 'Melebihi budget!' : 'Sisa: ' + formatRp(cat.budget - (spendMap[cat.key] ?? 0)) }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped src="../styles/views/budget-view.css"></style>
