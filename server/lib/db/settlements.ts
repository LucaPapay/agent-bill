import { randomUUID } from 'node:crypto'
import { buildOpenGroupTransfers, type Transfer } from '../group-simplification'
import { db, ensureSchema } from './client'
import { getGroupMemberIds } from './groups'

export async function getGroupSettlementState(groupId: string) {
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

export async function getSettlementPaymentGroupId(paymentId: string) {
  await ensureSchema()

  const [row] = await db()`
    select group_id
    from settlement_payments
    where id = ${paymentId}
  `

  if (!row) {
    throw new Error('Payment not found or already undone.')
  }

  return row.group_id as string
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
