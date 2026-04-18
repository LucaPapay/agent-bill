import { randomUUID } from 'node:crypto'
import { db, ensureSchema } from './client'

export async function createPerson(name: string) {
  await ensureSchema()

  const id = randomUUID()
  const rows = await db()`
    insert into people (id, name)
    values (${id}, ${name})
    returning id, name, created_at
  `
  const row = rows[0]!

  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
  }
}

export async function createGroup(name: string) {
  await ensureSchema()

  const id = randomUUID()
  const rows = await db()`
    insert into groups (id, name)
    values (${id}, ${name})
    returning id, name, created_at
  `
  const row = rows[0]!

  return {
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
  }
}

export async function addPersonToGroup(groupId: string, personId: string) {
  await ensureSchema()

  const id = randomUUID()
  await db()`
    insert into group_memberships (id, group_id, person_id)
    values (${id}, ${groupId}, ${personId})
    on conflict (group_id, person_id) do nothing
  `
}

export async function getGroupMemberIds(groupId: string) {
  await ensureSchema()

  const rows = await db()`
    select person_id
    from group_memberships
    where group_id = ${groupId}
    order by created_at asc
  `

  return rows.map(row => row.person_id as string)
}
