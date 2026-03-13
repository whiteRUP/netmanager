import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3345',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://localhost:3345',
        ws: true,
        rewrite: p => p.replace(/^\/ws/, '/ws')
      }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
})
