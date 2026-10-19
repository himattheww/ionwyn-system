<script setup lang="ts">
defineProps<{ loading: boolean; error: string; empty: boolean; emptyText: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="loading" class="lede muted">Memuat...</p>
  <div v-else-if="error" class="state-error">
    <p class="lede">Gagal memuat: {{ error }}</p>
    <button class="btn btn-secondary" @click="$emit('retry')">Coba lagi</button>
  </div>
  <p v-else-if="empty" class="lede muted">{{ emptyText }}</p>
  <slot v-else />
</template>

<style scoped src="../styles/state-view.css"></style>
