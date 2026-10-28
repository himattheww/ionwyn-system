import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const envDir = fileURLToPath(new URL('../../backend/jadwal', import.meta.url))

export default defineConfig({
  root: here,
  base: process.env.APP_BASE ?? '/',
  envDir,
  envPrefix: ['VITE_', 'SUPABASE_'],
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('dist', import.meta.url)), emptyOutDir: true },
  server: { fs: { allow: [repoRoot] } },
})
