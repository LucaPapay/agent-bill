import {
  appendBillChatAssistantMessage,
  appendBillChatMessages,
  normalizeBillChatMessages,
} from '../bill-chat-history'
import {
  createAgentAnalysis,
  normalizePeople,
} from '../bill-analysis'
import { withRunMetadata } from '../bill-run-payload'
import {
  assertPersonCanAccessGroup,
  createBillChat,
  getBillChatForAgent,
  getGroupMemberNames,
  saveBillRun,
} from '../db'
import { runPennySession } from './session'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function buildPendingSummary(current: any, latestMessageData: any) {
  if (current?.receipt && Array.isArray(current?.split) && current.split.length) {
    return 'Penny is revising the split.'
  }

  if (current?.receipt) {
    return 'Penny is building the split.'
  }

  if (normalizeText(latestMessageData?.imageBase64) || normalizeText(latestMessageData?.rawText)) {
    return 'Receipt uploaded. Penny is parsing the bill items.'
  }

  return 'Penny is working through the chat.'
}

function buildRunPayload({
  base,
  chatId,
  groupId,
  messages,
  people,
  rawReceipt,
  receipt,
  source,
  status,
  summary,
  title,
}: {
  base?: any
  chatId: string
  groupId?: string
  messages: any[]
  people: string[]
  rawReceipt?: any
  receipt?: any
  source: string
  status: 'error' | 'needs_input' | 'ready' | 'running'
  summary: string
  title: string
}) {
  const normalizedTitle = normalizeText(title) || 'Untitled bill'
  const resolvedReceipt = receipt && typeof receipt === 'object'
    ? receipt
    : undefined

  return {
    billDate: normalizeText(base?.billDate || resolvedReceipt?.billDate),
    billItems: Array.isArray(base?.billItems) ? base.billItems : [],
    chatId,
    currency: normalizeText(base?.currency || resolvedReceipt?.currency) || 'EUR',
    groupId: normalizeText(groupId || base?.groupId) || undefined,
    items: Array.isArray(base?.items) ? base.items : Array.isArray(resolvedReceipt?.items) ? resolvedReceipt.items : [],
    merchant: normalizeText(base?.merchant || resolvedReceipt?.merchant || normalizedTitle) || normalizedTitle,
    messages,
    notes: Array.isArray(base?.notes) ? base.notes : [],
    openai: base?.openai || {
      model: null,
      used: false,
    },
    people,
    penny: base?.penny || base?.pi || {
      model: null,
      used: false,
    },
    rawReceipt: base?.rawReceipt || rawReceipt,
    receipt: resolvedReceipt,
    source,
    split: Array.isArray(base?.split) ? base.split : [],
    status,
    summary: normalizeText(summary || base?.summary),
    taxCents: Number(base?.taxCents || resolvedReceipt?.taxCents || 0),
    tipCents: Number(base?.tipCents || resolvedReceipt?.tipCents || 0),
    title: normalizedTitle,
    totalCents: Number(base?.totalCents || resolvedReceipt?.totalCents || 0),
  }
}

function readChatRequest(input: any, current: any) {
  const incomingMessages = normalizeBillChatMessages(input?.messages || [])
  const latestMessage = incomingMessages[incomingMessages.length - 1]
  const latestMessageData = latestMessage?.data && typeof latestMessage.data === 'object' && !Array.isArray(latestMessage.data)
    ? latestMessage.data
    : {}
  const requestedPeople = Array.isArray(latestMessageData.people)
      ? normalizePeople(latestMessageData.people)
      : []

  return {
    groupId: normalizeText(latestMessageData.groupId || current?.groupId),
    incomingMessages,
    latestMessage,
    latestMessageData,
    people: requestedPeople,
    title: normalizeText(latestMessageData.title || current?.title) || 'Untitled bill',
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
  const normalizedGroupId = normalizeText(groupId)

  if (!normalizedGroupId) {
    return normalizePeople(fallbackPeople)
  }

  await assertPersonCanAccessGroup(personId, normalizedGroupId)
  return normalizePeople(await getGroupMemberNames(normalizedGroupId))
}

function toSavedResult(payload: any, run: any) {
  return withRunMetadata({
    created_at: run.createdAt,
    id: run.id,
    payload,
  })
}

export async function runPennyChat(input: any, personId: string, onEvent = (_payload: any) => {}) {
  const currentState = input?.chatId
    ? await getBillChatForAgent(personId, normalizeText(input.chatId))
    : null
  const current = currentState?.chat || null
  const request = readChatRequest(input, current)

  if (!request.incomingMessages.length) {
    throw new Error('At least one message is required to continue the Penny chat.')
  }

  if (!current && !normalizeText(request.latestMessageData.imageBase64) && !normalizeText(request.latestMessageData.rawText)) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const currentSplit = Array.isArray(current?.split) ? current.split : []
  const people = await resolveParticipants({
    fallbackPeople: request.people.length
      ? request.people
      : Array.isArray(current?.people) && current.people.length
        ? current.people
        : currentSplit.map((entry: any) => entry.person),
    groupId: request.groupId,
    personId,
  })
  const newChat = current
    ? null
    : await createBillChat({
      people,
      personId,
      title: request.title,
    })
  const chatId = current?.chatId || newChat!.id
  let messages = appendBillChatMessages(current?.messages || [], request.incomingMessages)
  const receipt = current?.receipt
  const rawReceipt = current?.rawReceipt || receipt

  await saveBillRun({
    agentSessionFile: currentState?.agentSessionFile || undefined,
    chatId,
    payload: buildRunPayload({
      base: current,
      chatId,
      groupId: request.groupId,
      messages,
      people,
      rawReceipt,
      receipt,
      source: 'penny-pending',
      status: 'running',
      summary: buildPendingSummary(current, request.latestMessageData),
      title: request.title,
    }),
    personId,
  })

  if (!current) {
    onEvent({
      type: 'chat_started',
      chatId,
    })
  }

  try {
    const sessionResult = await runPennySession({
      current,
      groupId: request.groupId,
      latestMessage: request.latestMessage,
      onEvent,
      people,
      personId,
      sessionFile: currentState?.agentSessionFile || '',
      title: request.title,
    })

    if (!sessionResult.plan) {
      const summary = normalizeText(sessionResult.message) || 'Penny has an update.'
      messages = appendBillChatAssistantMessage(messages, summary)

      const payload = buildRunPayload({
        base: {
          ...current,
          openai: {
            model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
            used: Boolean(sessionResult.receipt || receipt),
          },
          penny: {
            model: process.env.PENNY_AGENT_MODEL || process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
            used: true,
          },
        },
        chatId,
        groupId: request.groupId,
        messages,
        people,
        rawReceipt: sessionResult.rawReceipt || rawReceipt,
        receipt: sessionResult.receipt || receipt,
        source: 'penny-message',
        status: 'needs_input',
        summary,
        title: request.title,
      })
      const run = await saveBillRun({
        agentSessionFile: sessionResult.sessionFile || undefined,
        chatId,
        payload,
        personId,
      })

      return toSavedResult(payload, run)
    }

    const finalPeople = normalizePeople(
      Array.isArray(sessionResult.plan?.split)
        ? sessionResult.plan.split.map((entry: any) => entry.person)
        : people,
    )
    const analysis = createAgentAnalysis({
      imageProvided: Boolean(normalizeText(request.latestMessageData.imageBase64)),
      people: finalPeople,
      plan: sessionResult.plan,
      rawReceipt: sessionResult.rawReceipt || rawReceipt,
      receipt: sessionResult.receipt,
      title: request.title,
    })

    messages = appendBillChatAssistantMessage(messages, analysis.summary)

    const payload = buildRunPayload({
      base: analysis,
      chatId,
      groupId: request.groupId,
      messages,
      people: finalPeople,
      rawReceipt: analysis.rawReceipt,
      receipt: analysis.receipt,
      source: currentSplit.length ? 'penny-revision' : 'penny-split',
      status: 'ready',
      summary: analysis.summary,
      title: request.title,
    })
    const run = await saveBillRun({
      agentSessionFile: sessionResult.sessionFile || undefined,
      chatId,
      payload,
      personId,
    })

    return toSavedResult(payload, run)
  } catch (error: any) {
    const message = normalizeText(error?.message) || 'Penny could not continue the chat.'

    await saveBillRun({
      agentSessionFile: error?.sessionFile || currentState?.agentSessionFile || undefined,
      chatId,
      payload: {
        ...buildRunPayload({
          base: current,
          chatId,
          groupId: request.groupId,
          messages,
          people,
          rawReceipt,
          receipt,
          source: current ? 'penny-revision-error' : 'penny-chat-error',
          status: 'error',
          summary: message,
          title: request.title,
        }),
      },
      personId,
    })

    throw error
  }
}
