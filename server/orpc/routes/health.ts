import { rpc } from '../base'

export const health = rpc.handler(() => ({
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
