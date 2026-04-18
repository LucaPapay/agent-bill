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
    getHistory() {
      return history
    },
    record(payload: any) {
      history = appendBillChatEvent(history, payload)
    },
    push(payload: any) {
      history = appendBillChatEvent(history, payload)
      onEvent(payload)
    },
  }
}

function createRunSaver() {
  let pending = Promise.resolve()

  return {
    push(save: () => Promise<void>) {
      pending = pending.then(save)
      return pending
    },
    wait() {
      return pending
    },
  }
}

function buildChatPayload({
  base,
  chatId,
  history,
  people,
  receipt,
  summary,
  title,
}: {
  base?: any
  chatId: string
  history: any[]
  people: string[]
  receipt?: any
  summary: string
  title: string
}) {
  return {
    billDate: String(base?.billDate || receipt?.billDate || ''),
    chatId,
    currency: String(base?.currency || receipt?.currency || 'EUR'),
    history,
    items: Array.isArray(base?.items) ? base.items : Array.isArray(receipt?.items) ? receipt.items : [],
    merchant: String(base?.merchant || receipt?.merchant || title).trim() || title,
    notes: Array.isArray(base?.notes) ? base.notes : [],
    openai: base?.openai || {
      model: null,
      used: false,
    },
    people,
    pi: base?.pi || {
      model: null,
      used: false,
    },
    receipt,
    source: String(base?.source || 'pi-agent-pending'),
    split: Array.isArray(base?.split) ? base.split : [],
    summary,
    taxCents: Number(base?.taxCents || receipt?.taxCents || 0),
    tipCents: Number(base?.tipCents || receipt?.tipCents || 0),
    title,
    totalCents: Number(base?.totalCents || receipt?.totalCents || 0),
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
  const runSaver = createRunSaver()
  const chat = await createBillChat({
    people,
    personId,
    title,
  })

  await saveBillRun({
    chatId: chat.id,
    payload: buildChatPayload({
      chatId: chat.id,
      history: history.getHistory(),
      people,
      summary: 'Split started. Penny is working on the receipt.',
      title,
    }),
    personId,
  })
  onEvent({
    type: 'chat_started',
    chatId: chat.id,
  })

  if (!process.env.OPENAI_API_KEY) {
    const fallback = createLocalAnalysis({
      imageProvided: false,
      notes: ['OPENAI_API_KEY is missing, so the backend used the local text parser.'],
      people,
      rawText: input?.rawText,
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

  let latestReceipt: any = null

  async function persistCheckpoint(payload: any) {
    if (payload?.type === 'agent_text_delta' || payload?.type === 'agent_tool_end') {
      return
    }

    if (payload?.type === 'receipt_extracted') {
      latestReceipt = payload.receipt
    }

    await runSaver.push(async () => {
      await saveBillRun({
        chatId: chat.id,
        payload: buildChatPayload({
          chatId: chat.id,
          history: history.getHistory(),
          people,
          receipt: latestReceipt,
          summary: String(payload?.message || 'Penny is working on the receipt.').trim() || 'Penny is working on the receipt.',
          title,
        }),
        personId,
      })
    })
  }

  async function recordAndEmit(payload: any) {
    history.record(payload)
    await persistCheckpoint(payload)
    onEvent(payload)
  }

  try {
    const agentResult = await runPiBillAgent({
      imageBase64: input?.imageBase64,
      mimeType: input?.mimeType,
      onEvent: recordAndEmit,
      people,
      rawText: input?.rawText,
      title,
    })
    await runSaver.wait()
    const analysis = createAgentAnalysis({
      imageProvided: Boolean(input?.imageBase64),
      people,
      plan: agentResult.plan,
      receipt: agentResult.receipt,
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
  } catch (error: any) {
    await runSaver.wait()
    const payload = buildChatPayload({
      chatId: chat.id,
      history: appendBillChatEvent(history.getHistory(), {
        type: 'error',
        message: error?.message || 'The Pi agent loop failed before the split finished.',
      }),
      people,
      summary: 'Split failed before Penny finished the receipt.',
      title,
    })

    await saveBillRun({
      chatId: chat.id,
      payload: {
        ...payload,
        source: 'pi-agent-error',
      },
      personId,
    })

    throw error
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
  const runSaver = createRunSaver()
  await saveBillRun({
    chatId: current.chatId,
    payload: buildChatPayload({
      base: current,
      chatId: current.chatId,
      history: history.getHistory(),
      people,
      receipt,
      summary: String(current?.summary || 'Penny is revising the split.').trim() || 'Penny is revising the split.',
      title,
    }),
    personId,
  })

  async function persistCheckpoint(payload: any) {
    if (payload?.type === 'agent_text_delta' || payload?.type === 'agent_tool_end') {
      return
    }

    await runSaver.push(async () => {
      await saveBillRun({
        chatId: current.chatId,
        payload: buildChatPayload({
          base: current,
          chatId: current.chatId,
          history: history.getHistory(),
          people,
          receipt,
          summary: String(payload?.message || 'Penny is revising the split.').trim() || 'Penny is revising the split.',
          title,
        }),
        personId,
      })
    })
  }

  async function recordAndEmit(payload: any) {
    history.record(payload)
    await persistCheckpoint(payload)
    onEvent(payload)
  }

  try {
    const agentResult = await runPiBillRevisionAgent({
      message,
      onEvent: recordAndEmit,
      people,
      receipt,
      split,
      title,
    })
    await runSaver.wait()
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
  } catch (error: any) {
    await runSaver.wait()
    await saveBillRun({
      chatId: current.chatId,
      payload: {
        ...buildChatPayload({
          base: current,
          chatId: current.chatId,
          history: appendBillChatEvent(history.getHistory(), {
            type: 'error',
            message: error?.message || 'Penny could not revise the split.',
          }),
          people,
          receipt,
          summary: String(current?.summary || 'Penny could not revise the split.').trim() || 'Penny could not revise the split.',
          title,
        }),
        source: 'pi-agent-revision-error',
      },
      personId,
    })

    throw error
  }
}
