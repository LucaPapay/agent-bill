import { getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
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
import { splitPlanSchema } from '../receipt-contract'
import { buildPennyPrompt } from './prompt'
import { createPennyTools } from './tools'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function getPennyModelName() {
  const modelName = String(process.env.PENNY_AGENT_MODEL || process.env.PI_AGENT_MODEL || '').trim()

  if (
    modelName === 'gpt-4.1-mini'
    || modelName === 'gpt-5.4'
    || modelName === 'gpt-5.4-mini'
    || modelName === 'gpt-5-mini'
  ) {
    return modelName
  }

  return 'gpt-4.1-mini'
}

async function createPennySession(customTools: any[], sessionFile = '') {
  const authStorage = AuthStorage.create()
  authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY || '')

  const modelRegistry = ModelRegistry.inMemory(authStorage)
  const model = getModel('openai', getPennyModelName())
  const sessionManager = sessionFile
    ? SessionManager.open(sessionFile)
    : SessionManager.create(process.cwd())
  const { session } = await createAgentSession({
    authStorage,
    customTools,
    model,
    modelRegistry,
    sessionManager,
    thinkingLevel: 'low',
    tools: [],
  })

  return {
    session,
    sessionFile: session.sessionFile || sessionFile,
  }
}

function subscribeToSession({
  assistantReply,
  onEvent,
  session,
  statusMessage,
}: {
  assistantReply: { value: string }
  onEvent: (payload: any) => void
  session: any
  statusMessage: string
}) {
  return session.subscribe((event: any) => {
    if (event.type === 'agent_start') {
      void Promise.resolve(onEvent({
        type: 'status',
        phase: 'agent',
        message: statusMessage,
      })).catch(() => {})
      return
    }

    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      assistantReply.value += String(event.assistantMessageEvent.delta || '')
      void Promise.resolve(onEvent({
        type: 'agent_text_delta',
        delta: event.assistantMessageEvent.delta,
      })).catch(() => {})
      return
    }

    if (event.type === 'tool_execution_start') {
      void Promise.resolve(onEvent({
        type: 'agent_tool_start',
        toolName: event.toolName,
      })).catch(() => {})
      return
    }

    if (event.type === 'tool_execution_end') {
      void Promise.resolve(onEvent({
        type: 'agent_tool_end',
        isError: event.isError,
        toolName: event.toolName,
      })).catch(() => {})
    }
  })
}

function buildPendingSummary(current: any, turn: any) {
  if (current?.receipt && Array.isArray(current?.split) && current.split.length) {
    return 'Penny is revising the split.'
  }

  if (current?.receipt) {
    return 'Penny is building the split.'
  }

  if (turn.imageBase64 || turn.rawText) {
    return 'Receipt uploaded. Penny is parsing the bill items.'
  }

  return 'Penny is working through the chat.'
}

function buildStatusMessage(current: any) {
  if (Array.isArray(current?.split) && current.split.length) {
    return 'Penny is revising the split.'
  }

  if (current?.receipt) {
    return 'Penny is building the split.'
  }

  return 'Penny is reading the receipt and building the split.'
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
    summary: normalizeText(summary || base?.summary),
    taxCents: Number(base?.taxCents || resolvedReceipt?.taxCents || 0),
    tipCents: Number(base?.tipCents || resolvedReceipt?.tipCents || 0),
    title: normalizedTitle,
    totalCents: Number(base?.totalCents || resolvedReceipt?.totalCents || 0),
  }
}

function buildTurnInput(messages: any[], inputContext: any, current: any) {
  const baseData = inputContext && typeof inputContext === 'object' && !Array.isArray(inputContext)
    ? inputContext
    : {}
  const mergedData: any = {
    ...baseData,
    people: Array.isArray(baseData.people) ? baseData.people : [],
  }
  const messageText: string[] = []

  for (const message of messages) {
    if (message?.data && typeof message.data === 'object' && !Array.isArray(message.data)) {
      Object.assign(mergedData, message.data)

      if (Array.isArray(message.data.people) && message.data.people.length) {
        mergedData.people = message.data.people
      }
    }

    if (message.role === 'user' && normalizeText(message.text)) {
      messageText.push(normalizeText(message.text))
    }
  }

  return {
    groupId: normalizeText(mergedData.groupId),
    imageBase64: normalizeText(mergedData.imageBase64),
    message: messageText.join('\n\n').trim(),
    mimeType: normalizeText(mergedData.mimeType),
    people: Array.isArray(mergedData.people) ? normalizePeople(mergedData.people) : [],
    rawText: normalizeText(mergedData.rawText),
    title: normalizeText(mergedData.title) || normalizeText(current?.title) || 'Untitled bill',
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
  const incomingMessages = normalizeBillChatMessages(input?.messages || [])

  if (!incomingMessages.length) {
    throw new Error('At least one message is required to continue the Penny chat.')
  }

  const turn = buildTurnInput(incomingMessages, input?.context, current)

  if (!current && !turn.imageBase64 && !turn.rawText) {
    throw new Error('Provide a receipt image or OCR text.')
  }

  const currentSplit = Array.isArray(current?.split) ? current.split : []
  const fallbackPeople = turn.people.length
    ? turn.people
    : Array.isArray(current?.people) && current.people.length
      ? current.people
      : currentSplit.map((entry: any) => entry.person)
  const groupId = turn.groupId || normalizeText(current?.groupId)
  const people = await resolveParticipants({
    fallbackPeople,
    groupId,
    personId,
  })
  const title = turn.title
  const newChat = current
    ? null
    : await createBillChat({
      people,
      personId,
      title,
    })
  const chatId = current?.chatId || newChat!.id
  let messages = appendBillChatMessages(current?.messages || [], incomingMessages, true)
  const receipt = current?.receipt
  const rawReceipt = current?.rawReceipt || receipt
  const toolState = createPennyTools({
    chatId,
    groupId,
    imageBase64: turn.imageBase64 || undefined,
    mimeType: turn.mimeType || undefined,
    onEvent,
    people,
    personId,
    rawReceipt,
    rawText: turn.rawText || undefined,
    receipt,
    title,
  })
  const { session, sessionFile } = await createPennySession(toolState.tools, currentState?.agentSessionFile || '')

  await saveBillRun({
    agentSessionFile: sessionFile || undefined,
    chatId,
    payload: buildRunPayload({
      base: current,
      chatId,
      groupId,
      messages,
      people,
      rawReceipt,
      receipt,
      source: 'penny-pending',
      summary: buildPendingSummary(current, turn),
      title,
    }),
    personId,
  })

  if (!current) {
    onEvent({
      type: 'chat_started',
      chatId,
    })
  }

  if (!receipt?.totalCents && !turn.imageBase64 && !turn.rawText) {
    throw new Error('A parsed receipt is required to continue the Penny chat.')
  }

  const assistantReply = { value: '' }
  const unsubscribe = subscribeToSession({
    assistantReply,
    onEvent,
    session,
    statusMessage: buildStatusMessage(current),
  })

  try {
    await session.prompt(buildPennyPrompt({
      groupId,
      hasSessionMemory: Boolean(currentState?.agentSessionFile),
      message: turn.message,
      people,
      rawText: turn.rawText,
      receipt,
      split: currentSplit,
      title,
    }))
  } finally {
    unsubscribe()
    session.dispose()
  }

  try {
    if (!toolState.currentReceipt.value) {
      throw new Error('The Penny agent finished without extracting a receipt.')
    }

    if (!toolState.finalPlan.value) {
      const summary = normalizeText(assistantReply.value) || 'Penny has an update.'
      messages = appendBillChatAssistantMessage(messages, summary)

      const payload = buildRunPayload({
        base: {
          ...current,
          openai: {
            model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
            used: Boolean(toolState.currentReceipt.value || receipt),
          },
          penny: {
            model: process.env.PENNY_AGENT_MODEL || process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
            used: true,
          },
        },
        chatId,
        groupId,
        messages,
        people,
        rawReceipt: toolState.currentRawReceipt.value || rawReceipt,
        receipt: toolState.currentReceipt.value || receipt,
        source: 'penny-message',
        summary,
        title,
      })
      const run = await saveBillRun({
        agentSessionFile: sessionFile || undefined,
        chatId,
        payload,
        personId,
      })

      return toSavedResult(payload, run)
    }

    const plan = splitPlanSchema.parse(toolState.finalPlan.value)
    const finalPeople = normalizePeople(
      Array.isArray(plan.split)
        ? plan.split.map((entry: any) => entry.person)
        : people,
    )
    const analysis = createAgentAnalysis({
      imageProvided: Boolean(turn.imageBase64),
      people: finalPeople,
      plan,
      rawReceipt: toolState.currentRawReceipt.value || rawReceipt,
      receipt: toolState.currentReceipt.value,
      title,
    })

    messages = appendBillChatAssistantMessage(messages, analysis.summary)

    const payload = buildRunPayload({
      base: analysis,
      chatId,
      groupId,
      messages,
      people: finalPeople,
      rawReceipt: analysis.rawReceipt,
      receipt: analysis.receipt,
      source: currentSplit.length ? 'penny-revision' : 'penny-split',
      summary: analysis.summary,
      title,
    })
    const run = await saveBillRun({
      agentSessionFile: sessionFile || undefined,
      chatId,
      payload,
      personId,
    })

    return toSavedResult(payload, run)
  } catch (error: any) {
    const message = normalizeText(error?.message) || 'Penny could not continue the chat.'

    await saveBillRun({
      agentSessionFile: sessionFile || undefined,
      chatId,
      payload: {
        ...buildRunPayload({
          base: current,
          chatId,
          groupId,
          messages,
          people,
          rawReceipt,
          receipt,
          source: current ? 'penny-revision-error' : 'penny-chat-error',
          summary: message,
          title,
        }),
        history: [{
          text: message,
          who: 'log',
        }],
      },
      personId,
    })

    throw error
  }
}
