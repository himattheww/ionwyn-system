<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { statusLabel } from '../lib/labels'
import type { TrackDetail } from '../types'

type Topic = TrackDetail['topics'][number]

const props = defineProps<{ topics: Topic[]; currentId?: number }>()

const root = ref<HTMLElement | null>(null)
const lines = ref<{ key: string; d: string; done: boolean }[]>([])
const size = ref({ width: 0, height: 0 })

const isDone = (t: Topic) => t.status === 'selesai' || t.status === 'sudah_bisa'

const parents = computed(() => {
  const ordered = [...props.topics].sort((a, b) => a.order - b.order)
  const byTitle = new Map(ordered.map((t) => [t.title.trim().toLowerCase(), t]))
  return new Map(
    ordered.map((t, i) => {
      const found = t.prerequisites.map((p) => byTitle.get(p.trim().toLowerCase())).filter((p): p is Topic => !!p && p.id !== t.id)
      const fallback = found.length || i === 0 ? [] : [ordered[i - 1]!]
      return [t.id, found.length ? found : fallback]
    }),
  )
})

const rows = computed(() => {
  const depth = new Map<number, number>()
  const visit = (t: Topic, seen: Set<number>): number => {
    if (depth.has(t.id)) return depth.get(t.id)!
    if (seen.has(t.id)) return 0
    seen.add(t.id)
    const d = Math.max(-1, ...(parents.value.get(t.id) ?? []).map((p) => visit(p, seen))) + 1
    depth.set(t.id, d)
    return d
  }
  for (const t of props.topics) visit(t, new Set())
  const grouped: Topic[][] = []
  for (const t of [...props.topics].sort((a, b) => a.order - b.order)) (grouped[depth.get(t.id)!] ??= []).push(t)
  return grouped.filter(Boolean)
})

function draw() {
  const box = root.value
  if (!box) return
  const origin = box.getBoundingClientRect()
  const rect = (id: number) => box.querySelector<HTMLElement>(`[data-node="${id}"]`)?.getBoundingClientRect()
  const result: typeof lines.value = []
  for (const t of props.topics) {
    const to = rect(t.id)
    for (const p of parents.value.get(t.id) ?? []) {
      const from = rect(p.id)
      if (!from || !to) continue
      const x1 = from.left + from.width / 2 - origin.left
      const y1 = from.bottom - origin.top
      const x2 = to.left + to.width / 2 - origin.left
      const y2 = to.top - origin.top
      const mid = (y2 - y1) / 2
      result.push({ key: `${p.id}-${t.id}`, d: `M${x1} ${y1} C${x1} ${y1 + mid} ${x2} ${y2 - mid} ${x2} ${y2}`, done: isDone(p) })
    }
  }
  size.value = { width: box.scrollWidth, height: box.scrollHeight }
  lines.value = result
}

let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(draw)
  if (root.value) observer.observe(root.value)
  draw()
})
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.topics, () => nextTick(draw), { deep: true })
</script>

<template>
  <div ref="root" class="roadmap">
    <svg class="roadmap-lines" :width="size.width" :height="size.height" aria-hidden="true">
      <path v-for="l in lines" :key="l.key" :d="l.d" :class="{ done: l.done }" />
    </svg>
    <div v-for="(row, i) in rows" :key="i" class="roadmap-row">
      <RouterLink
        v-for="t in row"
        :key="t.id"
        :to="`/topics/${t.id}`"
        :data-node="t.id"
        class="roadmap-node"
        :class="{ done: isDone(t), current: t.id === currentId, known: t.status === 'sudah_bisa' }"
        :aria-label="`${t.order}. ${t.title}, ${statusLabel[t.status]}`"
      >
        <span class="roadmap-mark">{{ isDone(t) ? '✓' : t.order }}</span>
        <span class="roadmap-title">{{ t.title }}</span>
        <span class="roadmap-meta">{{ statusLabel[t.status] }}{{ t.hasContent ? '' : ' · belum ada isi' }}</span>
      </RouterLink>
    </div>
  </div>
</template>
