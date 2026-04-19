import { randomUUID } from 'node:crypto'
import {
  normalizePeople,
  readSavedRunPayload,
  withRunMetadata,
} from '../bill-run-payload'
import { db, ensureSchema } from './client'

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
  agentSessionFile,
  chatId,
  payload,
  personId,
}: {
  agentSessionFile?: string
  chatId: string
  payload: any
  personId: string
}) {
  await ensureSchema()

  const id = randomUUID()
  const savedPayload = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {}
  const title = String(savedPayload.title || 'Untitled bill').trim() || 'Untitled bill'
  const normalizedPeople = normalizePeople(savedPayload.people)
  const insertedRow = await db().begin(async (sql: any) => {
    const updatedChats = await sql`
      update bill_chats
      set
        agent_session_file = coalesce(${agentSessionFile || null}, agent_session_file),
        title = ${title},
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
      values (${id}, ${chatId}, ${personId}, ${title}, ${sql.json(savedPayload)})
      returning id, created_at
    `

    return insertedRuns[0]!
  })

  return {
    createdAt: insertedRow.created_at,
    id: insertedRow.id,
  }
}

export async function getBillChatForAgent(personId: string, chatId: string) {
  await ensureSchema()

  const [row] = await db()`
    select
      chats.agent_session_file,
      linked_bills.group_id as linked_bill_group_id,
      linked_bills.id as linked_bill_id,
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
    left join lateral (
      select id, group_id
      from bills
      where source_chat_id = chats.id
      order by created_at desc
      limit 1
    ) linked_bills on true
    where chats.id = ${chatId}
      and chats.person_id = ${personId}
  `

  if (!row) {
    throw new Error('Scan chat not found.')
  }

  return {
    agentSessionFile: String(row.agent_session_file || '').trim(),
    chat: withRunMetadata(row),
  }
}

export async function getBillChat(personId: string, chatId: string) {
  await ensureSchema()

  const [row] = await db()`
    select
      linked_bills.group_id as linked_bill_group_id,
      linked_bills.id as linked_bill_id,
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
    left join lateral (
      select id, group_id
      from bills
      where source_chat_id = chats.id
      order by created_at desc
      limit 1
    ) linked_bills on true
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
      linked_bills.group_id as linked_bill_group_id,
      linked_bills.id as linked_bill_id,
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
    left join lateral (
      select id, group_id
      from bills
      where source_chat_id = chats.id
      order by created_at desc
      limit 1
    ) linked_bills on true
    where chats.person_id = ${personId}
    order by chats.updated_at desc
    limit 24
  `

  return rows.map((row: any) => {
    const payload = readSavedRunPayload(row.payload)

    return {
      chatId: row.id,
      linkedBillGroupId: String(row.linked_bill_group_id || '').trim() || undefined,
      linkedBillId: String(row.linked_bill_id || '').trim() || undefined,
      people: normalizePeople(row.people),
      summary: String(payload.summary || '').trim(),
      title: String(row.title || payload.title || 'Untitled bill').trim() || 'Untitled bill',
      totalCents: Number(payload.totalCents || 0),
      updatedAt: row.updated_at,
    }
  })
}
