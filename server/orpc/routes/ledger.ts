import { z } from 'zod'
import {
  addLedgerPersonToAllGroups,
  addLedgerPersonToGroup,
  createLedgerBill,
  createLedgerGroup,
  createLedgerPerson,
  deleteLedgerBill,
  getLedger,
  recordSettlementPayment,
  undoSettlementPayment,
  updateLedgerBill,
} from '../../lib/ledger/service'
import { protectedRpc } from '../base'

const billItemInputSchema = z.object({
  amountCents: z.number().int().min(0),
  assignedPersonIds: z.array(z.string().trim().min(1)).min(1),
  name: z.string().trim().min(1),
})

export const getLedgerProcedure = protectedRpc.handler(async ({ context }) => {
  return await getLedger(context.personId)
})

export const createLedgerPersonProcedure = protectedRpc
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await createLedgerPerson(input.name, context.personId)
  })

export const createLedgerGroupProcedure = protectedRpc
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await createLedgerGroup(input.name, context.personId)
  })

export const addLedgerPersonToGroupProcedure = protectedRpc
  .input(z.object({
    email: z.string().trim().email(),
    groupId: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await addLedgerPersonToGroup(context.personId, input.groupId, input.email)
  })

export const addLedgerPersonToAllGroupsProcedure = protectedRpc
  .handler(async ({ context }) => {
    return await addLedgerPersonToAllGroups(context.personId)
  })

export const createLedgerBillProcedure = protectedRpc
  .input(z.object({
    billDate: z.string().trim(),
    billItems: z.array(billItemInputSchema),
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ context, input }) => {
    return await createLedgerBill(context.personId, input)
  })

export const updateLedgerBillProcedure = protectedRpc
  .input(z.object({
    billId: z.string().trim().min(1),
    billDate: z.string().trim(),
    billItems: z.array(billItemInputSchema),
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ context, input }) => {
    return await updateLedgerBill(context.personId, input)
  })

export const deleteLedgerBillProcedure = protectedRpc
  .input(z.object({
    billId: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await deleteLedgerBill(context.personId, input.billId)
  })

export const recordSettlementPaymentProcedure = protectedRpc
  .input(z.object({
    amountCents: z.number().int().positive(),
    fromPersonId: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    toPersonId: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await recordSettlementPayment(context.personId, input)
  })

export const undoSettlementPaymentProcedure = protectedRpc
  .input(z.object({
    paymentId: z.string().trim().min(1),
  }))
  .handler(async ({ context, input }) => {
    return await undoSettlementPayment(context.personId, input.paymentId)
  })

export const ledgerRouter = {
  addLedgerPersonToAllGroups: addLedgerPersonToAllGroupsProcedure,
  addLedgerPersonToGroup: addLedgerPersonToGroupProcedure,
  createLedgerBill: createLedgerBillProcedure,
  createLedgerGroup: createLedgerGroupProcedure,
  createLedgerPerson: createLedgerPersonProcedure,
  deleteLedgerBill: deleteLedgerBillProcedure,
  getLedger: getLedgerProcedure,
  recordSettlementPayment: recordSettlementPaymentProcedure,
  undoSettlementPayment: undoSettlementPaymentProcedure,
  updateLedgerBill: updateLedgerBillProcedure,
}
