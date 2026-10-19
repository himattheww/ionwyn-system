<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { OrbAttribute } from '../lib/orb.ts'

const props = defineProps<{ attributes: (OrbAttribute & { name: string })[] }>()
const canvas = ref<HTMLCanvasElement>()
let orb: { update: (next: OrbAttribute[]) => void; dispose: () => void } | null = null
const unsupported = ref(false)

onMounted(async () => {
  try {
    const { mountOrb } = await import('../lib/orb.ts')
    if (canvas.value) orb = mountOrb(canvas.value, props.attributes)
  } catch {
    unsupported.value = true
  }
})

watch(
  () => props.attributes,
  next => orb?.update(next),
  { deep: true }
)

onBeforeUnmount(() => orb?.dispose())
</script>

<template>
  <figure class="orb">
    <canvas v-show="!unsupported" ref="canvas" role="img" :aria-label="`Bentuk atribut: ${attributes.map(a => a.name).join(', ')}`" />
    <figcaption>Bentuk mengikuti skor lima atribut 30 hari terakhir</figcaption>
  </figure>
</template>

<style scoped src="../styles/attribute-orb.css"></style>
