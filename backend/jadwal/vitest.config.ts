import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ''),
    include: ['core/test/**/*.test.ts', 'adapters/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
}))
