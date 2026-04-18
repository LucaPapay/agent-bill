import { eventIterator } from '@orpc/server'
import { z } from 'zod'
import { getBillChat, listBillChats } from '../../lib/db'
import { transcribeVoiceNote } from '../../lib/openai-transcription'
import {
  runPennyAnalysis,
  runPennyRevision,
  streamExistingPennyChat,
  streamPennyAnalysis,
  streamPennyRevision,
} from '../../lib/penny-agent'
import {
  analysisChatSummarySchema,
  analysisEventSchema,
  analysisInputSchema,
  analysisResultSchema,
  revisionInputSchema,
  voiceTranscriptionInputSchema,
  voiceTranscriptionResultSchema,
} from '../../lib/receipt-contract'
import { protectedRpc } from '../base'

export const analyzeBill = protectedRpc
  .input(analysisInputSchema)
  .output(analysisResultSchema)
  .handler(async ({ context, input }) => runPennyAnalysis(input, context.personId))

export const analyzeBillStream = protectedRpc
  .input(analysisInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    yield* streamPennyAnalysis(input, context.personId)
  })

export const reviseBillSplit = protectedRpc
  .input(revisionInputSchema)
  .output(analysisResultSchema)
  .handler(async ({ context, input }) => runPennyRevision(input, context.personId))

export const reviseBillSplitStream = protectedRpc
  .input(revisionInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    yield* streamPennyRevision(input, context.personId)
  })

export const attachBillChatStream = protectedRpc
  .input(z.object({
    chatId: z.string().trim().min(1),
  }))
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    await getBillChat(context.personId, input.chatId)
    yield* streamExistingPennyChat(input.chatId)
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

export const transcribeVoiceProcedure = protectedRpc
  .input(voiceTranscriptionInputSchema)
  .output(voiceTranscriptionResultSchema)
  .handler(async ({ input }) => {
    return await transcribeVoiceNote(input)
  })

export const analysisRouter = {
  analyzeBill,
  analyzeBillStream,
  attachBillChatStream,
  getBillChat: getBillChatProcedure,
  listBillChats: listBillChatsProcedure,
  reviseBillSplit,
  reviseBillSplitStream,
  transcribeVoice: transcribeVoiceProcedure,
}
