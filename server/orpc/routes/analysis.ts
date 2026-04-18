import { eventIterator } from '@orpc/server'
import { z } from 'zod'
import { runBillAnalysisPipeline, runBillRevisionPipeline } from '../../lib/bill-pipeline'
import { getBillChat, listBillChats } from '../../lib/db'
import { streamBillAnalysis, streamBillRevision, streamExistingBillChat } from '../../lib/bill-analysis-stream'
import {
  analysisChatSummarySchema,
  analysisEventSchema,
  analysisInputSchema,
  analysisResultSchema,
  revisionInputSchema,
} from '../../lib/receipt-contract'
import { protectedRpc } from '../base'

export const analyzeBill = protectedRpc
  .input(analysisInputSchema)
  .output(analysisResultSchema)
  .handler(async ({ context, input }) => runBillAnalysisPipeline(input, context.personId))

export const analyzeBillStream = protectedRpc
  .input(analysisInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    yield* streamBillAnalysis(input, context.personId)
  })

export const reviseBillSplit = protectedRpc
  .input(revisionInputSchema)
  .output(analysisResultSchema)
  .handler(async ({ context, input }) => runBillRevisionPipeline(input, context.personId))

export const reviseBillSplitStream = protectedRpc
  .input(revisionInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    yield* streamBillRevision(input, context.personId)
  })

export const attachBillChatStream = protectedRpc
  .input(z.object({
    chatId: z.string().trim().min(1),
  }))
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    await getBillChat(context.personId, input.chatId)
    yield* streamExistingBillChat(input.chatId)
  })

export const getBillChatProcedure = protectedRpc
  .input(z.object({
    chatId: z.string().trim().min(1),
  }))
  .output(analysisResultSchema)
  .handler(async ({ context, input }) => {
    return await getBillChat(context.personId, input.chatId)
  })

export const listBillChatsProcedure = protectedRpc
  .output(z.array(analysisChatSummarySchema))
  .handler(async ({ context }) => {
    return await listBillChats(context.personId)
  })

export const analysisRouter = {
  analyzeBill,
  analyzeBillStream,
  attachBillChatStream,
  getBillChat: getBillChatProcedure,
  listBillChats: listBillChatsProcedure,
  reviseBillSplit,
  reviseBillSplitStream,
}
