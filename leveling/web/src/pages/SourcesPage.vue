<script setup lang="ts">
import { ref } from 'vue'
import { api, refreshEvent, useLoad } from '../lib/api.ts'
import StateView from '../components/StateView.vue'

interface SourceRow {
  name: string
  label: string
  enabled: number
  last_read_at: string | null
  last_error: string | null
  event_count: number | null
}

const { data, loading, error, reload } = useLoad(() => api<{ sources: SourceRow[]; rules: unknown; calculatedAt: string | null }>('/sources'))
const running = ref(false)
const message = ref('')
const failed = ref(false)

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString('id-ID') : '-')
const status = (row: SourceRow) => (!row.enabled ? 'off' : row.last_error ? 'error' : 'ok')
const statusText = { ok: 'Aktif', error: 'Error', off: 'Nonaktif' }
const statusTag = { ok: 'tag-accent', error: 'tag-accent-2', off: 'tag-neutral' }

async function recalculate() {
  running.value = true
  message.value = ''
  failed.value = false
  try {
    const result = await api<{ lines: string[]; silent: boolean }>('/recalculate', { method: 'POST' })
    message.value = result.silent
      ? 'Selesai. Aturan berubah atau ini hitung pertama, jadi tanpa notifikasi.'
      : result.lines.length
        ? `Selesai dengan ${result.lines.length} perubahan.`
        : 'Selesai. Tidak ada perubahan.'
    window.dispatchEvent(new Event(refreshEvent))
    await reload()
  } catch (e) {
    failed.value = true
    message.value = `Gagal: ${e instanceof Error ? e.message : e}`
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="head">
    <div>
      <span class="kicker">Dari mana exp datang</span>
      <h1>Sumber</h1>
      <p class="lede">Semua sumber hanya dibaca. Hitung ulang otomatis tiap 30 menit.</p>
    </div>
    <button class="btn btn-primary btn-lg" :disabled="running" @click="recalculate">{{ running ? 'Menghitung...' : 'Hitung ulang' }}</button>
  </div>
  <StateView :loading="loading" :error="error" :empty="!data?.sources.length" empty-text="Belum ada status sumber. Tekan Hitung ulang." @retry="reload">
    <template v-if="data">
      <div class="meta">
        <span class="small">Hitung terakhir: {{ formatTime(data.calculatedAt) }}</span>
        <span v-if="message" class="small message" :class="{ failed }">{{ message }}</span>
      </div>
      <div class="table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>Sumber</th>
              <th>Status</th>
              <th>Terakhir dibaca</th>
              <th class="num">Kejadian</th>
              <th>Error terakhir</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.sources" :key="row.name">
              <td class="label">{{ row.label }}</td>
              <td><span class="tag" :class="statusTag[status(row)]">{{ statusText[status(row)] }}</span></td>
              <td>{{ formatTime(row.last_read_at) }}</td>
              <td class="num">{{ row.event_count?.toLocaleString('id-ID') ?? '–' }}</td>
              <td class="error-text">{{ row.last_error ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <section class="rules-block">
        <h3>Aturan yang berlaku</h3>
        <p class="small muted">config/rules.json · kalau hash berubah, hitung ulang berjalan tanpa notifikasi.</p>
        <pre class="rules">{{ JSON.stringify(data.rules, null, 2) }}</pre>
      </section>
    </template>
  </StateView>
</template>

<style scoped src="../styles/sources.css"></style>
