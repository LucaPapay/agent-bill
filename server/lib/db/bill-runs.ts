import { randomUUID } from 'node:crypto'
import { db, ensureSchema } from './client'

function parseJsonValue(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function normalizePeople(value: unknown) {
  const parsedValue = parseJsonValue(value)

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
}

function withRunMetadata(row: any) {
  const payload = parseJsonValue(row.payload)

  return {
    ...(payload && typeof payload === 'object' ? payload : {}),
    runId: row.id,
    savedAt: row.created_at,
  }
}

export async function createBillChat({
  people,
  personId,
  title,
}: {
  people: string[]
  personId: string
  title: string
}) {
  await ensureSchema()

  const sql = db()
  const id = randomUUID()
  const [insertedRow] = await sql`
    insert into bill_chats (id, person_id, title, people)
    values (${id}, ${personId}, ${title}, ${sql.json(people)})
    returning id, created_at, updated_at
  `

  return {
    createdAt: insertedRow!.created_at,
    id: insertedRow!.id,
    updatedAt: insertedRow!.updated_at,
  }
}

export async function saveBillRun({
  chatId,
  payload,
  personId,
}: {
  chatId: string
  payload: any
  personId: string
}) {
  await ensureSchema()

  const id = randomUUID()
  const normalizedPeople = normalizePeople(payload?.people)
  const insertedRow = await db().begin(async (sql: any) => {
    const updatedChats = await sql`
      update bill_chats
      set
        title = ${payload.title},
        people = ${sql.json(normalizedPeople)},
        updated_at = now()
      where id = ${chatId}
        and person_id = ${personId}
      returning id
    `

    if (!updatedChats[0]) {
      throw new Error('Scan chat not found.')
    }

    const insertedRuns = await sql`
      insert into bill_runs (id, chat_id, person_id, title, payload)
      values (${id}, ${chatId}, ${personId}, ${payload.title}, ${sql.json(payload)})
      returning id, created_at
    `

    return insertedRuns[0]!
  })

  return {
    createdAt: insertedRow.created_at,
    id: insertedRow.id,
  }
}

export async function getBillChat(personId: string, chatId: string) {
  await ensureSchema()

  const [row] = await db()`
    select
      runs.id,
      runs.created_at,
      runs.payload
    from bill_chats chats
    join lateral (
      select id, created_at, payload
      from bill_runs
      where chat_id = chats.id
      order by created_at desc
      limit 1
    ) runs on true
    where chats.id = ${chatId}
      and chats.person_id = ${personId}
  `

  if (!row) {
    throw new Error('Scan chat not found.')
  }

  return withRunMetadata(row)
}

export async function listBillChats(personId: string) {
  await ensureSchema()

  const rows = await db()`
    select
      chats.id,
      chats.title,
      chats.people,
      chats.updated_at,
      runs.payload
    from bill_chats chats
    join lateral (
      select payload
      from bill_runs
      where chat_id = chats.id
      order by created_at desc
      limit 1
    ) runs on true
    where chats.person_id = ${personId}
    order by chats.updated_at desc
    limit 24
  `

  return rows.map((row: any) => {
    const payload = parseJsonValue(row.payload) || {}

    return {
      chatId: row.id,
      people: normalizePeople(row.people),
      summary: String(payload.summary || '').trim(),
      title: String(row.title || payload.title || 'Untitled bill').trim() || 'Untitled bill',
      totalCents: Number(payload.totalCents || 0),
      updatedAt: row.updated_at,
    }
  })
}
