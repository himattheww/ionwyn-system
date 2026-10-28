<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, type Entry } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import EntryEditor from '../components/EntryEditor.vue'
import MoonPhase from '../components/MoonPhase.vue'
import { useRouter } from 'vue-router'
import { formatClock, formatDate, formatDuration, writingWindow } from '../lib/dates'
import { useLoad } from '../composables/useLoad'
import { useNow } from '../composables/useNow'

const { data: today, loading, error, reload } = useLoad(api.today)
onMounted(reload)

const now = useNow()
const win = computed(() => writingWindow(now.value))
const editing = ref(false)
const savedAt = ref<string | null>(null)

const router = useRouter()
const query = ref('')
const search = () => router.push({ path: '/cari', query: query.value.trim() ? { q: query.value.trim() } : {} })
const dateline = computed(() => `${formatDate(today.value?.tonight ?? '')} · ${formatClock(now.value)} WIB`)

const showEditor = computed(() => !!today.value && (!today.value.tonightEntry || editing.value))

function onSaved(entry: Entry) {
  if (today.value) today.value = { ...today.value, tonightEntry: entry }
  editing.value = false
  savedAt.value = formatClock()
}
</script>

<template>
  <AsyncState :loading="loading" :error="error" @retry="reload">
    <template v-if="today">
      <header class="night-hero">
        <div>
          <p class="eyebrow">{{ dateline }}</p>
          <h1 class="night-title">Catatan<br />malam</h1>
          <p class="lead">Satu halaman untuk satu malam. Tulis apa yang terjadi, apa yang baik, dan apa yang dipelajari.</p>
          <p class="window-badge">
            <span class="window-badge-dot" :class="{ open: today.isOpen }" />
            <template v-if="today.isOpen">Terbuka sekarang · 18.00–02.00 WIB · tutup {{ formatDuration(win.minutesLeft) }} lagi</template>
            <template v-else>Dibuka pukul 18.00 · {{ formatDuration(win.minutesLeft) }} lagi</template>
          </p>
        </div>
        <MoonPhase :date="today.tonight" />
      </header>

      <div class="night-grid">
        <section class="stack">
          <template v-if="today.isOpen">
            <h2>Malam ini</h2>
            <EntryEditor v-if="showEditor" :date="today.tonight" :entry="today.tonightEntry" @saved="onSaved">
              <template #note>Menyelesaikan pengingat malam di Jadwal dan memberi exp Kebijaksanaan.</template>
            </EntryEditor>

            <div v-else-if="today.tonightEntry" class="done">
              <div class="done-head">
                <span>Catatan malam ini tersimpan</span>
                <small v-if="savedAt">pukul {{ savedAt }}</small>
              </div>
              <p class="clamp">{{ today.tonightEntry.happened }}</p>
              <div class="actions">
                <RouterLink :to="`/entri/${today.tonight}`" class="btn btn-primary">Buka catatan</RouterLink>
                <button class="btn btn-secondary" @click="editing = true">Edit</button>
              </div>
              <small class="muted">Sampai besok malam. Tidur yang nyenyak.</small>
            </div>
          </template>

          <template v-else>
            <h2>Catatan terbaru</h2>
            <p v-if="!today.recent.length" class="state">Belum ada catatan. Malam pertama dibuka pukul 18.00.</p>
            <ul v-else class="list">
              <li v-for="entry in today.recent" :key="entry.date">
                <RouterLink :to="`/entri/${entry.date}`" class="card">
                  <span class="card-date">{{ formatDate(entry.date) }}</span>
                  <span class="card-text clamp">{{ entry.happened }}</span>
                </RouterLink>
              </li>
            </ul>
          </template>
        </section>

        <aside class="stack">
          <RouterLink v-if="today.yesterdayEmpty" :to="`/entri/${today.yesterday}`" class="row-link">
            <span class="row-link-text">
              <span>Kemarin belum terisi</span>
              <small>{{ formatDate(today.yesterday) }} · bisa diisi sampai 02.00</small>
            </span>
            <i class="ph ph-caret-right" />
          </RouterLink>

          <section class="night-card">
            <h3>Hari ini, dulu</h3>
            <p v-if="!today.onThisDay.length" class="muted">Belum ada catatan di tanggal yang sama tahun atau bulan lalu.</p>
            <RouterLink v-for="item in today.onThisDay" :key="item.entry.date" :to="`/entri/${item.entry.date}`" class="memory">
              <small>{{ item.label }} · {{ formatDate(item.entry.date) }}</small>
              <span class="clamp">{{ item.entry.happened }}</span>
            </RouterLink>
          </section>

          <form class="night-search" role="search" @submit.prevent="search">
            <label class="field">
              <span>Cari di semua catatan</span>
              <input v-model="query" class="input" type="search" placeholder="Kata kunci" />
            </label>
            <div class="actions">
              <RouterLink to="/pelajaran" class="btn btn-secondary">Semua pelajaran</RouterLink>
              <RouterLink to="/hal-baik" class="btn btn-secondary">Semua hal baik</RouterLink>
            </div>
          </form>
        </aside>
      </div>
    </template>
  </AsyncState>
</template>
