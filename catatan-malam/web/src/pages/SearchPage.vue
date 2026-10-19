<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type SearchResult } from '../lib/api'
import AsyncState from '../components/AsyncState.vue'
import { formatDate } from '../lib/dates'

const route = useRoute()
const router = useRouter()
const searched = String(route.query.q ?? '').trim()
const keyword = ref(searched)
const results = ref<SearchResult[]>([])
const loading = ref(!!searched)
const error = ref<string | null>(null)

async function run() {
  if (!searched) return
  loading.value = true
  error.value = null
  try {
    results.value = await api.search(searched)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}
onMounted(run)

const submit = () => keyword.value.trim() && router.push({ query: { q: keyword.value.trim() } })

function highlight(text: string) {
  const lower = text.toLowerCase()
  const needle = searched.toLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let cursor = 0
  for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, cursor)) {
    if (i > cursor) parts.push({ text: text.slice(cursor, i), match: false })
    parts.push({ text: text.slice(i, i + needle.length), match: true })
    cursor = i + needle.length
  }
  parts.push({ text: text.slice(cursor), match: false })
  return parts
}
</script>

<template>
  <div class="stack">
    <h1>Cari catatan</h1>
    <form class="search" role="search" @submit.prevent="submit">
      <span class="search-field">
        <i class="ph ph-magnifying-glass" />
        <input v-model="keyword" class="input" type="search" placeholder="Kata kunci…" maxlength="200" aria-label="Kata kunci" />
      </span>
      <button class="btn btn-primary">Cari</button>
    </form>

    <p v-if="!searched" class="muted">Ketik kata kunci untuk mencari di semua catatan.</p>
    <AsyncState
      v-else
      :loading="loading"
      :error="error"
      :empty="!results.length"
      :empty-text="`Tidak ada catatan yang memuat “${searched}”.`"
      @retry="run"
    >
      <p class="muted">{{ results.length }} hasil untuk “{{ searched }}”</p>
      <ul class="list">
        <li v-for="r in results" :key="r.date + r.field">
          <RouterLink :to="`/entri/${r.date}`" class="card">
            <span class="card-head">
              <span class="card-date">{{ formatDate(r.date) }}</span>
              <span class="tag tag-neutral">{{ r.field }}</span>
            </span>
            <span class="card-text">
              <template v-for="(part, i) in highlight(r.snippet)" :key="i">
                <mark v-if="part.match">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </span>
          </RouterLink>
        </li>
      </ul>
    </AsyncState>
  </div>
</template>
