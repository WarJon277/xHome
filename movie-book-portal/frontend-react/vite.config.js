import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5050,
    proxy: {
      // Consolidate all /api calls and STRIP the /api prefix before sending to backend
      '/api': {
        target: 'http://localhost:5055',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },

      // Static Files and Uploads (keep as is if they don't clash)
      '/uploads': { target: 'http://localhost:5055', changeOrigin: true },
      '/thumbnails': { target: 'http://localhost:5055', changeOrigin: true },
    }
  }
})
