import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx()
  ],
  base: process.env.NODE_ENV === 'production' ? '/frontend/' : '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      path: 'path-browserify-esm',
      process: 'process/browser',
    }
  },
  define: {
    'process.env': {}
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      VITE_OSWATCHER_API_URI: 'http://localhost:4000/graphql'
    }
  }
})
