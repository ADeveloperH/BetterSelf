import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

const rawBase = process.env.VITE_BASE_PATH || '/'
if (!rawBase.startsWith('/') || !rawBase.endsWith('/')) {
  throw new Error('VITE_BASE_PATH 必须以 / 开头和结尾，例如 /BetterSelf/')
}

export default defineConfig({
  base: rawBase,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: rawBase,
        name: 'BetterSelf · Unity 知识与复习',
        short_name: 'BetterSelf',
        description: '沉淀开发经验，让每一次学习都有积累。',
        lang: 'zh-CN',
        start_url: rawBase,
        scope: rawBase,
        display: 'standalone',
        background_color: '#f7f8fa',
        theme_color: '#f7f8fa',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(
      process.env.BETTERSELF_BUILD_ID || process.env.npm_package_version || '0.1.0',
    ),
  },
  build: { target: 'es2022' },
})
