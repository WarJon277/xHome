import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true // Enable SW in development
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        // Ensure app shell is always cached
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/thumbnails/],
        runtimeCaching: [
          {
            // Book downloads - Allow long timeout (avoid 3s limit)
            urlPattern: /\/api\/books\/.*\/download/i,
            handler: 'NetworkOnly',
            options: {
              networkTimeoutSeconds: 60
            }
          },
          {
            // API calls - Network First with fallback
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3, // Reduced to 3s for quick offline detection
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 // 1 hour
              }
            }
          },
          {
            // Media files - Cache First for performance
            urlPattern: /^https?:\/\/.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            // Images
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }
            }
          },
          {
            // Static assets
            urlPattern: /\.(js|css|woff2?)$/,
            handler: 'CacheFirst', // Changed to CacheFirst for offline support
            options: {
              cacheName: 'static-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'xHome Portal',
        short_name: 'xHome',
        description: 'Media Portal with Offline Reading',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  server: {
    port: 5050,
    allowedHosts: ["dev.tpw-xxar.ru"],
    proxy: {
      // Consolidate all /api calls and STRIP the /api prefix before sending to backend
      '/api': {
        target: 'http://localhost:5055',
        changeOrigin: true
      },


      // Static Files and Uploads (keep as is if they don't clash)
      '/uploads': { target: 'http://localhost:5055', changeOrigin: true },
      '/thumbnails': { target: 'http://localhost:5055', changeOrigin: true },
    }
  }
})
