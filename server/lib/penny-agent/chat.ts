import {
  appendBillChatAssistantMessage,
  appendBillChatToolMessage,
  failRunningBillChatToolMessages,
  updateBillChatToolMessage,
} from '../bill-chat-messages'
import {
  createAgentAnalysis,
  normalizePeople,
} from '../bill-analysis'
import {
  createBillChat,
  getBillChatForAgent,
  saveBillRun,
} from '../db'
import {
  buildPennyPendingSummary,
  buildPennyRunPayload,
  createPennyChatState,
  normalizeChatText,
  readPennyChatRequest,
  resolvePennyChatParticipants,
  toSavedPennyChatResult,
} from './chat-state'
import { runPennySession } from './run'

export async function runPennyChat(input: any, personId: string, onEvent = (_event: any) => {}) {
  const currentState = input?.chatId
    ? await getBillChatForAgent(personId, normalizeChatText(input.chatId))
    : null
  const current = currentState?.chat || null
  const request = readPennyChatRequest(input, current)

  if (!request.incomingMessages.length) {
    throw new Error('At least one message is required to continue the Penny chat.')
  }

  if (!current && !normalizeChatText(request.latestMessageData.imageBase64) && !normalizeChatText(request.latestMessageData.rawText)) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const currentSplit = Array.isArray(current?.split) ? current.split : []
  const people = await resolvePennyChatParticipants({
    fallbackPeople: request.people.length
      ? request.people
      : currentSplit.map((entry: any) => entry.person),
    groupId: request.groupId,
    personId,
  })
  const chatId = current?.chatId || (await createBillChat({
    people,
    personId,
    title: request.title,
  })).id
  const state: any = createPennyChatState({
    chatId,
    current,
    people,
    request,
  })
  let snapshotSave = Promise.resolve()

  function queueSnapshot({
    agentSessionFile = currentState?.agentSessionFile || undefined,
    base = state.current,
    source,
    status,
    summary,
  }: any) {
    const payload = buildPennyRunPayload(state, base, {
      source,
      status,
      summary,
    })

    snapshotSave = snapshotSave.then(() =>
      saveBillRun({
        agentSessionFile,
        chatId: state.chatId,
        payload,
        personId,
      }).then(() => {}),
    )

    return snapshotSave
  }

  async function saveResult({
    agentSessionFile = currentState?.agentSessionFile || undefined,
    base = state.current,
    source,
    status,
    summary,
  }: any) {
    await snapshotSave

    const payload = buildPennyRunPayload(state, base, {
      source,
      status,
      summary,
    })
    const run = await saveBillRun({
      agentSessionFile,
      chatId: state.chatId,
      payload,
      personId,
    })

    return toSavedPennyChatResult(payload, run)
  }

  function queueRunningSnapshot() {
    return queueSnapshot({
      source: 'penny-pending',
      status: 'running',
      summary: buildPennyPendingSummary({
        latestMessageData: request.latestMessageData,
        receipt: state.receipt,
        split: currentSplit,
      }),
    })
  }

  await queueRunningSnapshot()

  if (!current) {
    onEvent({
      type: 'chat_started',
      chatId: state.chatId,
    })
  }

  try {
    const sessionResult = await runPennySession({
      current,
      groupId: state.groupId,
      latestMessage: request.latestMessage,
      onEvent: async (payload: any) => {
        onEvent(payload)

        if (payload?.type === 'receipt_extracted') {
          state.receipt = payload.receipt || null
          await queueRunningSnapshot()
          return
        }

        if (payload?.type === 'agent_tool_start') {
          state.messages = appendBillChatToolMessage(state.messages, payload.toolName)
          await queueRunningSnapshot()
          return
        }

        if (payload?.type === 'agent_tool_end') {
          state.messages = updateBillChatToolMessage(state.messages, payload.toolName, payload.isError ? 'error' : 'done')
          await queueRunningSnapshot()
        }
      },
      people: state.people,
      personId,
      sessionFile: currentState?.agentSessionFile || '',
      title: state.title,
    })

    state.rawReceipt = sessionResult.rawReceipt || state.rawReceipt
    state.receipt = sessionResult.receipt || state.receipt

    if (!sessionResult.plan) {
      const summary = normalizeChatText(sessionResult.message) || 'Penny has an update.'

      state.messages = appendBillChatAssistantMessage(state.messages, summary)

      return await saveResult({
        agentSessionFile: sessionResult.sessionFile || undefined,
        base: {
          ...state.current,
          openai: {
            model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
            used: Boolean(state.receipt),
          },
          penny: {
            model: process.env.PENNY_AGENT_MODEL || process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
            used: true,
          },
        },
        source: 'penny-message',
        status: 'needs_input',
        summary,
      })
    }

    state.people = normalizePeople(
      Array.isArray(sessionResult.plan?.split)
        ? sessionResult.plan.split.map((entry: any) => entry.person)
        : state.people,
    )

    const analysis = createAgentAnalysis({
      imageProvided: Boolean(normalizeChatText(request.latestMessageData.imageBase64)),
      people: state.people,
      plan: sessionResult.plan,
      rawReceipt: state.rawReceipt,
      receipt: state.receipt,
      title: state.title,
    })

    state.rawReceipt = analysis.rawReceipt
    state.receipt = analysis.receipt
    state.messages = appendBillChatAssistantMessage(state.messages, analysis.summary)

    return await saveResult({
      agentSessionFile: sessionResult.sessionFile || undefined,
      base: analysis,
      source: currentSplit.length ? 'penny-revision' : 'penny-split',
      status: 'ready',
      summary: analysis.summary,
    })
  } catch (error: any) {
    const message = normalizeChatText(error?.message) || 'Penny could not continue the chat.'

    state.messages = appendBillChatAssistantMessage(
      failRunningBillChatToolMessages(state.messages),
      message,
    )

    await saveResult({
      agentSessionFile: error?.sessionFile || currentState?.agentSessionFile || undefined,
      source: current ? 'penny-revision-error' : 'penny-chat-error',
      status: 'error',
      summary: message,
    })

    throw error
  }
}
