<script setup lang="ts">
import { formatRp } from '@/lib/format'
import { ref, watch } from 'vue'
import { useAuth } from '@/composables/useAuth'
import type { Currency } from '@/lib/database.types'
import { useNotify } from '@/composables/useNotify'

const { profile, displayName, loading, updateProfile, uploadAvatar, setCurrency, logout } = useAuth()
const { toast } = useNotify()

const nameEdit     = ref(profile.value?.full_name ?? '')
const incomeEdit   = ref(profile.value?.monthly_income ?? 0)
const currencyEdit = ref<Currency>(profile.value?.currency ?? 'IDR')
const saving       = ref(false)
const saved        = ref(false)
const avatarLoading = ref(false)

watch(profile, (p) => {
  if (p) { nameEdit.value = p.full_name ?? ''; incomeEdit.value = p.monthly_income ?? 0; currencyEdit.value = p.currency }
})

const currencies: Currency[] = ['IDR', 'USD', 'SGD', 'EUR', 'MYR']

async function save() {
  saving.value = true
  const res = await updateProfile({ full_name: nameEdit.value, monthly_income: incomeEdit.value, currency: currencyEdit.value })
  saving.value = false
  if (!res.success) { toast.error('Gagal menyimpan profil'); return }
  saved.value = true
  toast.success('Profil disimpan')
  setTimeout(() => { saved.value = false }, 2500)
}

async function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  avatarLoading.value = true
  const res = await uploadAvatar(file)
  avatarLoading.value = false
  if (res.success) toast.success('Foto profil diperbarui')
  else toast.error('Gagal mengunggah foto')
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Profil</h1>
      <p class="page-sub">Kelola akun dan preferensi kamu</p>
    </div>

    <div class="profile-grid">
      <!-- Avatar & identity -->
      <div class="section-card">
        <h2 class="section-title">Identitas</h2>
        <div class="avatar-row">
          <div class="avatar-wrap">
            <img v-if="profile?.avatar_url" :src="profile.avatar_url" class="avatar-img" alt="avatar" />
            <div v-else class="avatar-placeholder">{{ initials(displayName) }}</div>
            <label class="avatar-upload" :class="{ loading: avatarLoading }">
              <svg v-if="!avatarLoading" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
              <span v-else class="spinner-sm"></span>
              <input class="is-hidden" type="file" accept="image/*" @change="onAvatarChange" />
            </label>
          </div>
          <div>
            <p class="identity-name">{{ displayName }}</p>
            <p class="identity-currency">{{ profile?.currency ?? 'IDR' }}</p>
          </div>
        </div>

        <div class="form-field">
          <label>Nama lengkap</label>
          <input type="text" v-model="nameEdit" placeholder="Nama kamu" />
        </div>
        <div class="form-field">
          <label>Mata uang</label>
          <select v-model="currencyEdit">
            <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <!-- Financial settings -->
      <div class="section-card">
        <h2 class="section-title">Finansial</h2>
        <div class="form-field">
          <label>Income bulanan</label>
          <div class="input-prefix-wrap">
            <span class="input-prefix">Rp</span>
            <input type="number" v-model.number="incomeEdit" placeholder="0" />
          </div>
          <p class="field-hint">Digunakan untuk menghitung alokasi budget</p>
        </div>

        <div class="income-preview" v-if="incomeEdit > 0">
          <div class="preview-row"><span>Utama (50%)</span><span>{{ formatRp(Math.round(incomeEdit * 0.5)) }}</span></div>
          <div class="preview-row"><span>Jajan (30%)</span><span>{{ formatRp(Math.round(incomeEdit * 0.3)) }}</span></div>
          <div class="preview-row"><span>Tabungan (20%)</span><span>{{ formatRp(Math.round(incomeEdit * 0.2)) }}</span></div>
        </div>
      </div>
    </div>

    <!-- Save button -->
    <div class="save-row">
      <button class="btn-save" @click="save" :disabled="saving || loading">
        <span v-if="saving" class="spinner"></span>
        <span v-else-if="saved">Tersimpan!</span>
        <span v-else>Simpan perubahan</span>
      </button>
    </div>
  </div>
</template>

<style scoped src="../styles/views/profile-view.css"></style>
