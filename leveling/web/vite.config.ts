import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: process.env.APP_BASE ?? '/',
  plugins: [vue()],
  server: {
    fs: { allow: ['../..'] },
    proxy: { '/api': `http://127.0.0.1:${process.env.PORT ?? 3100}` }
  },
  build: { outDir: 'dist', emptyOutDir: true }
})
