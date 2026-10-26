<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { api, formatDate, refreshEvent, useLoad } from '../lib/api.ts'
import StateView from '../components/StateView.vue'

interface Wish {
  id: number
  title: string
  why: string | null
  size: 'kecil' | 'sedang' | 'besar'
  attribute: string
  targetDate: string | null
  achievedOn: string | null
}

const sizes = [
  { value: 'kecil', label: 'Kecil', exp: 100 },
  { value: 'sedang', label: 'Sedang', exp: 300 },
  { value: 'besar', label: 'Besar', exp: 1000 }
] as const
const attributes = [
  { value: 'stamina', label: 'Stamina' },
  { value: 'intelek', label: 'Intelek' },
  { value: 'kebijaksanaan', label: 'Kebijaksanaan' },
  { value: 'disiplin', label: 'Disiplin' },
  { value: 'kekayaan', label: 'Kekayaan' }
]
const expOf = (size: string) => sizes.find(s => s.value === size)?.exp ?? 0
const attributeName = (key: string) => attributes.find(a => a.value === key)?.label ?? key

const { data, loading, error, reload } = useLoad(() => api<Wish[]>('/wishes'))
const open = computed(() => (data.value ?? []).filter(w => !w.achievedOn))
const done = computed(() => (data.value ?? []).filter(w => w.achievedOn))

const form = reactive({ title: '', why: '', size: 'sedang', attribute: 'kebijaksanaan', targetDate: '' })
const saving = ref(false)
const message = ref('')
const confirming = ref<number | null>(null)

const localToday = () => new Date().toLocaleDateString('sv-SE')

async function send(path: string, method: string, body?: unknown) {
  saving.value = true
  message.value = ''
  try {
    await api(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    await reload()
    window.dispatchEvent(new Event(refreshEvent))
    return true
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
    return false
  } finally {
    saving.value = false
  }
}

async function add() {
  const ok = await send('/wishes', 'POST', { ...form, why: form.why || null, targetDate: form.targetDate || null })
  if (ok) Object.assign(form, { title: '', why: '', targetDate: '' })
}

const achieve = (wish: Wish) => send(`/wishes/${wish.id}`, 'PATCH', { achievedOn: localToday() })
const reopen = (wish: Wish) => send(`/wishes/${wish.id}`, 'PATCH', { achievedOn: null })
async function remove(wish: Wish) {
  if (await send(`/wishes/${wish.id}`, 'DELETE')) confirming.value = null
}
</script>

<template>
  <div>
    <span class="kicker">Gulungan cita-cita</span>
    <h1>Cita-cita</h1>
    <p class="lede">Tulis yang ingin dicapai. Saat tercapai, exp besar masuk ke atribut yang kamu pilih.</p>
  </div>

  <div class="layout">
    <form class="card wish-form" @submit.prevent="add">
      <h3>Tulis cita-cita</h3>
      <div class="field">
        <label for="wish-title">Cita-cita</label>
        <input id="wish-title" v-model="form.title" class="input" maxlength="200" placeholder="Contoh: lari marathon pertama" required />
      </div>
      <div class="field">
        <label for="wish-why">Kenapa ini penting (opsional)</label>
        <textarea id="wish-why" v-model="form.why" class="input" rows="3" maxlength="2000" />
      </div>
      <fieldset class="field sizes">
        <legend>Ukuran</legend>
        <label v-for="size in sizes" :key="size.value" class="size" :class="{ active: form.size === size.value }">
          <input v-model="form.size" type="radio" name="size" :value="size.value" />
          <strong>{{ size.label }}</strong>
          <span>+{{ size.exp }} exp</span>
        </label>
      </fieldset>
      <div class="row-fields">
        <div class="field">
          <label for="wish-attribute">Atribut</label>
          <select id="wish-attribute" v-model="form.attribute" class="input">
            <option v-for="a in attributes" :key="a.value" :value="a.value">{{ a.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="wish-target">Target (opsional)</label>
          <input id="wish-target" v-model="form.targetDate" class="input" type="date" />
        </div>
      </div>
      <p v-if="message" class="error" role="alert">{{ message }}</p>
      <button class="btn btn-primary" :disabled="saving || !form.title.trim()">Simpan cita-cita</button>
    </form>

    <StateView :loading="loading" :error="error" :empty="false" empty-text="" @retry="reload">
      <section class="block">
        <h3>Sedang dikejar</h3>
        <p v-if="open.length === 0" class="lede muted">Belum ada cita-cita. Tulis satu di samping.</p>
        <article v-for="wish in open" :key="wish.id" class="wish">
          <div class="wish-head">
            <span class="kicker">{{ attributeName(wish.attribute) }} · +{{ expOf(wish.size) }} exp</span>
            <span v-if="wish.targetDate" class="card-meta">target {{ formatDate(wish.targetDate) }}</span>
          </div>
          <h4>{{ wish.title }}</h4>
          <p v-if="wish.why" class="muted">{{ wish.why }}</p>
          <div v-if="confirming === wish.id" class="confirm" role="alertdialog" aria-label="Konfirmasi hapus">
            <span>Hapus "{{ wish.title }}"? Tidak bisa dibatalkan.</span>
            <button class="btn btn-danger" :disabled="saving" @click="remove(wish)">Ya, hapus</button>
            <button class="btn btn-secondary" @click="confirming = null">Batal</button>
          </div>
          <div v-else class="actions">
            <button class="btn btn-primary" :disabled="saving" @click="achieve(wish)">Tercapai</button>
            <button class="btn btn-secondary" @click="confirming = wish.id">Hapus</button>
          </div>
        </article>
      </section>

      <section class="block">
        <h3>Tercapai</h3>
        <p v-if="done.length === 0" class="lede muted">Belum ada yang tercapai.</p>
        <article v-for="wish in done" :key="wish.id" class="wish achieved">
          <div class="wish-head">
            <span class="kicker">{{ attributeName(wish.attribute) }} · +{{ expOf(wish.size) }} exp</span>
            <span class="card-meta">tercapai {{ formatDate(wish.achievedOn!) }}</span>
          </div>
          <h4>{{ wish.title }}</h4>
          <div class="actions">
            <button class="btn btn-secondary" :disabled="saving" @click="reopen(wish)">Belum tercapai</button>
          </div>
        </article>
      </section>
    </StateView>
  </div>
</template>

<style scoped src="../styles/wishes.css"></style>
