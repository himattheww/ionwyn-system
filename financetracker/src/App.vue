<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useNotify } from '@/composables/useNotify'
import { loadPending, flushPending } from '@/lib/pending'
import { onAppActive } from '@/lib/appActive'

const authStore = useAuthStore()
const { toast } = useNotify()

async function syncPending() {
  const { sent, failed } = await flushPending()
  if (sent > 0) toast.success(`${sent} transaksi pending terkirim`)
  failed.forEach(message => toast.error('Transaksi pending gagal: ' + message))
}

watch(
  () => authStore.user?.id,
  id => {
    if (!id) return
    loadPending(id)
    syncPending()
  },
  { immediate: true },
)

onAppActive(syncPending)

onMounted(() => {
  authStore.initialize()
})
</script>

<template>
  <RouterView />
</template>
