import { buildOpenGroupTransfers } from '../group-simplification'
import { db, ensureSchema } from './client'

export async function getLedgerSnapshot(personId: string) {
  await ensureSchema()

  const [
    peopleRows,
    groupRows,
    membershipRows,
    billRows,
    shareRows,
    itemRows,
    itemAssignmentRows,
    transferRows,
    paymentRows,
  ] = await Promise.all([
    db()`
      select id, name, email, google_sub, avatar_url, created_at
      from people
      where id = ${personId}
        or created_by_person_id = ${personId}
        or exists (
          select 1
          from group_memberships member
          join group_memberships viewer
            on viewer.group_id = member.group_id
          where member.person_id = people.id
            and viewer.person_id = ${personId}
        )
      order by lower(name) asc, created_at asc
    `,
    db()`
      select id, name, icon, background_color, created_at
      from groups
      where exists (
        select 1
        from group_memberships
        where group_id = groups.id
          and person_id = ${personId}
      )
      order by created_at desc
    `,
    db()`
      select id, group_id, person_id, created_at
      from group_memberships
      where exists (
        select 1
        from group_memberships viewer
        where viewer.group_id = group_memberships.group_id
          and viewer.person_id = ${personId}
      )
      order by created_at asc
    `,
    db()`
      select id, group_id, title, total_amount_cents, tip_amount_cents, paid_by_person_id, created_at
      from bills
      where exists (
        select 1
        from group_memberships viewer
        where viewer.group_id = bills.group_id
          and viewer.person_id = ${personId}
      )
      order by created_at desc
    `,
    db()`
      select id, bill_id, person_id, item_amount_cents, tip_amount_cents, total_amount_cents
      from bill_member_shares
      where exists (
        select 1
        from bills
        join group_memberships viewer
          on viewer.group_id = bills.group_id
        where bills.id = bill_member_shares.bill_id
          and viewer.person_id = ${personId}
      )
    `,
    db()`
      select id, bill_id, name, amount_cents, sort_order
      from bill_items
      where exists (
        select 1
        from bills
        join group_memberships viewer
          on viewer.group_id = bills.group_id
        where bills.id = bill_items.bill_id
          and viewer.person_id = ${personId}
      )
      order by sort_order asc, id asc
    `,
    db()`
      select id, bill_item_id, person_id
      from bill_item_assignments
      where exists (
        select 1
        from bill_items
        join bills
          on bills.id = bill_items.bill_id
        join group_memberships viewer
          on viewer.group_id = bills.group_id
        where bill_items.id = bill_item_assignments.bill_item_id
          and viewer.person_id = ${personId}
      )
    `,
    db()`
      select id, bill_id, group_id, from_person_id, to_person_id, amount_cents
      from bill_transfers
      where exists (
        select 1
        from group_memberships viewer
        where viewer.group_id = bill_transfers.group_id
          and viewer.person_id = ${personId}
      )
    `,
    db()`
      select id, group_id, from_person_id, to_person_id, amount_cents, created_at, voided_at
      from settlement_payments
      where exists (
        select 1
        from group_memberships viewer
        where viewer.group_id = settlement_payments.group_id
          and viewer.person_id = ${personId}
      )
      order by created_at desc
    `,
  ])

  const people = peopleRows.map((row: any) => ({
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    email: row.email || '',
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
      backgroundColor: row.background_color || '',
      createdAt: row.created_at,
      id: row.id,
      icon: row.icon || '',
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
