import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

let client: ReturnType<typeof postgres> | null = null
let schemaReady: Promise<unknown> | null = null

function db() {
  if (!client) {
    client = postgres(useRuntimeConfig().databaseUrl, {
      max: 1,
    })
  }

  return client
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = db()`
      create table if not exists bill_runs (
        id text primary key,
        title text not null,
        payload jsonb not null,
        created_at timestamptz not null default now()
      )
    `
  }

  await schemaReady
}

export async function saveBillRun(payload: any) {
  await ensureSchema()

  const id = randomUUID()
  const [insertedRow] = await db()`
    insert into bill_runs (id, title, payload)
    values (${id}, ${payload.title}, ${JSON.stringify(payload)}::jsonb)
    returning id, created_at
  `
  const row = insertedRow!

  return {
    createdAt: row.created_at,
    id: row.id,
  }
}
