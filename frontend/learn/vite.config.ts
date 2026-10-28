import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.APP_BASE ?? '/',
  plugins: [vue()],
  server: {
    port: 5173,
    fs: { allow: ['../..'] },
    proxy: { '/api': 'http://localhost:3001' },
  },
})
