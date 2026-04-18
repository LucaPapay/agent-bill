import {
  addPersonToGroup,
  assertPersonCanAccessGroup,
  assertPersonCanAccessVisiblePerson,
  createBillRecord,
  createGroup,
  createPerson,
  createSettlementPayment,
  deleteBillRecord,
  getBillGroupId,
  getGroupMemberIds,
  getLedgerSnapshot,
  getSettlementPaymentGroupId,
  updateBillRecord,
  voidSettlementPayment,
} from '../db'
import { buildBillLedger } from '../group-ledger'

export async function getLedger(personId: string) {
  return await getLedgerSnapshot(personId)
}

export async function createLedgerPerson(name: string, personId: string) {
  await createPerson(name, personId)
  return await getLedgerSnapshot(personId)
}

export async function createLedgerGroup(name: string, icon: string, personId: string) {
  const group = await createGroup(name, icon)
  await addPersonToGroup(group.id, personId)

  return {
    groupId: group.id,
    ledger: await getLedgerSnapshot(personId),
  }
}

export async function addLedgerPersonToGroup(authPersonId: string, groupId: string, personId: string) {
  await assertPersonCanAccessGroup(authPersonId, groupId)
  await assertPersonCanAccessVisiblePerson(authPersonId, personId)
  await addPersonToGroup(groupId, personId)
  return await getLedgerSnapshot(authPersonId)
}

export async function createLedgerBill(authPersonId: string, input: {
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
  await assertPersonCanAccessGroup(authPersonId, input.groupId)

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
    ledger: await getLedgerSnapshot(authPersonId),
  }
}

export async function updateLedgerBill(authPersonId: string, input: {
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
  const billGroupId = await getBillGroupId(input.billId)

  if (billGroupId !== input.groupId) {
    throw new Error('Bill does not belong to the selected group.')
  }

  await assertPersonCanAccessGroup(authPersonId, billGroupId)

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
    ledger: await getLedgerSnapshot(authPersonId),
  }
}

export async function deleteLedgerBill(authPersonId: string, billId: string) {
  const groupId = await getBillGroupId(billId)
  await assertPersonCanAccessGroup(authPersonId, groupId)
  const deleted = await deleteBillRecord(billId)

  return {
    billId: deleted.id,
    groupId: deleted.groupId,
    ledger: await getLedgerSnapshot(authPersonId),
  }
}

export async function recordSettlementPayment(authPersonId: string, input: {
  amountCents: number
  fromPersonId: string
  groupId: string
  toPersonId: string
}) {
  await assertPersonCanAccessGroup(authPersonId, input.groupId)
  await createSettlementPayment(input)
  return await getLedgerSnapshot(authPersonId)
}

export async function undoSettlementPayment(authPersonId: string, paymentId: string) {
  const groupId = await getSettlementPaymentGroupId(paymentId)
  await assertPersonCanAccessGroup(authPersonId, groupId)
  await voidSettlementPayment(paymentId)
  return await getLedgerSnapshot(authPersonId)
}
