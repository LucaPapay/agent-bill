import postgres from 'postgres'
import { createSchema } from './schema'

let client: ReturnType<typeof postgres> | null = null
let schemaReady: Promise<void> | null = null

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  if (typeof useRuntimeConfig === 'function') {
    const runtimeConfig = useRuntimeConfig()

    if (runtimeConfig?.databaseUrl) {
      return runtimeConfig.databaseUrl
    }
  }

  return 'postgresql://agent_bill:agent_bill@127.0.0.1:5432/agent_bill'
}

export function db() {
  if (!client) {
    client = postgres(getDatabaseUrl(), {
      max: 1,
    })
  }

  return client
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = createSchema(db())
  }

  await schemaReady
}
