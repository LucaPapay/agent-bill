import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
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
