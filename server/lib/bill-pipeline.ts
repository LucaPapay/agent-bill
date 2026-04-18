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
  assertPersonCanAccessGroup,
  createBillChat,
  getBillChat,
  getGroupMemberNames,
  saveBillRun,
} from './db'
import { runPiBillLoop } from './pi-bill-agent'

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
  groupId,
  history,
  people,
  rawReceipt,
  receipt,
  summary,
  title,
}: {
  base?: any
  chatId: string
  groupId?: string
  history: any[]
  people: string[]
  rawReceipt?: any
  receipt?: any
  summary: string
  title: string
}) {
  return {
    billDate: String(base?.billDate || receipt?.billDate || ''),
    billItems: Array.isArray(base?.billItems) ? base.billItems : [],
    chatId,
    currency: String(base?.currency || receipt?.currency || 'EUR'),
    groupId: String(groupId || base?.groupId || '').trim() || undefined,
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
    rawReceipt: base?.rawReceipt || rawReceipt,
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

async function resolveParticipants({
  fallbackPeople,
  groupId,
  personId,
}: {
  fallbackPeople: string[]
  groupId: string
  personId: string
}) {
  const normalizedGroupId = String(groupId || '').trim()

  if (!normalizedGroupId) {
    return normalizePeople(fallbackPeople)
  }

  await assertPersonCanAccessGroup(personId, normalizedGroupId)
  return normalizePeople(await getGroupMemberNames(normalizedGroupId))
}

export async function runBillAnalysisPipeline(input: any, personId: string, onEvent = (_payload: any) => {}) {
  const groupId = String(input?.groupId || '').trim()
  const title = String(input?.title || 'Untitled bill').trim() || 'Untitled bill'
  const people = await resolveParticipants({
    fallbackPeople: input?.people || [],
    groupId,
    personId,
  })

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
      groupId,
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

  let analysis: any = createLocalAnalysis({
    imageProvided: Boolean(input?.imageBase64),
    notes: ['OPENAI_API_KEY is missing, so the backend used the local parser.'],
    people,
    rawText: input?.rawText,
    title,
  })

  if (process.env.OPENAI_API_KEY) {
    const agentResult = await runPiBillLoop({
      chatId: chat.id,
      groupId,
      imageBase64: input?.imageBase64,
      mimeType: input?.mimeType,
      onEvent: (payload: any) => {
        history.record(payload)
        onEvent(payload)
      },
      people,
      personId,
      rawText: input?.rawText,
      title,
    })

    if (!agentResult?.plan) {
      const summary = String(agentResult?.question || 'Penny needs one more detail.').trim() || 'Penny needs one more detail.'
      const payload = {
        ...buildChatPayload({
          base: {
            openai: {
              model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
              used: Boolean(agentResult?.receipt),
            },
            pi: {
              model: process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
              used: true,
            },
            source: 'pi-agent-question',
            summary,
          },
          chatId: chat.id,
          groupId,
          history: history.finish({ summary }),
          people,
          rawReceipt: agentResult?.rawReceipt,
          receipt: agentResult?.receipt,
          summary,
          title,
        }),
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

    analysis = createAgentAnalysis({
      imageProvided: Boolean(input?.imageBase64),
      people: normalizePeople(
        Array.isArray(agentResult?.plan?.split)
          ? agentResult.plan.split.map((entry: any) => entry.person)
          : people,
      ),
      plan: agentResult.plan,
      rawReceipt: agentResult.rawReceipt,
      receipt: agentResult.receipt,
      title,
    })
  }

  const payload = {
    ...analysis,
    chatId: chat.id,
    groupId: groupId || undefined,
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
  const requestedGroupId = String(input?.groupId || '').trim() || String(input?.selectedGroupId || '').trim()
  const message = String(input?.message || '').trim()
  const userMessage = String(input?.userMessage || '').trim()

  if (!message) {
    throw new Error('A follow-up message is required to revise the split.')
  }

  const current = await getBillChat(personId, String(input?.chatId || ''))
  const groupId = requestedGroupId || String(current?.groupId || '').trim()
  const title = String(current?.title || 'Untitled bill').trim() || 'Untitled bill'
  const rawReceipt = current?.rawReceipt || current?.receipt
  const receipt = current?.receipt
  const split = Array.isArray(current?.split) ? current.split : []
  const people = await resolveParticipants({
    fallbackPeople: (
      Array.isArray(current?.people) && current.people.length
        ? current.people
        : split.map((entry: any) => entry.person)
    ),
    groupId,
    personId,
  })
  const participantHints = people.length
    ? people
    : await resolveParticipants({
      fallbackPeople: input?.people || [],
      groupId,
      personId,
    })

  if (!receipt?.totalCents) {
    throw new Error('A parsed receipt is required to revise the split.')
  }

  const baseHistory = userMessage
    ? appendBillChatReply(Array.isArray(current?.history) ? current.history : [], userMessage)
    : Array.isArray(current?.history) ? current.history : []
  const history = createHistoryRecorder(onEvent, baseHistory)
  const runSaver = createRunSaver()
  await saveBillRun({
    chatId: current.chatId,
    payload: buildChatPayload({
      base: current,
      chatId: current.chatId,
      groupId,
      history: history.getHistory(),
      people: participantHints,
      rawReceipt,
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
          groupId,
          history: history.getHistory(),
          people: participantHints,
          rawReceipt,
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
    const agentResult = await runPiBillLoop({
      chatId: current.chatId,
      groupId,
      message,
      onEvent: recordAndEmit,
      people: split.length ? people : participantHints,
      personId,
      rawReceipt,
      receipt,
      split,
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
          groupId,
          history: history.finish({
            summary: String(agentResult?.question || 'Penny needs one more detail.').trim() || 'Penny needs one more detail.',
          }),
          people: participantHints,
          rawReceipt: agentResult?.rawReceipt || rawReceipt,
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
        rawReceipt: agentResult?.rawReceipt || rawReceipt,
        receipt: agentResult.receipt,
        title,
      }),
      source: split.length ? 'pi-agent-revision' : 'pi-agent-split',
    }
    const payload = {
      ...analysis,
      chatId: current.chatId,
      groupId: groupId || current.groupId || undefined,
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
          groupId,
          history: appendBillChatEvent(history.getHistory(), {
            type: 'error',
            message: error?.message || 'Penny could not revise the split.',
          }),
          people: participantHints,
          rawReceipt,
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
