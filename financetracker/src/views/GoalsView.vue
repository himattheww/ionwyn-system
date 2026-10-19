<script setup lang="ts">
import { cappedPercent, formatRp } from '@/lib/format'
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { supabase } from '@/lib/supabase'
import { cachedQuery } from '@/lib/offlineCache'
import { onAppActive } from '@/lib/appActive'
import { useNotify } from '@/composables/useNotify'
import dayjs from 'dayjs'

const { user } = useAuth()
const { confirmDelete, promptAmount, toast } = useNotify()
const goals   = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const saving  = ref(false)
const error   = ref('')
const form    = ref({ name: '', target_amount: '', deadline: '' })

onMounted(fetchGoals)
onAppActive(fetchGoals)

async function fetchGoals() {
  if (!user.value) return
  loading.value = true
  const { data } = await cachedQuery(`${user.value.id}:goals`,
    supabase.from('saving_goals').select('*')
      .eq('user_id', user.value.id).order('created_at', { ascending: false }))
  goals.value   = data ?? []
  loading.value = false
}

async function saveGoal() {
  if (!form.value.name || !form.value.target_amount) { error.value = 'Nama dan target wajib diisi'; return }
  saving.value = true; error.value = ''
  const { error: dbErr } = await supabase.from('saving_goals').insert({
    user_id: user.value!.id,
    name: form.value.name,
    target_amount: Number(form.value.target_amount),
    current_amount: 0,
    deadline: form.value.deadline || null,
  })
  if (dbErr) { error.value = dbErr.message; saving.value = false; return }
  showForm.value = false
  form.value     = { name: '', target_amount: '', deadline: '' }
  await fetchGoals()
  saving.value = false
  toast.success('Goal dibuat')
}

async function addFunds(goal: any) {
  const input = await promptAmount(`Tambah dana ke "${goal.name}"`, `Sudah terkumpul Rp ${goal.current_amount.toLocaleString('id-ID')} dari Rp ${goal.target_amount.toLocaleString('id-ID')}`)
  if (input === null) return
  const newAmount    = Math.min(goal.current_amount + input, goal.target_amount)
  const isCompleted  = newAmount >= goal.target_amount
  const { error: dbErr } = await supabase.from('saving_goals').update({ current_amount: newAmount, is_completed: isCompleted, updated_at: new Date().toISOString() }).eq('id', goal.id)
  if (dbErr) { toast.error('Gagal menambah dana: ' + dbErr.message); return }
  await fetchGoals()
  if (isCompleted) toast.success(`Goal "${goal.name}" tercapai! 🎉`)
  else toast.success(`Dana ditambahkan ke "${goal.name}"`)
}

async function deleteGoal(id: string) {
  const goal = goals.value.find(g => g.id === id)
  const detail = goal ? `${goal.name} · terkumpul Rp ${goal.current_amount.toLocaleString('id-ID')}` : undefined
  if (!(await confirmDelete('Hapus goal ini?', detail))) return
  const { error: dbErr } = await supabase.from('saving_goals').delete().eq('id', id)
  if (dbErr) { toast.error('Gagal menghapus: ' + dbErr.message); return }
  goals.value = goals.value.filter(g => g.id !== id)
  toast.success('Goal dihapus')
}

const activeGoals    = computed(() => goals.value.filter(g => !g.is_completed))
const completedGoals = computed(() => goals.value.filter(g => g.is_completed))

const progress = (g: any) => cappedPercent(g.current_amount, g.target_amount)
function monthsLeft(deadline: string) {
  if (!deadline) return null
  return Math.max(0, dayjs(deadline).diff(dayjs(), 'month'))
}
function monthlyNeeded(g: any) {
  const rem    = g.target_amount - g.current_amount
  const months = monthsLeft(g.deadline)
  if (!months) return null
  return Math.ceil(rem / months)
}
function progressColor(pct: number) {
  if (pct >= 100) return 'var(--color-accent)'
  if (pct >= 60)  return '#378ADD'
  if (pct >= 30)  return '#EF9F27'
  return '#D85A30'
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">Saving Goals</h1>
        <p class="page-sub">{{ activeGoals.length }} goals aktif · {{ completedGoals.length }} selesai</p>
      </div>
      <button class="btn-add" @click="showForm = true">
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
        Tambah goal
      </button>
    </div>

    <div v-if="loading" class="loading-wrap">
      <div class="spinner-lg"></div><p>Memuat goals...</p>
    </div>

    <template v-else>
      <!-- Empty -->
      <div v-if="goals.length === 0" class="empty-big">
        <div class="empty-icon">
          <svg class="text-accent" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </div>
        <h3>Belum ada saving goals</h3>
        <p>Buat goal pertama untuk mulai melacak progres tabunganmu</p>
        <button class="btn-add" @click="showForm = true">Buat goal pertama</button>
      </div>

      <!-- Active goals -->
      <template v-else>
        <div v-if="activeGoals.length > 0">
          <p class="list-label">Goals aktif</p>
          <div class="goals-grid">
            <div v-for="g in activeGoals" :key="g.id" class="goal-card">
              <div class="goal-card-top">
                <div class="goal-icon" :style="{ background: progressColor(progress(g)) + '20' }">
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" :stroke="progressColor(progress(g))" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div class="goal-actions">
                  <button class="btn-fund" @click="addFunds(g)" title="Tambah dana">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  </button>
                  <button class="btn-del" @click="deleteGoal(g.id)" title="Hapus">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>

              <h3 class="goal-name">{{ g.name }}</h3>

              <div class="goal-progress-label">
                <span class="goal-collected">{{ formatRp(g.current_amount) }}</span>
                <span class="goal-pct-badge" :style="{ color: progressColor(progress(g)), background: progressColor(progress(g)) + '18' }">{{ progress(g) }}%</span>
              </div>

              <div class="progress-track">
                <div class="progress-bar" :style="{ width: progress(g) + '%', background: progressColor(progress(g)) }"></div>
              </div>
              <p class="goal-target">Target: {{ formatRp(g.target_amount) }}</p>

              <div class="goal-footer">
                <span v-if="g.deadline" class="goal-meta-item">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  {{ dayjs(g.deadline).format('MMM YYYY') }}
                </span>
                <span v-if="monthlyNeeded(g)" class="goal-meta-item">
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  {{ formatRp(monthlyNeeded(g)!) }}/bln
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Completed -->
        <div v-if="completedGoals.length > 0" class="mt-7">
          <p class="list-label">Selesai 🎉</p>
          <div class="goals-grid">
            <div v-for="g in completedGoals" :key="g.id" class="goal-card completed">
              <div class="goal-card-top">
                <div class="goal-icon bg-accent-wash">
                  <svg class="text-accent" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <button class="btn-del" @click="deleteGoal(g.id)">
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
              <h3 class="goal-name">{{ g.name }}</h3>
              <div class="progress-track"><div class="progress-bar w-full bg-accent"></div></div>
              <p class="goal-target">{{ formatRp(g.target_amount) }} tercapai!</p>
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Buat saving goal</h2>
          <button class="modal-close" @click="showForm = false"><svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="form-field"><label>Nama goal</label><input type="text" v-model="form.name" placeholder="Misal: Beli laptop, Liburan Jepang..." autofocus /></div>
        <div class="form-field"><label>Target jumlah</label><div class="input-prefix-wrap"><span class="input-prefix">Rp</span><input type="number" v-model="form.target_amount" placeholder="0" min="0" /></div></div>
        <div class="form-field"><label>Deadline (opsional)</label><input type="date" v-model="form.deadline" /></div>
        <div v-if="error" class="error-msg">{{ error }}</div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showForm = false">Batal</button>
          <button class="btn-save" @click="saveGoal" :disabled="saving"><span v-if="saving" class="spinner"></span><span v-else>Simpan goal</span></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="../styles/views/goals-view.css"></style>
