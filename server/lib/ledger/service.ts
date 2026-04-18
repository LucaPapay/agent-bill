import {
  addPersonToGroup,
  assertGroupMembership,
  assertPersonExists,
  createBillRecord,
  createGroup,
  createPerson,
  createSettlementPayment,
  deleteBillRecord,
  getBillGroupId,
  getGroupMemberIds,
  getLedgerSnapshot,
  getSettlementPaymentGroupId,
  listPeople,
  updateBillRecord,
  voidSettlementPayment,
} from '../db'
import { buildBillLedger } from '../group-ledger'

export async function listLedgerUsers() {
  return await listPeople()
}

export async function getLedger(currentUserId: string) {
  await assertPersonExists(currentUserId)
  return await getLedgerSnapshot(currentUserId)
}

export async function createLedgerPerson(name: string, currentUserId?: string) {
  await createPerson(name)
  return await getLedgerSnapshot(currentUserId)
}

export async function createLedgerGroup(name: string, currentUserId: string) {
  await assertPersonExists(currentUserId)
  const group = await createGroup(name)
  await addPersonToGroup(group.id, currentUserId)

  return {
    groupId: group.id,
    ledger: await getLedgerSnapshot(currentUserId),
  }
}

export async function addLedgerPersonToGroup(groupId: string, personId: string, currentUserId: string) {
  await assertGroupMembership(groupId, currentUserId)
  await addPersonToGroup(groupId, personId)
  return await getLedgerSnapshot(currentUserId)
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
  currentUserId: string
}) {
  await assertGroupMembership(input.groupId, input.currentUserId)
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
    ledger: await getLedgerSnapshot(input.currentUserId),
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
  currentUserId: string
}) {
  const billGroupId = await getBillGroupId(input.billId)
  await assertGroupMembership(billGroupId, input.currentUserId)

  const groupMemberIds = await getGroupMemberIds(billGroupId)
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
    ledger: await getLedgerSnapshot(input.currentUserId),
  }
}

export async function deleteLedgerBill(billId: string, currentUserId: string) {
  const groupId = await getBillGroupId(billId)
  await assertGroupMembership(groupId, currentUserId)
  const deleted = await deleteBillRecord(billId)

  return {
    billId: deleted.id,
    groupId: deleted.groupId,
    ledger: await getLedgerSnapshot(currentUserId),
  }
}

export async function recordSettlementPayment(input: {
  amountCents: number
  fromPersonId: string
  groupId: string
  toPersonId: string
  currentUserId: string
}) {
  await assertGroupMembership(input.groupId, input.currentUserId)
  await createSettlementPayment(input)
  return await getLedgerSnapshot(input.currentUserId)
}

export async function undoSettlementPayment(paymentId: string, currentUserId: string) {
  const groupId = await getSettlementPaymentGroupId(paymentId)
  await assertGroupMembership(groupId, currentUserId)
  await voidSettlementPayment(paymentId)
  return await getLedgerSnapshot(currentUserId)
}
