<script setup lang="ts">
defineProps<{ loading: boolean; error: string | null; empty?: boolean; emptyText?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="loading" class="state">
    <span class="spinner" />
    Memuat data...
  </div>
  <div v-else-if="error" class="state state-error">
    <p>Gagal memuat data: {{ error }}</p>
    <button class="secondary" @click="$emit('retry')">Coba lagi</button>
  </div>
  <div v-else-if="empty" class="state">{{ emptyText ?? 'Belum ada data.' }}</div>
  <slot v-else />
</template>
