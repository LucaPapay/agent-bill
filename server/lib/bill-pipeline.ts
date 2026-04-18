import {
  appendBillChatEvent,
  appendBillChatReply,
  createBillChatSeed,
} from './bill-chat-history'
import {
  createAgentAnalysis,
  createLocalAnalysis,
  normalizePeople,
} from './bill-analysis'
import {
  createBillChat,
  getBillChat,
  saveBillRun,
} from './db'
import { runPiBillAgent, runPiBillRevisionAgent } from './pi-bill-agent'

function createHistoryRecorder(onEvent = (_payload: any) => {}, initialHistory: any[] = []) {
  let history = [...initialHistory]

  return {
    finish(result: any) {
      history = appendBillChatEvent(history, {
        type: 'complete',
        result,
      })

      return history
    },
    push(payload: any) {
      history = appendBillChatEvent(history, payload)
      onEvent(payload)
    },
  }
}

export async function runBillAnalysisPipeline(input: any, personId: string, onEvent = (_payload: any) => {}) {
  const title = String(input?.title || 'Untitled bill').trim() || 'Untitled bill'
  const people = normalizePeople(input?.people || [])

  if (!people.length) {
    throw new Error('At least one participant is required.')
  }

  if (!process.env.OPENAI_API_KEY) {
    if (input?.imageBase64) {
      throw new Error('OPENAI_API_KEY is required for image analysis.')
    }
  }

  if (process.env.OPENAI_API_KEY && !input?.imageBase64 && !input?.rawText) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const history = createHistoryRecorder(onEvent, createBillChatSeed({
    imageBase64: input?.imageBase64,
    people,
    rawText: input?.rawText,
    title,
  }))

  if (!process.env.OPENAI_API_KEY) {
    const fallback = createLocalAnalysis({
      imageProvided: false,
      notes: ['OPENAI_API_KEY is missing, so the backend used the local text parser.'],
      people,
      rawText: input?.rawText,
      title,
    })
    const chat = await createBillChat({
      people,
      personId,
      title,
    })
    const payload = {
      ...fallback,
      chatId: chat.id,
      history: history.finish(fallback),
    }
    const run = await saveBillRun({
      chatId: chat.id,
      payload,
      personId,
    })

    return {
      ...payload,
      runId: run.id,
      savedAt: run.createdAt,
    }
  }

  const agentResult = await runPiBillAgent({
    imageBase64: input?.imageBase64,
    mimeType: input?.mimeType,
    onEvent: history.push,
    people,
    rawText: input?.rawText,
    title,
  })
  const analysis = createAgentAnalysis({
    imageProvided: Boolean(input?.imageBase64),
    people,
    plan: agentResult.plan,
    receipt: agentResult.receipt,
    title,
  })
  const chat = await createBillChat({
    people,
    personId,
    title,
  })
  const payload = {
    ...analysis,
    chatId: chat.id,
    history: history.finish(analysis),
  }
  const run = await saveBillRun({
    chatId: chat.id,
    payload,
    personId,
  })

  return {
    ...payload,
    runId: run.id,
    savedAt: run.createdAt,
  }
}

export async function runBillRevisionPipeline(input: any, personId: string, onEvent = (_payload: any) => {}) {
  const message = String(input?.message || '').trim()

  if (!message) {
    throw new Error('A follow-up message is required to revise the split.')
  }

  const current = await getBillChat(personId, String(input?.chatId || ''))
  const title = String(current?.title || 'Untitled bill').trim() || 'Untitled bill'
  const people = normalizePeople(current?.people || [])
  const receipt = current?.receipt
  const split = Array.isArray(current?.split) ? current.split : []

  if (!people.length) {
    throw new Error('At least one participant is required.')
  }

  if (!receipt?.totalCents) {
    throw new Error('A parsed receipt is required to revise the split.')
  }

  if (!split.length) {
    throw new Error('A current split is required to revise the chat.')
  }

  const history = createHistoryRecorder(
    onEvent,
    appendBillChatReply(Array.isArray(current?.history) ? current.history : [], message),
  )
  const agentResult = await runPiBillRevisionAgent({
    message,
    onEvent: history.push,
    people,
    receipt,
    split,
    title,
  })
  const analysis = {
    ...createAgentAnalysis({
      imageProvided: false,
      people,
      plan: agentResult.plan,
      receipt: agentResult.receipt,
      title,
    }),
    source: 'pi-agent-revision',
  }
  const payload = {
    ...analysis,
    chatId: current.chatId,
    history: history.finish(analysis),
  }
  const run = await saveBillRun({
    chatId: current.chatId,
    payload,
    personId,
  })

  return {
    ...payload,
    runId: run.id,
    savedAt: run.createdAt,
  }
}
