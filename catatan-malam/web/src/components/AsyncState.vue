<script setup lang="ts">
defineProps<{ loading: boolean; error: string | null; empty?: boolean; emptyText?: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="skeleton" role="status">
    <span class="muted"><i class="ph ph-circle-notch spin" /> Memuat…</span>
    <span class="skeleton-line w-30" />
    <span class="skeleton-line skeleton-line-lg w-75" />
    <span class="skeleton-block" />
    <span class="skeleton-block" />
  </div>
  <div v-else-if="error" class="error-card" role="alert">
    <i class="ph ph-plugs" />
    <strong>Ada yang tidak beres</strong>
    <p>{{ error }}</p>
    <button class="btn btn-primary" @click="$emit('retry')"><i class="ph ph-arrow-clockwise" />Coba lagi</button>
  </div>
  <p v-else-if="empty" class="state">{{ emptyText }}</p>
  <slot v-else />
</template>
