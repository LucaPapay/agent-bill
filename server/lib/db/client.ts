import postgres from 'postgres'
import { createSchema } from './schema'

let client: ReturnType<typeof postgres> | null = null
let schemaReady: Promise<void> | null = null

export function db() {
  if (!client) {
    client = postgres(useRuntimeConfig().databaseUrl, {
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
