<script setup lang="ts">
import { formatAmount } from '@/lib/format'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import dayjs from 'dayjs'

const router = useRouter()
const { user, updateProfile } = useAuth()

const step = ref(1)
const income = ref<number | null>(null)
const incomeInput = ref('')
const saving = ref(false)
const error = ref('')

const utamaPct       = ref(50)
const jajanPct       = ref(30)
const tabunganPct    = ref(20)
const danaDaruratPct = ref(10)

const totalPct          = computed(() => utamaPct.value + jajanPct.value + tabunganPct.value)
const isValidTotal      = computed(() => totalPct.value === 100)
const isValidDanaDarurat = computed(() => danaDaruratPct.value <= tabunganPct.value)

const utamaAmount       = computed(() => Math.round((utamaPct.value / 100) * (income.value ?? 0)))
const jajanAmount       = computed(() => Math.round((jajanPct.value / 100) * (income.value ?? 0)))
const tabunganAmount    = computed(() => Math.round((tabunganPct.value / 100) * (income.value ?? 0)))
const danaDaruratAmount = computed(() => Math.round((danaDaruratPct.value / 100) * (income.value ?? 0)))

function onIncomeInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  income.value = raw ? Number(raw) : null
  incomeInput.value = raw ? Number(raw).toLocaleString('id-ID') : ''
}


function goToStep2() {
  if (!income.value || income.value <= 0) {
    error.value = 'Masukkan income bulanan kamu'
    return
  }
  error.value = ''
  step.value = 2
}

function resetToDefault() {
  utamaPct.value = 50
  jajanPct.value = 30
  tabunganPct.value = 20
  danaDaruratPct.value = 10
}

async function finish() {
  if (!isValidTotal.value) { error.value = 'Total alokasi harus tepat 100%'; return }
  if (!isValidDanaDarurat.value) { error.value = 'Dana darurat tidak boleh melebihi alokasi tabungan'; return }
  saving.value = true
  error.value = ''
  try {
    await updateProfile({ monthly_income: income.value!, onboarding_done: true })
    const month = dayjs().format('YYYY-MM')
    const { error: dbErr } = await supabase.from('budget_allocations').upsert({
      user_id: user.value!.id,
      month,
      utama_pct: utamaPct.value, jajan_pct: jajanPct.value,
      tabungan_pct: tabunganPct.value, dana_darurat_pct: danaDaruratPct.value,
      utama_amount: utamaAmount.value, jajan_amount: jajanAmount.value,
      tabungan_amount: tabunganAmount.value, dana_darurat_amount: danaDaruratAmount.value,
    }, { onConflict: 'user_id,month' })
    if (dbErr) throw dbErr
    router.push('/dashboard')
  } catch (err: any) {
    error.value = err.message ?? 'Terjadi kesalahan, coba lagi'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="onboarding-shell">
    <div class="ob-header">
      <div class="brand">
        <div class="brand-icon">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>
          </svg>
        </div>
        <span class="brand-name">FinTrack</span>
      </div>
      <div class="steps">
        <div class="step-item" :class="{ active: step >= 1, done: step > 1 }">
          <div class="step-dot">
            <svg v-if="step > 1" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            <span v-else>1</span>
          </div>
          <span class="step-label">Income</span>
        </div>
        <div class="step-line" :class="{ active: step > 1 }"></div>
        <div class="step-item" :class="{ active: step >= 2 }">
          <div class="step-dot"><span>2</span></div>
          <span class="step-label">Alokasi</span>
        </div>
      </div>
    </div>

    <div class="ob-content">
      <!-- Step 1 -->
      <div v-if="step === 1" class="ob-card">
        <h1 class="ob-title">Berapa income bulananmu?</h1>
        <p class="ob-sub">Ini digunakan untuk menghitung alokasi budget kamu secara otomatis.</p>
        <div class="field">
          <label>Pemasukan bulanan</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">Rp</span>
            <input type="text" inputmode="numeric" :value="incomeInput" @input="onIncomeInput" placeholder="5.000.000" autofocus />
          </div>
        </div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <button class="btn-main" @click="goToStep2">
          Lanjut ke alokasi
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <!-- Step 2 -->
      <div v-if="step === 2" class="ob-card wide">
        <div class="step2-header">
          <div>
            <h1 class="ob-title">Atur alokasi budget</h1>
            <p class="ob-sub">Income kamu: <strong>Rp {{ formatAmount(income ?? 0) }}</strong> / bulan</p>
          </div>
          <button class="btn-reset" @click="resetToDefault">Reset 50/30/20</button>
        </div>

        <div class="total-bar" :class="{ valid: isValidTotal, invalid: !isValidTotal }">
          <span>Total alokasi</span>
          <span class="total-pct">{{ totalPct }}% / 100%</span>
        </div>

        <div class="alloc-list">
          <div class="alloc-row">
            <div class="alloc-left">
              <div class="alloc-dot swatch-utama"></div>
              <div><p class="alloc-name">Utama</p><p class="alloc-desc">Kebutuhan pokok (makan, transport, tagihan)</p></div>
            </div>
            <div class="alloc-inputs">
              <div class="pct-input-wrap"><input type="number" v-model.number="utamaPct" min="0" max="100" /><span>%</span></div>
              <div class="rp-display">Rp {{ formatAmount(utamaAmount) }}</div>
            </div>
          </div>
          <div class="alloc-row">
            <div class="alloc-left">
              <div class="alloc-dot swatch-jajan"></div>
              <div><p class="alloc-name">Jajan</p><p class="alloc-desc">Keinginan (hiburan, makan enak, shopping)</p></div>
            </div>
            <div class="alloc-inputs">
              <div class="pct-input-wrap"><input type="number" v-model.number="jajanPct" min="0" max="100" /><span>%</span></div>
              <div class="rp-display">Rp {{ formatAmount(jajanAmount) }}</div>
            </div>
          </div>
          <div class="alloc-row">
            <div class="alloc-left">
              <div class="alloc-dot swatch-tabungan"></div>
              <div><p class="alloc-name">Tabungan</p><p class="alloc-desc">Saving goals + dana darurat</p></div>
            </div>
            <div class="alloc-inputs">
              <div class="pct-input-wrap"><input type="number" v-model.number="tabunganPct" min="0" max="100" /><span>%</span></div>
              <div class="rp-display">Rp {{ formatAmount(tabunganAmount) }}</div>
            </div>
          </div>
          <div class="alloc-row sub-row">
            <div class="alloc-left">
              <div class="alloc-dot swatch-darurat"></div>
              <div>
                <p class="alloc-name">↳ Dana Darurat <span class="sub-badge">bagian dari tabungan</span></p>
                <p class="alloc-desc">Khusus untuk keadaan darurat</p>
              </div>
            </div>
            <div class="alloc-inputs">
              <div class="pct-input-wrap"><input type="number" v-model.number="danaDaruratPct" min="0" :max="tabunganPct" /><span>%</span></div>
              <div class="rp-display">Rp {{ formatAmount(danaDaruratAmount) }}</div>
            </div>
          </div>
        </div>

        <div class="alloc-bar">
          <div class="bar-segment" :style="{ width: utamaPct + '%', background: '#378ADD' }"></div>
          <div class="bar-segment" :style="{ width: jajanPct + '%', background: '#EF9F27' }"></div>
          <div class="bar-segment" :style="{ width: tabunganPct + '%', background: '#1D9E75' }"></div>
        </div>
        <div class="bar-legend">
          <span><span class="legend-dot swatch-utama"></span>Utama {{ utamaPct }}%</span>
          <span><span class="legend-dot swatch-jajan"></span>Jajan {{ jajanPct }}%</span>
          <span><span class="legend-dot swatch-tabungan"></span>Tabungan {{ tabunganPct }}%</span>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="btn-row">
          <button class="btn-back" @click="step = 1">Kembali</button>
          <button class="btn-main" @click="finish" :disabled="saving || !isValidTotal">
            <span v-if="saving" class="spinner"></span>
            <span v-else>Mulai pakai FinTrack</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../styles/views/onboarding-view.css"></style>
