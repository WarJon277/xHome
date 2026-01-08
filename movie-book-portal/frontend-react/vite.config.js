import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5050,
    proxy: {
      // API Endpoints
      '/movies': { target: 'http://localhost:5055', changeOrigin: true },
      '/tvshows': { target: 'http://localhost:5055', changeOrigin: true },
      '/episodes': { target: 'http://localhost:5055', changeOrigin: true },
      '/books': { target: 'http://localhost:5055', changeOrigin: true },
      '/gallery': { target: 'http://localhost:5055', changeOrigin: true },
      '/items': { target: 'http://localhost:5055', changeOrigin: true },
      '/categories': { target: 'http://localhost:5055', changeOrigin: true },
      '/genres': { target: 'http://localhost:5055', changeOrigin: true },
      '/progress': { target: 'http://localhost:5055', changeOrigin: true },
      '/scan': { target: 'http://localhost:5055', changeOrigin: true },
      '/admin': { target: 'http://localhost:5055', changeOrigin: true },
      '/delete_file': { target: 'http://localhost:5055', changeOrigin: true },
      '/delete_folder': { target: 'http://localhost:5055', changeOrigin: true },
      '/kaleidoscopes': { target: 'http://localhost:5055', changeOrigin: true },

      // Static Files
      '/uploads': { target: 'http://localhost:5055', changeOrigin: true },
      '/thumbnails': { target: 'http://localhost:5055', changeOrigin: true },
    }
  }
})
