import {
  addPersonToGroup,
  createBillRecord,
  createGroup,
  createPerson,
  createSettlementPayment,
  deleteBillRecord,
  getGroupMemberIds,
  getLedgerSnapshot,
  updateBillRecord,
  voidSettlementPayment,
} from '../db'
import { buildBillLedger } from '../group-ledger'

export async function getLedger() {
  return await getLedgerSnapshot()
}

export async function createLedgerPerson(name: string) {
  await createPerson(name)
  return await getLedgerSnapshot()
}

export async function createLedgerGroup(name: string) {
  const group = await createGroup(name)

  return {
    groupId: group.id,
    ledger: await getLedgerSnapshot(),
  }
}

export async function addLedgerPersonToGroup(groupId: string, personId: string) {
  await addPersonToGroup(groupId, personId)
  return await getLedgerSnapshot()
}

export async function createLedgerBill(input: {
  billItems: Array<{
    amountCents: number
    assignedPersonIds: string[]
    name: string
  }>
  groupId: string
  paidByPersonId: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
}) {
  const groupMemberIds = await getGroupMemberIds(input.groupId)
  const { memberShares, transfers } = buildBillLedger({
    billItems: input.billItems,
    groupMemberIds,
    paidByPersonId: input.paidByPersonId,
    tipAmountCents: input.tipAmountCents,
    totalAmountCents: input.totalAmountCents,
  })

  const bill = await createBillRecord({
    billItems: input.billItems,
    groupId: input.groupId,
    memberShares,
    paidByPersonId: input.paidByPersonId,
    tipAmountCents: input.tipAmountCents,
    title: input.title,
    totalAmountCents: input.totalAmountCents,
    transfers,
  })

  return {
    billId: bill.id,
    ledger: await getLedgerSnapshot(),
  }
}

export async function updateLedgerBill(input: {
  billId: string
  billItems: Array<{
    amountCents: number
    assignedPersonIds: string[]
    name: string
  }>
  groupId: string
  paidByPersonId: string
  tipAmountCents: number
  title: string
  totalAmountCents: number
}) {
  const groupMemberIds = await getGroupMemberIds(input.groupId)
  const { memberShares, transfers } = buildBillLedger({
    billItems: input.billItems,
    groupMemberIds,
    paidByPersonId: input.paidByPersonId,
    tipAmountCents: input.tipAmountCents,
    totalAmountCents: input.totalAmountCents,
  })

  const bill = await updateBillRecord({
    billId: input.billId,
    billItems: input.billItems,
    memberShares,
    paidByPersonId: input.paidByPersonId,
    tipAmountCents: input.tipAmountCents,
    title: input.title,
    totalAmountCents: input.totalAmountCents,
    transfers,
  })

  return {
    billId: bill.id,
    ledger: await getLedgerSnapshot(),
  }
}

export async function deleteLedgerBill(billId: string) {
  const deleted = await deleteBillRecord(billId)

  return {
    billId: deleted.id,
    groupId: deleted.groupId,
    ledger: await getLedgerSnapshot(),
  }
}

export async function recordSettlementPayment(input: {
  amountCents: number
  fromPersonId: string
  groupId: string
  toPersonId: string
}) {
  await createSettlementPayment(input)
  return await getLedgerSnapshot()
}

export async function undoSettlementPayment(paymentId: string) {
  await voidSettlementPayment(paymentId)
  return await getLedgerSnapshot()
}
