import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const { PORT = '3000' } = loadEnv(mode, '../../backend/catatan', '')
  return {
    base: process.env.APP_BASE ?? '/',
    plugins: [vue()],
    server: {
      fs: { allow: ['../..'] },
      proxy: { '/api': `http://localhost:${PORT}` },
    },
  }
})
