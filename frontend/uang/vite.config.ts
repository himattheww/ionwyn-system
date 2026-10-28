import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.APP_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({ selfDestroying: true, manifest: false }),
  ],
  server: { fs: { allow: ['../..'] } },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
