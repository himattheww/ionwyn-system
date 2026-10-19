<script setup lang="ts">
import { reactive } from 'vue'
import type { Settings } from '../types'

const props = defineProps<{ initial: Settings }>()
const emit = defineEmits<{ save: [settings: Settings]; cancel: [] }>()

const form = reactive<Settings>({ ...props.initial })

function submit() {
  emit('save', { url: form.url.trim(), apiKey: form.apiKey.trim() })
}
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h2>Koneksi</h2>
    <label>
      URL web app
      <input v-model="form.url" type="url" placeholder="https://script.google.com/macros/s/.../exec" required />
    </label>
    <label>
      Kunci API
      <input v-model="form.apiKey" type="password" autocomplete="off" required />
    </label>
    <div class="actions">
      <button type="submit" class="primary">Simpan</button>
      <button type="button" @click="emit('cancel')">Batal</button>
    </div>
  </form>
</template>
