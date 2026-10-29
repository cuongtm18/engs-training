export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  modules: ['@vite-pwa/nuxt'],
  devtools: { enabled: false },

  app: {
    head: {
      title: 'Phản xạ tiếng Anh',
      htmlAttrs: { lang: 'vi' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fdf3e7' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

  nitro: {
    preset: 'cloudflare-pages',
    cloudflare: { deployConfig: false },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Phản xạ tiếng Anh',
      short_name: 'Phản xạ EN',
      description: 'Luyện phản xạ dịch Việt → Anh qua các tình huống hằng ngày.',
      lang: 'vi',
      theme_color: '#fdf3e7',
      background_color: '#fdf3e7',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,json,webmanifest}'],
    },
    devOptions: { enabled: false },
  },
})
