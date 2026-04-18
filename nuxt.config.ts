import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
  modules: ['nuxt-auth-utils'],
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3000,
  },
  devtools: { enabled: true },
  auth: {
    loadStrategy: 'client-only',
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://agent_bill:agent_bill@127.0.0.1:5432/agent_bill',
    oauth: {
      google: {
        clientId: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OAUTH_GOOGLE_CLIENT_SECRET || '',
      },
    },
  },
  ssr: false,
  spaLoadingTemplate: 'spa-loading-template.html',
  vite: {
    plugins: [tailwindcss()]
  }
})
