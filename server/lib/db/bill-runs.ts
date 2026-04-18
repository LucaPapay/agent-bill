import { randomUUID } from 'node:crypto'
import { db, ensureSchema } from './client'

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
