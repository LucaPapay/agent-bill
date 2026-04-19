import { randomUUID } from 'node:crypto'
import { db, ensureSchema } from './client'

function normalizeEmail(email: string) {
  return String(email || '').trim().toLowerCase()
}

function mapPerson(row: any) {
  return {
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    email: row.email || '',
    googleSub: row.google_sub || '',
    id: row.id,
    name: row.name,
  }
}

export async function createPerson(name: string, createdByPersonId?: null | string) {
  await ensureSchema()

  const id = randomUUID()
  const rows = await db()`
    insert into people (id, name, created_by_person_id)
    values (${id}, ${name}, ${createdByPersonId || null})
    returning id, name, email, google_sub, avatar_url, created_at
  `
  return mapPerson(rows[0]!)
}

export async function findOrCreateGooglePerson({
  avatarUrl,
  email,
  googleSub,
  name,
}: {
  avatarUrl: string
  email: string
  googleSub: string
  name: string
}) {
  await ensureSchema()

  const normalizedEmail = normalizeEmail(email)

  if (!googleSub) {
    throw new Error('Google login did not return a stable account id.')
  }

  const existingRows = await db()`
    select id, name, email, google_sub, avatar_url, created_at
    from people
    where google_sub = ${googleSub}
    limit 1
  `
  const existing = existingRows[0]

  if (existing) {
    const rows = await db()`
      update people
      set
        name = ${name},
        email = ${normalizedEmail || null},
        avatar_url = ${avatarUrl || null},
        last_login_at = now()
      where id = ${existing.id}
      returning id, name, email, google_sub, avatar_url, created_at
    `

    return mapPerson(rows[0]!)
  }

  const id = randomUUID()
  const rows = await db()`
    insert into people (id, name, email, google_sub, avatar_url, last_login_at)
    values (${id}, ${name}, ${normalizedEmail || null}, ${googleSub}, ${avatarUrl || null}, now())
    returning id, name, email, google_sub, avatar_url, created_at
  `

  return mapPerson(rows[0]!)
}

export async function findPersonByEmail(email: string) {
  await ensureSchema()

  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    return null
  }

  const rows = await db()`
    select id, name, email, google_sub, avatar_url, created_at
    from people
    where lower(coalesce(email, '')) = ${normalizedEmail}
    limit 1
  `

  return rows[0] ? mapPerson(rows[0]) : null
}

export async function createGroup(name: string, presentation: {
  backgroundColor: string
  icon: string
}) {
  await ensureSchema()

  const id = randomUUID()
  const rows = await db()`
    insert into groups (id, name, icon, background_color)
    values (${id}, ${name}, ${presentation.icon}, ${presentation.backgroundColor})
    returning id, name, icon, background_color, created_at
  `
  const row = rows[0]!

  return {
    backgroundColor: row.background_color || '',
    createdAt: row.created_at,
    id: row.id,
    icon: row.icon || '',
    name: row.name,
  }
}

export async function hasPerson(personId: string) {
  await ensureSchema()

  const rows = await db()`
    select 1
    from people
    where id = ${personId}
    limit 1
  `

  return Boolean(rows[0])
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

export async function addPersonToAllGroups(personId: string) {
  await ensureSchema()

  const groups = await db()`
    select id
    from groups
  `

  for (const group of groups) {
    await db()`
      insert into group_memberships (id, group_id, person_id)
      values (${randomUUID()}, ${group.id}, ${personId})
      on conflict (group_id, person_id) do nothing
    `
  }
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

export async function getGroupMemberNames(groupId: string) {
  await ensureSchema()

  const rows = await db()`
    select people.name
    from group_memberships
    join people
      on people.id = group_memberships.person_id
    where group_memberships.group_id = ${groupId}
    order by group_memberships.created_at asc
  `

  return rows
    .map(row => String(row.name || '').trim())
    .filter(Boolean)
}

export async function canAccessGroup(personId: string, groupId: string) {
  await ensureSchema()

  const rows = await db()`
    select 1
    from group_memberships
    where group_id = ${groupId}
      and person_id = ${personId}
    limit 1
  `

  return Boolean(rows[0])
}

export async function assertPersonCanAccessGroup(personId: string, groupId: string) {
  if (await canAccessGroup(personId, groupId)) {
    return
  }

  throw new Error('You do not have access to that group.')
}

export async function assertPersonCanAccessVisiblePerson(personId: string, targetPersonId: string) {
  await ensureSchema()

  const rows = await db()`
    select 1
    from people
    where id = ${targetPersonId}
      and (
        id = ${personId}
        or created_by_person_id = ${personId}
        or exists (
          select 1
          from group_memberships member
          join group_memberships viewer
            on viewer.group_id = member.group_id
          where member.person_id = people.id
            and viewer.person_id = ${personId}
        )
      )
    limit 1
  `

  if (rows[0]) {
    return
  }

  throw new Error('You do not have access to that person.')
}
