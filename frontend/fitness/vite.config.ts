import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../backend/fitness', '');
  return {
    base: process.env.APP_BASE ?? '/',
    plugins: [vue()],
    server: {
      fs: { allow: ['../..'] },
      host: env.ALLOW_LAN === 'true' ? '0.0.0.0' : '127.0.0.1',
      proxy: { '/api': `http://127.0.0.1:${env.PORT || 3000}` },
    },
  };
});
