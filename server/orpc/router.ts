import { os } from '@orpc/server'
import { z } from 'zod'
import { createLocalAnalysis, normalizePeople, normalizePiAnalysis } from '../lib/bill-analysis'
import { createBillRecord, createGroup, createPerson, addPersonToGroup, getGroupMemberIds, getLedgerSnapshot, saveBillRun } from '../lib/db'
import { buildBillLedger } from '../lib/group-ledger'
import { analyzeBillWithPi } from '../lib/pi-analysis'

const analyzeBill = os
  .input(z.object({
    imageBase64: z.string().optional(),
    mimeType: z.string().optional(),
    people: z.array(z.string().trim().min(1)).min(1),
    rawText: z.string().trim().optional(),
    title: z.string().trim().min(1).default('Untitled bill'),
  }))
  .handler(async ({ input }) => {
    const people = normalizePeople(input.people)
    const notes: string[] = []
    const piAnalysis = await analyzeBillWithPi({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      people,
      rawText: input.rawText,
    })

    if (!piAnalysis && input.imageBase64 && !process.env.OPENAI_API_KEY) {
      notes.push('OPENAI_API_KEY is not set, so the app fell back to local parsing.')
    }

    const analysis = piAnalysis
      ? normalizePiAnalysis({
          imageProvided: Boolean(input.imageBase64),
          notes,
          people,
          piAnalysis,
          title: input.title,
        })
      : createLocalAnalysis({
          imageProvided: Boolean(input.imageBase64),
          notes,
          people,
          rawText: input.rawText,
          title: input.title,
        })

    const run = await saveBillRun(analysis)

    return {
      ...analysis,
      runId: run.id,
      savedAt: run.createdAt,
    }
  })

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
    groupId: z.string().trim().min(1),
    paidByPersonId: z.string().trim().min(1),
    splits: z.array(z.object({
      itemAmountCents: z.number().int().min(0),
      personId: z.string().trim().min(1),
    })),
    tipAmountCents: z.number().int().min(0),
    title: z.string().trim().min(1),
    totalAmountCents: z.number().int().min(0),
  }))
  .handler(async ({ input }) => {
    const groupMemberIds = await getGroupMemberIds(input.groupId)
    const { memberShares, transfers } = buildBillLedger({
      groupMemberIds,
      paidByPersonId: input.paidByPersonId,
      splitInputs: input.splits,
      tipAmountCents: input.tipAmountCents,
      totalAmountCents: input.totalAmountCents,
    })

    const bill = await createBillRecord({
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
  piReady: Boolean(process.env.OPENAI_API_KEY),
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
