import {
  appendBillChatEvent,
  appendBillChatReply,
  createBillChatSeed,
} from './bill-chat-history'
import {
  createAgentAnalysis,
  createLocalAnalysis,
  createReceiptAnalysis,
  normalizePeople,
  normalizeExtractedReceipt,
} from './bill-analysis'
import {
  createBillChat,
  getBillChat,
  saveBillRun,
} from './db'
import { extractReceiptWithOpenAI } from './openai-receipt'
import { runPiBillReceiptSplitAgent, runPiBillRevisionAgent } from './pi-bill-agent'

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
    source: String(base?.source || 'receipt-pending'),
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

  if (!input?.imageBase64 && !input?.rawText) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const history = createHistoryRecorder(onEvent, createBillChatSeed({
    imageBase64: input?.imageBase64,
    rawText: input?.rawText,
    title,
  }))
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
      summary: 'Receipt uploaded. Penny is parsing the bill items.',
      title,
    }),
    personId,
  })
  onEvent({
    type: 'chat_started',
    chatId: chat.id,
  })

  const analysis = !process.env.OPENAI_API_KEY
    ? createLocalAnalysis({
      imageProvided: Boolean(input?.imageBase64),
      notes: ['OPENAI_API_KEY is missing, so the backend used the local parser.'],
      people,
      rawText: input?.rawText,
      title,
    })
    : createReceiptAnalysis({
      imageProvided: Boolean(input?.imageBase64),
      people,
      receipt: normalizeExtractedReceipt(await extractReceiptWithOpenAI({
        imageBase64: input?.imageBase64,
        mimeType: input?.mimeType,
        onEvent: (payload: any) => {
          history.record(payload)
          onEvent(payload)
        },
        people,
        rawText: input?.rawText,
        title,
      })),
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
  const receipt = current?.receipt
  const split = Array.isArray(current?.split) ? current.split : []
  const people = normalizePeople(
    Array.isArray(current?.people) && current.people.length
      ? current.people
      : split.map((entry: any) => entry.person),
  )
  const participantHints = people.length ? people : normalizePeople(input?.people || [])

  if (!receipt?.totalCents) {
    throw new Error('A parsed receipt is required to revise the split.')
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
          people: participantHints,
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
          people: participantHints,
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
    const agentResult = split.length
      ? await runPiBillRevisionAgent({
        message,
        onEvent: recordAndEmit,
        people,
        receipt,
        split,
        title,
      })
      : await runPiBillReceiptSplitAgent({
        message,
        onEvent: recordAndEmit,
        people: participantHints,
        receipt,
        title,
      })
    if (!agentResult?.plan) {
      await runSaver.wait()
      const payload = {
        ...buildChatPayload({
          base: {
            ...current,
            source: 'pi-agent-question',
            summary: String(agentResult?.question || 'Penny needs one more detail.').trim() || 'Penny needs one more detail.',
          },
          chatId: current.chatId,
          history: history.finish({
            summary: String(agentResult?.question || 'Penny needs one more detail.').trim() || 'Penny needs one more detail.',
          }),
          people: participantHints,
          receipt: agentResult?.receipt || receipt,
          summary: String(agentResult?.question || 'Penny needs one more detail.').trim() || 'Penny needs one more detail.',
          title,
        }),
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

    const finalPeople = normalizePeople(
      Array.isArray(agentResult?.plan?.split)
        ? agentResult.plan.split.map((entry: any) => entry.person)
        : participantHints,
    )
    await runSaver.wait()
    const analysis = {
      ...createAgentAnalysis({
        imageProvided: false,
        people: finalPeople,
        plan: agentResult.plan,
        receipt: agentResult.receipt,
        title,
      }),
      source: split.length ? 'pi-agent-revision' : 'pi-agent-split',
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
          people: participantHints,
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
