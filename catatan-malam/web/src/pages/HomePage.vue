<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, type Entry } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import EntryEditor from '../components/EntryEditor.vue'
import { formatClock, formatDate, formatDuration, writingWindow } from '../lib/dates'
import { useLoad } from '../composables/useLoad'
import { useNow } from '../composables/useNow'

const { data: today, loading, error, reload } = useLoad(api.today)
onMounted(reload)

const now = useNow()
const win = computed(() => writingWindow(now.value))
const editing = ref(false)
const savedAt = ref<string | null>(null)

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
      <section v-if="today.isOpen" class="stack">
        <div class="hero">
          <p class="eyebrow">Malam ini</p>
          <h1>{{ formatDate(today.tonight) }}</h1>
          <div class="window" :style="{ '--progress': `${win.progress * 100}%` }">
            <div class="window-track"><span class="window-fill" /><span class="window-dot" /></div>
            <div class="window-labels">
              <span>18.00</span>
              <span class="window-left">Tutup {{ formatDuration(win.minutesLeft) }} lagi</span>
              <span>02.00</span>
            </div>
          </div>
        </div>

        <RouterLink v-if="today.yesterdayEmpty" :to="`/entri/${today.yesterday}`" class="row-link">
          <i class="ph ph-clock-counter-clockwise row-link-icon" />
          <span class="row-link-text">
            <span>Kemarin belum terisi</span>
            <small>{{ formatDate(today.yesterday) }} · bisa diisi sampai 02.00</small>
          </span>
          <i class="ph ph-caret-right" />
        </RouterLink>

        <EntryEditor
          v-if="showEditor"
          :date="today.tonight"
          :entry="today.tonightEntry"
          mode="steps"
          @saved="onSaved"
        />

        <div v-else-if="today.tonightEntry" class="done">
          <div class="done-head">
            <i class="ph-fill ph-check-circle" />
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
      </section>

      <section v-else class="stack">
        <div class="hero hero-closed">
          <i class="ph ph-sun-horizon hero-icon" />
          <h1>Belum waktunya menulis</h1>
          <p class="lead">
            Catatan malam ini dibuka pukul 18.00 — {{ formatDuration(win.minutesLeft) }} lagi. Catatan lama tetap bisa dibaca
            dan diedit.
          </p>
        </div>
        <h2>Catatan terbaru</h2>
        <p v-if="!today.recent.length" class="state">Belum ada catatan.</p>
        <ul v-else class="list">
          <li v-for="entry in today.recent" :key="entry.date">
            <RouterLink :to="`/entri/${entry.date}`" class="card">
              <span class="card-date">{{ formatDate(entry.date) }}</span>
              <span class="card-text clamp">{{ entry.happened }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section v-if="today.onThisDay.length">
        <h2><i class="ph ph-hourglass-medium" /> Hari ini, dulu</h2>
        <ul class="list">
          <li v-for="item in today.onThisDay" :key="item.entry.date">
            <RouterLink :to="`/entri/${item.entry.date}`" class="card card-quiet">
              <span class="card-head">
                <span class="tag tag-accent">{{ item.label }}</span>
                <span class="muted">{{ formatDate(item.entry.date) }}</span>
              </span>
              <span class="card-text clamp">{{ item.entry.happened }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
  </AsyncState>
</template>
