import { randomUUID } from 'node:crypto'
import {
  Session,
  SessionError,
  type SessionMetadata,
  type SessionRepo,
  type SessionStorage,
  type SessionTreeEntry,
} from '@earendil-works/pi-agent-core'
import { normalizePeople } from '../bill-analysis'
import { db, ensureSchema } from '../db/client'

export type BillChatMetadata = {
  billId: string | null
  currentSplit: unknown | null
  extractedData: unknown | null
  groupId: string | null
  people: string[]
  personId: string
  status: string
  summary: string
  title: string
  totalCents: number
}

export type BillChatSessionMetadata = BillChatMetadata & SessionMetadata

export type CreateBillChatSessionOptions = {
  groupId?: string
  id?: string
  people?: string[]
  personId: string
  title?: string
}

export type BillChatMetadataUpdate = Partial<Omit<BillChatMetadata, 'personId'>>

export type ListBillChatSessionsOptions = {
  personId: string
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function toNullableText(value: unknown) {
  return normalizeText(value) || null
}

function toMetadata(row: any): BillChatSessionMetadata {
  return {
    billId: toNullableText(row.bill_id),
    createdAt: new Date(row.created_at).toISOString(),
    currentSplit: row.current_split || null,
    extractedData: row.extracted_data || null,
    groupId: toNullableText(row.group_id),
    id: String(row.id),
    people: normalizePeople(row.people),
    personId: String(row.person_id),
    status: normalizeText(row.status) || 'running',
    summary: normalizeText(row.summary),
    title: normalizeText(row.title) || 'Untitled bill',
    totalCents: Number(row.total_cents || 0),
  }
}

function leafIdAfterEntry(entry: SessionTreeEntry) {
  return entry.type === 'leaf' ? entry.targetId : entry.id
}

export class BillSessionStorage implements SessionStorage<BillChatSessionMetadata> {
  constructor(
    private readonly personId: string,
    private readonly chatId: string,
  ) {}

  async getMetadata() {
    await ensureSchema()

    const [row] = await db()`
      select id, person_id, title, group_id, bill_id, people, extracted_data, current_split,
        status, summary, total_cents, created_at
      from bill_chats
      where id = ${this.chatId}
        and person_id = ${this.personId}
    `

    if (!row) {
      throw new SessionError('not_found', `Bill chat not found: ${this.chatId}`)
    }

    return toMetadata(row)
  }

  async getLeafId() {
    await ensureSchema()

    const [row] = await db()`
      select leaf_id
      from bill_chats
      where id = ${this.chatId}
        and person_id = ${this.personId}
    `

    if (!row) {
      throw new SessionError('not_found', `Bill chat not found: ${this.chatId}`)
    }

    return toNullableText(row.leaf_id)
  }

  async setLeafId(leafId: string | null) {
    if (leafId && !(await this.getEntry(leafId))) {
      throw new SessionError('not_found', `Entry ${leafId} not found`)
    }

    await this.appendEntry({
      id: await this.createEntryId(),
      parentId: await this.getLeafId(),
      targetId: leafId,
      timestamp: new Date().toISOString(),
      type: 'leaf',
    })
  }

  async createEntryId() {
    return randomUUID()
  }

  async appendEntry(entry: SessionTreeEntry) {
    await ensureSchema()

    await db().begin(async (sql: any) => {
      const chats = await sql`
        update bill_chats
        set leaf_id = ${leafIdAfterEntry(entry)}, updated_at = now()
        where id = ${this.chatId}
          and person_id = ${this.personId}
        returning id
      `

      if (!chats[0]) {
        throw new SessionError('not_found', `Bill chat not found: ${this.chatId}`)
      }

      await sql`
        insert into bill_chat_entries (chat_id, entry_id, parent_id, type, timestamp, data)
        values (
          ${this.chatId},
          ${entry.id},
          ${entry.parentId},
          ${entry.type},
          ${entry.timestamp},
          ${sql.json(entry)}
        )
      `
    })
  }

  async getEntry(id: string) {
    await ensureSchema()

    const [row] = await db()`
      select data
      from bill_chat_entries
      where chat_id = ${this.chatId}
        and entry_id = ${id}
    `

    return row?.data as SessionTreeEntry | undefined
  }

  async findEntries<TType extends SessionTreeEntry['type']>(type: TType) {
    const entries = await this.getEntries()
    return entries.filter((entry): entry is Extract<SessionTreeEntry, { type: TType }> => entry.type === type)
  }

  async getLabel(id: string) {
    const labels = await this.findEntries('label')
    const label = labels.filter((entry) => entry.targetId === id).at(-1)?.label?.trim()
    return label || undefined
  }

  async getPathToRoot(leafId: string | null) {
    if (!leafId) {
      return []
    }

    const entries = await this.getEntries()
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    const path: SessionTreeEntry[] = []
    let current = byId.get(leafId)

    if (!current) {
      throw new SessionError('not_found', `Entry ${leafId} not found`)
    }

    while (current) {
      path.unshift(current)
      if (!current.parentId) {
        break
      }
      current = byId.get(current.parentId)
      if (!current) {
        throw new SessionError('invalid_session', `Entry parent not found`)
      }
    }

    return path
  }

  async getEntries() {
    await ensureSchema()

    const rows = await db()`
      select data
      from bill_chat_entries
      where chat_id = ${this.chatId}
      order by timestamp asc
    `

    return rows.map((row: any) => row.data as SessionTreeEntry)
  }
}

export class BillSessionRepo implements SessionRepo<
  BillChatSessionMetadata,
  CreateBillChatSessionOptions,
  ListBillChatSessionsOptions
> {
  async create(options: CreateBillChatSessionOptions) {
    await ensureSchema()

    const id = options.id || randomUUID()
    const title = normalizeText(options.title) || 'Untitled bill'
    const people = normalizePeople(options.people)

    const sql = db()
    await sql`
      insert into bill_chats (id, person_id, title, group_id, people)
      values (${id}, ${options.personId}, ${title}, ${toNullableText(options.groupId)}, ${sql.json(people)})
    `

    return this.open({
      billId: null,
      createdAt: new Date().toISOString(),
      currentSplit: null,
      extractedData: null,
      groupId: toNullableText(options.groupId),
      id,
      people,
      personId: options.personId,
      status: 'running',
      summary: '',
      title,
      totalCents: 0,
    })
  }

  async open(metadata: BillChatSessionMetadata) {
    const session = new Session(new BillSessionStorage(metadata.personId, metadata.id))
    await session.getMetadata()
    return session
  }

  async list(options?: ListBillChatSessionsOptions) {
    if (!options?.personId) {
      return []
    }

    await ensureSchema()

    const rows = await db()`
      select id, person_id, title, group_id, bill_id, people, extracted_data, current_split,
        status, summary, total_cents, created_at
      from bill_chats
      where person_id = ${options.personId}
      order by updated_at desc
      limit 24
    `

    return rows.map(toMetadata)
  }

  async delete(metadata: BillChatSessionMetadata) {
    await ensureSchema()
    await db()`
      delete from bill_chats
      where id = ${metadata.id}
        and person_id = ${metadata.personId}
    `
  }

  async fork() {
    throw new SessionError('invalid_argument', 'Bill chat forking is not implemented')
  }
}

export const billSessionRepo = new BillSessionRepo()

export async function updateBillChatMetadata(
  personId: string,
  chatId: string,
  update: BillChatMetadataUpdate,
) {
  await ensureSchema()

  const sql = db()
  const [row] = await sql`
    update bill_chats
    set
      bill_id = coalesce(${toNullableText(update.billId)}, bill_id),
      current_split = coalesce(${update.currentSplit === undefined ? null : sql.json(update.currentSplit)}, current_split),
      extracted_data = coalesce(${update.extractedData === undefined ? null : sql.json(update.extractedData)}, extracted_data),
      group_id = coalesce(${toNullableText(update.groupId)}, group_id),
      people = coalesce(${update.people === undefined ? null : sql.json(normalizePeople(update.people))}, people),
      status = coalesce(${update.status === undefined ? null : normalizeText(update.status)}, status),
      summary = coalesce(${update.summary === undefined ? null : normalizeText(update.summary)}, summary),
      title = coalesce(${update.title === undefined ? null : normalizeText(update.title)}, title),
      total_cents = coalesce(${update.totalCents === undefined ? null : Number(update.totalCents || 0)}, total_cents),
      updated_at = now()
    where id = ${chatId}
      and person_id = ${personId}
    returning id, person_id, title, group_id, bill_id, people, extracted_data, current_split,
      status, summary, total_cents, created_at
  `

  if (!row) {
    throw new SessionError('not_found', `Bill chat not found: ${chatId}`)
  }

  return toMetadata(row)
}
