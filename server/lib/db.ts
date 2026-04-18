import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

let client: ReturnType<typeof postgres> | null = null
let schemaReady: Promise<void> | null = null

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
    schemaReady = (async () => {
      await db()`
        create table if not exists bill_runs (
          id text primary key,
          title text not null,
          payload jsonb not null,
          created_at timestamptz not null default now()
        )
      `

      await db()`
        create table if not exists people (
          id text primary key,
          name text not null,
          created_at timestamptz not null default now()
        )
      `

      await db()`
        create table if not exists groups (
          id text primary key,
          name text not null,
          created_at timestamptz not null default now()
        )
      `

      await db()`
        create table if not exists group_memberships (
          id text primary key,
          group_id text not null references groups(id) on delete cascade,
          person_id text not null references people(id) on delete cascade,
          created_at timestamptz not null default now(),
          unique (group_id, person_id)
        )
      `

      await db()`
        create table if not exists bills (
          id text primary key,
          group_id text not null references groups(id) on delete cascade,
          title text not null,
          total_amount_cents integer not null,
          tip_amount_cents integer not null default 0,
          paid_by_person_id text not null references people(id),
          created_at timestamptz not null default now()
        )
      `

      await db()`
        create table if not exists bill_member_shares (
          id text primary key,
          bill_id text not null references bills(id) on delete cascade,
          person_id text not null references people(id),
          item_amount_cents integer not null,
          tip_amount_cents integer not null,
          total_amount_cents integer not null
        )
      `

      await db()`
        create table if not exists bill_transfers (
          id text primary key,
          bill_id text not null references bills(id) on delete cascade,
          from_person_id text not null references people(id),
          to_person_id text not null references people(id),
          amount_cents integer not null
        )
      `
    })()
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

export async function createBillRecord({
  groupId,
  paidByPersonId,
  tipAmountCents,
  title,
  totalAmountCents,
  memberShares,
  transfers,
}: {
  groupId: string
  paidByPersonId: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
  memberShares: Array<{
    itemAmountCents: number
    personId: string
    tipAmountCents: number
    totalAmountCents: number
  }>
  transfers: Array<{
    amountCents: number
    fromPersonId: string
    toPersonId: string
  }>
}) {
  await ensureSchema()

  const id = randomUUID()
  const billRow = await db().begin(async (sql) => {
    const insertedBills = await sql`
      insert into bills (id, group_id, title, total_amount_cents, tip_amount_cents, paid_by_person_id)
      values (${id}, ${groupId}, ${title}, ${totalAmountCents}, ${tipAmountCents}, ${paidByPersonId})
      returning id, created_at
    `
    const insertedBill = insertedBills[0]!

    for (const share of memberShares) {
      await sql`
        insert into bill_member_shares (id, bill_id, person_id, item_amount_cents, tip_amount_cents, total_amount_cents)
        values (
          ${randomUUID()},
          ${id},
          ${share.personId},
          ${share.itemAmountCents},
          ${share.tipAmountCents},
          ${share.totalAmountCents}
        )
      `
    }

    for (const transfer of transfers) {
      await sql`
        insert into bill_transfers (id, bill_id, from_person_id, to_person_id, amount_cents)
        values (${randomUUID()}, ${id}, ${transfer.fromPersonId}, ${transfer.toPersonId}, ${transfer.amountCents})
      `
    }

    return insertedBill
  })

  return {
    createdAt: billRow.created_at,
    id: billRow.id,
  }
}

export async function getLedgerSnapshot() {
  await ensureSchema()

  const [peopleRows, groupRows, membershipRows, billRows, shareRows, transferRows] = await Promise.all([
    db()`select id, name, created_at from people order by lower(name) asc, created_at asc`,
    db()`select id, name, created_at from groups order by created_at desc`,
    db()`select id, group_id, person_id, created_at from group_memberships order by created_at asc`,
    db()`select id, group_id, title, total_amount_cents, tip_amount_cents, paid_by_person_id, created_at from bills order by created_at desc`,
    db()`select id, bill_id, person_id, item_amount_cents, tip_amount_cents, total_amount_cents from bill_member_shares`,
    db()`select id, bill_id, from_person_id, to_person_id, amount_cents from bill_transfers`,
  ])

  const people = peopleRows.map((row: any) => ({
    createdAt: row.created_at,
    id: row.id,
    name: row.name,
  }))

  const peopleById = new Map(people.map((person: any) => [person.id, person]))
  const membershipsByGroupId = new Map<string, any[]>()

  for (const row of membershipRows) {
    const person = peopleById.get(row.person_id)

    if (!person) {
      continue
    }

    const memberships = membershipsByGroupId.get(row.group_id) || []
    memberships.push({
      createdAt: row.created_at,
      id: row.id,
      person,
      personId: row.person_id,
    })
    membershipsByGroupId.set(row.group_id, memberships)
  }

  const billsByGroupId = new Map<string, any[]>()
  const billsById = new Map<string, any>()

  for (const row of billRows) {
    const bill = {
      createdAt: row.created_at,
      id: row.id,
      paidByPerson: peopleById.get(row.paid_by_person_id) || null,
      paidByPersonId: row.paid_by_person_id,
      shares: [] as any[],
      tipAmountCents: row.tip_amount_cents,
      title: row.title,
      totalAmountCents: row.total_amount_cents,
      transfers: [] as any[],
    }

    billsById.set(row.id, bill)

    const bills = billsByGroupId.get(row.group_id) || []
    bills.push(bill)
    billsByGroupId.set(row.group_id, bills)
  }

  for (const row of shareRows) {
    const bill = billsById.get(row.bill_id)
    const person = peopleById.get(row.person_id)

    if (!bill || !person) {
      continue
    }

    bill.shares.push({
      id: row.id,
      itemAmountCents: row.item_amount_cents,
      person,
      personId: row.person_id,
      tipAmountCents: row.tip_amount_cents,
      totalAmountCents: row.total_amount_cents,
    })
  }

  for (const row of transferRows) {
    const bill = billsById.get(row.bill_id)
    const fromPerson = peopleById.get(row.from_person_id)
    const toPerson = peopleById.get(row.to_person_id)

    if (!bill || !fromPerson || !toPerson) {
      continue
    }

    bill.transfers.push({
      amountCents: row.amount_cents,
      fromPerson,
      fromPersonId: row.from_person_id,
      id: row.id,
      toPerson,
      toPersonId: row.to_person_id,
    })
  }

  const groups = groupRows.map((row: any) => ({
    bills: billsByGroupId.get(row.id) || [],
    createdAt: row.created_at,
    id: row.id,
    memberships: membershipsByGroupId.get(row.id) || [],
    name: row.name,
  }))

  return {
    groups,
    people,
  }
}
