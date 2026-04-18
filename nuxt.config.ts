import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://agent_bill:agent_bill@127.0.0.1:5432/agent_bill'
  },
  ssr: false,
  vite: {
    plugins: [tailwindcss()]
  }
})
