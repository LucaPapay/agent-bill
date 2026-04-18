import { os } from '@orpc/server'

export const health = os.handler(() => ({
  databaseConfigured: Boolean(useRuntimeConfig().databaseUrl),
  name: 'agent-bill',
  openaiReady: Boolean(process.env.OPENAI_API_KEY),
  piReady: Boolean(process.env.OPENAI_API_KEY),
  streamTransport: 'orpc-event-iterator',
  timestamp: new Date().toISOString(),
}))

export const healthRouter = {
  health,
}
