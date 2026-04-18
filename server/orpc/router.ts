import { os } from '@orpc/server'
import { z } from 'zod'
import { createBillRecord, createGroup, createPerson, addPersonToGroup, getGroupMemberIds, getLedgerSnapshot } from '../lib/db'
import { buildBillLedger } from '../lib/group-ledger'
import { runBillAnalysisPipeline } from '../lib/bill-pipeline'

const analyzeBill = os
  .input(z.object({
    imageBase64: z.string().optional(),
    mimeType: z.string().optional(),
    people: z.array(z.string().trim().min(1)).min(1),
    rawText: z.string().trim().optional(),
    title: z.string().trim().min(1).default('Untitled bill'),
  }))
  .handler(async ({ input }) => runBillAnalysisPipeline(input))

const getLedger = os.handler(async () => {
  return await getLedgerSnapshot()
})

const createLedgerPerson = os
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    await createPerson(input.name)
    return await getLedgerSnapshot()
  })

const createLedgerGroup = os
  .input(z.object({
    name: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    const group = await createGroup(input.name)

    return {
      groupId: group.id,
      ledger: await getLedgerSnapshot(),
    }
  })

const addLedgerPersonToGroup = os
  .input(z.object({
    groupId: z.string().trim().min(1),
    personId: z.string().trim().min(1),
  }))
  .handler(async ({ input }) => {
    await addPersonToGroup(input.groupId, input.personId)
    return await getLedgerSnapshot()
  })

const createLedgerBill = os
  .input(z.object({
    billItems: z.array(z.object({
      amountCents: z.number().int().min(0),
      assignedPersonIds: z.array(z.string().trim().min(1)).min(1),
      name: z.string().trim().min(1),
    })),
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ input }) => {
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
  })

const health = os.handler(() => ({
  databaseConfigured: Boolean(useRuntimeConfig().databaseUrl),
  name: 'agent-bill',
  openaiReady: Boolean(process.env.OPENAI_API_KEY),
  piReady: Boolean(process.env.OPENAI_API_KEY),
  streamTransport: 'sse',
  timestamp: new Date().toISOString(),
}))

export const router = {
  addLedgerPersonToGroup,
  analyzeBill,
  createLedgerBill,
  createLedgerGroup,
  createLedgerPerson,
  getLedger,
  health,
}

export type AppRouter = typeof router
