import { os } from '@orpc/server'
import { z } from 'zod'
import {
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

const billItemInputSchema = z.object({
  amountCents: z.number().int().min(0),
  assignedPersonIds: z.array(z.string().trim().min(1)).min(1),
  name: z.string().trim().min(1),
})

export const getLedgerProcedure = os.handler(async () => {
  return await getLedger()
})

export const createLedgerPersonProcedure = os
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await createLedgerPerson(input.name)
  })

export const createLedgerGroupProcedure = os
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await createLedgerGroup(input.name)
  })

export const addLedgerPersonToGroupProcedure = os
  .input(z.object({
    groupId: z.string().trim().min(1),
    personId: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await addLedgerPersonToGroup(input.groupId, input.personId)
  })

export const createLedgerBillProcedure = os
  .input(z.object({
    billItems: z.array(billItemInputSchema),
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ input }) => {
    return await createLedgerBill(input)
  })

export const updateLedgerBillProcedure = os
  .input(z.object({
    billId: z.string().trim().min(1),
    billItems: z.array(billItemInputSchema),
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ input }) => {
    return await updateLedgerBill(input)
  })

export const deleteLedgerBillProcedure = os
  .input(z.object({
    billId: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await deleteLedgerBill(input.billId)
  })

export const recordSettlementPaymentProcedure = os
  .input(z.object({
    amountCents: z.number().int().positive(),
    fromPersonId: z.string().trim().min(1),
    groupId: z.string().trim().min(1),
    toPersonId: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await recordSettlementPayment(input)
  })

export const undoSettlementPaymentProcedure = os
  .input(z.object({
    paymentId: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    return await undoSettlementPayment(input.paymentId)
  })

export const ledgerRouter = {
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
