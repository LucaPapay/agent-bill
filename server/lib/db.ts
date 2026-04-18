import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { buildOpenGroupTransfers, type Transfer } from './group-simplification'

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
        create table if not exists bill_items (
          id text primary key,
          bill_id text not null references bills(id) on delete cascade,
          name text not null,
          amount_cents integer not null,
          sort_order integer not null
        )
      `

      await db()`
        create table if not exists bill_item_assignments (
          id text primary key,
          bill_item_id text not null references bill_items(id) on delete cascade,
          person_id text not null references people(id),
          unique (bill_item_id, person_id)
        )
      `

      await db()`
        create table if not exists bill_transfers (
          id text primary key,
          bill_id text not null references bills(id) on delete cascade,
          group_id text references groups(id) on delete cascade,
          from_person_id text not null references people(id),
          to_person_id text not null references people(id),
          amount_cents integer not null
        )
      `

      await db()`
        alter table bill_transfers
        add column if not exists group_id text references groups(id) on delete cascade
      `

      await db()`
        update bill_transfers
        set group_id = bills.group_id
        from bills
        where bill_transfers.bill_id = bills.id
          and bill_transfers.group_id is null
      `

      await db()`
        alter table bill_transfers
        alter column group_id set not null
      `

      await db()`
        create index if not exists bill_transfers_group_id_idx
        on bill_transfers (group_id)
      `

      await db()`
        create table if not exists settlement_payments (
          id text primary key,
          group_id text not null references groups(id) on delete cascade,
          from_person_id text not null references people(id),
          to_person_id text not null references people(id),
          amount_cents integer not null,
          created_at timestamptz not null default now(),
          voided_at timestamptz
        )
      `

      await db()`
        create index if not exists settlement_payments_group_id_idx
        on settlement_payments (group_id, created_at desc)
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
  billItems,
  paidByPersonId,
  tipAmountCents,
  title,
  totalAmountCents,
  memberShares,
  transfers,
}: {
  groupId: string
  billItems: Array<{
    amountCents: number
    assignedPersonIds: string[]
    name: string
  }>
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

    for (const [index, item] of billItems.entries()) {
      const billItemId = randomUUID()

      await sql`
        insert into bill_items (id, bill_id, name, amount_cents, sort_order)
        values (${billItemId}, ${id}, ${item.name}, ${item.amountCents}, ${index})
      `

      for (const personId of item.assignedPersonIds) {
        await sql`
          insert into bill_item_assignments (id, bill_item_id, person_id)
          values (${randomUUID()}, ${billItemId}, ${personId})
        `
      }
    }

    for (const transfer of transfers) {
      await sql`
        insert into bill_transfers (id, bill_id, group_id, from_person_id, to_person_id, amount_cents)
        values (
          ${randomUUID()},
          ${id},
          ${groupId},
          ${transfer.fromPersonId},
          ${transfer.toPersonId},
          ${transfer.amountCents}
        )
      `
    }

    return insertedBill
  })

  return {
    createdAt: billRow.created_at,
    id: billRow.id,
  }
}

async function getBillGroupId(billId: string) {
  await ensureSchema()

  const [row] = await db()`
    select group_id
    from bills
    where id = ${billId}
  `

  if (!row) {
    throw new Error('Bill not found.')
  }

  return row.group_id as string
}

async function assertNoActiveSettlementPayments(groupId: string) {
  const [row] = await db()`
    select count(*)::int as active_count
    from settlement_payments
    where group_id = ${groupId}
      and voided_at is null
  `

  if ((row?.active_count || 0) > 0) {
    throw new Error('Void active settlement payments before editing or deleting older bills.')
  }
}

export async function updateBillRecord({
  billId,
  billItems,
  memberShares,
  paidByPersonId,
  tipAmountCents,
  title,
  totalAmountCents,
  transfers,
}: {
  billId: string
  billItems: Array<{
    amountCents: number
    assignedPersonIds: string[]
    name: string
  }>
  memberShares: Array<{
    itemAmountCents: number
    personId: string
    tipAmountCents: number
    totalAmountCents: number
  }>
  paidByPersonId: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
  transfers: Array<{
    amountCents: number
    fromPersonId: string
    toPersonId: string
  }>
}) {
  await ensureSchema()

  const groupId = await getBillGroupId(billId)
  await assertNoActiveSettlementPayments(groupId)

  const updatedRow = await db().begin(async (sql) => {
    const updatedBills = await sql`
      update bills
      set
        title = ${title},
        total_amount_cents = ${totalAmountCents},
        tip_amount_cents = ${tipAmountCents},
        paid_by_person_id = ${paidByPersonId}
      where id = ${billId}
      returning id, created_at
    `
    const updatedBill = updatedBills[0]

    if (!updatedBill) {
      throw new Error('Bill not found.')
    }

    await sql`
      delete from bill_member_shares
      where bill_id = ${billId}
    `

    await sql`
      delete from bill_item_assignments
      where bill_item_id in (
        select id
        from bill_items
        where bill_id = ${billId}
      )
    `

    await sql`
      delete from bill_items
      where bill_id = ${billId}
    `

    await sql`
      delete from bill_transfers
      where bill_id = ${billId}
    `

    for (const share of memberShares) {
      await sql`
        insert into bill_member_shares (id, bill_id, person_id, item_amount_cents, tip_amount_cents, total_amount_cents)
        values (
          ${randomUUID()},
          ${billId},
          ${share.personId},
          ${share.itemAmountCents},
          ${share.tipAmountCents},
          ${share.totalAmountCents}
        )
      `
    }

    for (const [index, item] of billItems.entries()) {
      const billItemId = randomUUID()

      await sql`
        insert into bill_items (id, bill_id, name, amount_cents, sort_order)
        values (${billItemId}, ${billId}, ${item.name}, ${item.amountCents}, ${index})
      `

      for (const personId of item.assignedPersonIds) {
        await sql`
          insert into bill_item_assignments (id, bill_item_id, person_id)
          values (${randomUUID()}, ${billItemId}, ${personId})
        `
      }
    }

    for (const transfer of transfers) {
      await sql`
        insert into bill_transfers (id, bill_id, group_id, from_person_id, to_person_id, amount_cents)
        values (
          ${randomUUID()},
          ${billId},
          ${groupId},
          ${transfer.fromPersonId},
          ${transfer.toPersonId},
          ${transfer.amountCents}
        )
      `
    }

    return updatedBill
  })

  return {
    createdAt: updatedRow.created_at,
    id: updatedRow.id,
  }
}

export async function deleteBillRecord(billId: string) {
  await ensureSchema()

  const groupId = await getBillGroupId(billId)
  await assertNoActiveSettlementPayments(groupId)

  const [row] = await db()`
    delete from bills
    where id = ${billId}
    returning id, group_id
  `

  if (!row) {
    throw new Error('Bill not found.')
  }

  return {
    groupId: row.group_id,
    id: row.id,
  }
}

async function getGroupSettlementState(groupId: string) {
  await ensureSchema()

  const [transferRows, paymentRows] = await Promise.all([
    db()`
      select id, from_person_id, to_person_id, amount_cents
      from bill_transfers
      where group_id = ${groupId}
    `,
    db()`
      select id, from_person_id, to_person_id, amount_cents, created_at, voided_at
      from settlement_payments
      where group_id = ${groupId}
      order by created_at desc
    `,
  ])

  const billTransfers: Transfer[] = transferRows.map((row: any) => ({
    amountCents: row.amount_cents,
    fromPersonId: row.from_person_id,
    toPersonId: row.to_person_id,
  }))

  const settlementPayments = paymentRows.map((row: any) => ({
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    fromPersonId: row.from_person_id,
    id: row.id,
    toPersonId: row.to_person_id,
    voidedAt: row.voided_at,
  }))

  const simplifiedTransfers = buildOpenGroupTransfers(billTransfers, settlementPayments)

  return {
    billTransfers,
    settlementPayments,
    simplifiedTransfers,
  }
}

export async function createSettlementPayment({
  amountCents,
  fromPersonId,
  groupId,
  toPersonId,
}: {
  amountCents: number
  fromPersonId: string
  groupId: string
  toPersonId: string
}) {
  await ensureSchema()

  const normalizedAmountCents = Math.max(0, Math.round(amountCents))

  if (normalizedAmountCents <= 0) {
    throw new Error('Payment amount must be greater than zero.')
  }

  if (fromPersonId === toPersonId) {
    throw new Error('A payment must move between two different people.')
  }

  const groupMemberIds = await getGroupMemberIds(groupId)

  if (!groupMemberIds.includes(fromPersonId) || !groupMemberIds.includes(toPersonId)) {
    throw new Error('Settlement payments must stay inside the selected group.')
  }

  const { simplifiedTransfers } = await getGroupSettlementState(groupId)
  const openTransfer = simplifiedTransfers.find(transfer =>
    transfer.fromPersonId === fromPersonId
    && transfer.toPersonId === toPersonId,
  )

  if (!openTransfer) {
    throw new Error('That settlement edge is no longer open.')
  }

  if (normalizedAmountCents > openTransfer.amountCents) {
    throw new Error('Payment amount cannot be greater than the current open settlement.')
  }

  const id = randomUUID()
  const [row] = await db()`
    insert into settlement_payments (id, group_id, from_person_id, to_person_id, amount_cents)
    values (${id}, ${groupId}, ${fromPersonId}, ${toPersonId}, ${normalizedAmountCents})
    returning id, created_at
  `

  return {
    createdAt: row!.created_at,
    id: row!.id,
  }
}

export async function voidSettlementPayment(paymentId: string) {
  await ensureSchema()

  const [row] = await db()`
    update settlement_payments
    set voided_at = now()
    where id = ${paymentId}
      and voided_at is null
    returning id, group_id, voided_at
  `

  if (!row) {
    throw new Error('Payment not found or already undone.')
  }

  return {
    groupId: row.group_id,
    id: row.id,
    voidedAt: row.voided_at,
  }
}

export async function getLedgerSnapshot() {
  await ensureSchema()

  const [peopleRows, groupRows, membershipRows, billRows, shareRows, itemRows, itemAssignmentRows, transferRows, paymentRows] = await Promise.all([
    db()`select id, name, created_at from people order by lower(name) asc, created_at asc`,
    db()`select id, name, created_at from groups order by created_at desc`,
    db()`select id, group_id, person_id, created_at from group_memberships order by created_at asc`,
    db()`select id, group_id, title, total_amount_cents, tip_amount_cents, paid_by_person_id, created_at from bills order by created_at desc`,
    db()`select id, bill_id, person_id, item_amount_cents, tip_amount_cents, total_amount_cents from bill_member_shares`,
    db()`select id, bill_id, name, amount_cents, sort_order from bill_items order by sort_order asc, id asc`,
    db()`select id, bill_item_id, person_id from bill_item_assignments`,
    db()`select id, bill_id, group_id, from_person_id, to_person_id, amount_cents from bill_transfers`,
    db()`select id, group_id, from_person_id, to_person_id, amount_cents, created_at, voided_at from settlement_payments order by created_at desc`,
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
      items: [] as any[],
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

  const itemsById = new Map<string, any>()

  for (const row of itemRows) {
    const bill = billsById.get(row.bill_id)

    if (!bill) {
      continue
    }

    const item = {
      amountCents: row.amount_cents,
      assignedPeople: [] as any[],
      assignedPersonIds: [] as string[],
      billId: row.bill_id,
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order,
    }

    itemsById.set(row.id, item)
    bill.items.push(item)
  }

  for (const row of itemAssignmentRows) {
    const item = itemsById.get(row.bill_item_id)
    const person = peopleById.get(row.person_id)

    if (!item || !person) {
      continue
    }

    item.assignedPeople.push(person)
    item.assignedPersonIds.push(row.person_id)
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

  const billTransfersByGroupId = new Map<string, any[]>()

  for (const row of transferRows) {
    const bill = billsById.get(row.bill_id)
    const fromPerson = peopleById.get(row.from_person_id)
    const toPerson = peopleById.get(row.to_person_id)

    if (!bill || !fromPerson || !toPerson) {
      continue
    }

    const transfer = {
      amountCents: row.amount_cents,
      billId: row.bill_id,
      fromPerson,
      fromPersonId: row.from_person_id,
      id: row.id,
      toPerson,
      toPersonId: row.to_person_id,
    }

    bill.transfers.push(transfer)

    const groupTransfers = billTransfersByGroupId.get(row.group_id) || []
    groupTransfers.push(transfer)
    billTransfersByGroupId.set(row.group_id, groupTransfers)
  }

  const settlementPaymentsByGroupId = new Map<string, any[]>()

  for (const row of paymentRows) {
    const fromPerson = peopleById.get(row.from_person_id)
    const toPerson = peopleById.get(row.to_person_id)

    if (!fromPerson || !toPerson) {
      continue
    }

    const payment = {
      amountCents: row.amount_cents,
      createdAt: row.created_at,
      fromPerson,
      fromPersonId: row.from_person_id,
      id: row.id,
      isVoided: Boolean(row.voided_at),
      toPerson,
      toPersonId: row.to_person_id,
      voidedAt: row.voided_at,
    }

    const payments = settlementPaymentsByGroupId.get(row.group_id) || []
    payments.push(payment)
    settlementPaymentsByGroupId.set(row.group_id, payments)
  }

  const groups = groupRows.map((row: any) => {
    const billTransfers = billTransfersByGroupId.get(row.id) || []
    const settlementPayments = settlementPaymentsByGroupId.get(row.id) || []
    const simplifiedTransfers = buildOpenGroupTransfers(billTransfers, settlementPayments)
      .map((transfer, index) => {
        const fromPerson = peopleById.get(transfer.fromPersonId)
        const toPerson = peopleById.get(transfer.toPersonId)

        if (!fromPerson || !toPerson) {
          return null
        }

        return {
          amountCents: transfer.amountCents,
          fromPerson,
          fromPersonId: transfer.fromPersonId,
          id: `simplified:${row.id}:${index}`,
          toPerson,
          toPersonId: transfer.toPersonId,
        }
      })
      .filter(Boolean)

    return {
      billTransfers,
      bills: billsByGroupId.get(row.id) || [],
      createdAt: row.created_at,
      id: row.id,
      memberships: membershipsByGroupId.get(row.id) || [],
      name: row.name,
      settlementPayments,
      simplifiedTransfers,
    }
  })

  return {
    groups,
    people,
  }
}
