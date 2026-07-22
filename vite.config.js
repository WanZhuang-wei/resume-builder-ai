import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icons/*.png'],
      manifest: {
        name: '简历生成助手',
        short_name: '简历助手',
        description: '智能简历生成与求职助手',
        theme_color: '#1989fa',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-icons/512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  }
})
