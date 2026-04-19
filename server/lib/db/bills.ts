import { randomUUID } from 'node:crypto'
import { db, ensureSchema } from './client'

export type BillItemRecord = {
  amountCents: number
  assignedPersonIds: string[]
  name: string
}

export type BillMemberShareRecord = {
  itemAmountCents: number
  personId: string
  tipAmountCents: number
  totalAmountCents: number
}

export type BillTransferRecord = {
  amountCents: number
  fromPersonId: string
  toPersonId: string
}

export async function getBillGroupId(billId: string) {
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
  await ensureSchema()

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

export async function createBillRecord({
  billDate,
  billItems,
  groupId,
  memberShares,
  paidByPersonId,
  sourceChatId,
  tipAmountCents,
  title,
  totalAmountCents,
  transfers,
}: {
  billDate: string
  billItems: BillItemRecord[]
  groupId: string
  memberShares: BillMemberShareRecord[]
  paidByPersonId: string
  sourceChatId?: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
  transfers: BillTransferRecord[]
}) {
  await ensureSchema()

  const id = randomUUID()
  const billRow = await db().begin(async (sql: any) => {
    const insertedBills = await sql`
      insert into bills (id, group_id, title, bill_date, source_chat_id, total_amount_cents, tip_amount_cents, paid_by_person_id)
      values (${id}, ${groupId}, ${title}, ${billDate || null}, ${sourceChatId || null}, ${totalAmountCents}, ${tipAmountCents}, ${paidByPersonId})
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

export async function updateBillRecord({
  billId,
  billDate,
  billItems,
  memberShares,
  paidByPersonId,
  tipAmountCents,
  title,
  totalAmountCents,
  transfers,
}: {
  billId: string
  billDate: string
  billItems: BillItemRecord[]
  memberShares: BillMemberShareRecord[]
  paidByPersonId: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
  transfers: BillTransferRecord[]
}) {
  await ensureSchema()

  const groupId = await getBillGroupId(billId)
  await assertNoActiveSettlementPayments(groupId)

  const updatedRow = await db().begin(async (sql: any) => {
    const updatedBills = await sql`
      update bills
      set
        title = ${title},
        bill_date = ${billDate || null},
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
