import { eventIterator } from '@orpc/server'
import { z } from 'zod'
import { getBillChat, listBillChats } from '../../lib/db'
import { transcribeVoiceNote } from '../../lib/openai-transcription'
import { streamPennyChat } from '../../lib/penny-agent/stream'
import {
  analysisChatSummarySchema,
  analysisEventSchema,
  analysisResultSchema,
  billChatStreamInputSchema,
  voiceTranscriptionInputSchema,
  voiceTranscriptionResultSchema,
} from '../../lib/receipt-contract'
import { protectedRpc } from '../base'

export const chatStream = protectedRpc
  .input(billChatStreamInputSchema)
  .output(eventIterator(analysisEventSchema))
  .handler(async function* ({ context, input }) {
    yield* streamPennyChat(input, context.personId)
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
  chatStream,
  getBillChat: getBillChatProcedure,
  listBillChats: listBillChatsProcedure,
  transcribeVoice: transcribeVoiceProcedure,
}
