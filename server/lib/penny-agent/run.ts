import { getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import { splitPlanSchema } from '../receipt-contract'
import {
  buildPennyContextMessage,
  buildPennySystemPrompt,
  buildPennyUserMessage,
} from './prompt'
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
  const resourceLoader = new DefaultResourceLoader({
    cwd: process.cwd(),
    noContextFiles: true,
    noExtensions: true,
    noPromptTemplates: true,
    noSkills: true,
    noThemes: true,
    systemPrompt: buildPennySystemPrompt(),
  })

  await resourceLoader.reload()

  const sessionManager = sessionFile
    ? SessionManager.open(sessionFile)
    : SessionManager.create(process.cwd())
  const { session } = await createAgentSession({
    authStorage,
    customTools,
    model,
    modelRegistry,
    resourceLoader,
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

function buildStatusMessage(current: any) {
  if (Array.isArray(current?.split) && current.split.length) {
    return 'Penny is revising the split.'
  }

  if (current?.receipt) {
    return 'Penny is building the split.'
  }

  return 'Penny is reading the receipt and building the split.'
}

function seedSessionContext({
  current,
  groupId,
  people,
  session,
  title,
}: {
  current?: any
  groupId?: string
  people: string[]
  session: any
  title: string
}) {
  if (!current) {
    return
  }

  if (session.sessionManager.buildSessionContext().messages.length) {
    return
  }

  const contextMessage = buildPennyContextMessage({
    groupId,
    people,
    receipt: current.receipt,
    split: current.split,
    title,
  })

  if (!contextMessage) {
    return
  }

  session.sessionManager.appendCustomMessageEntry('penny_context', contextMessage, false, {
    title,
  })
}

export async function runPennySession({
  current,
  groupId,
  latestMessage,
  onEvent = () => {},
  people,
  personId,
  sessionFile = '',
  title,
}: {
  current?: any
  groupId?: string
  latestMessage?: any
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
  sessionFile?: string
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Penny agent loop.')
  }

  const latestMessageData = latestMessage?.data && typeof latestMessage.data === 'object' && !Array.isArray(latestMessage.data)
    ? latestMessage.data
    : {}
  const toolState = createPennyTools({
    chatId: current?.chatId,
    groupId,
    latestMessageData,
    onEvent,
    people,
    personId,
    rawReceipt: current?.rawReceipt || current?.receipt,
    receipt: current?.receipt,
    title,
  })
  const sessionState = await createPennySession(toolState.tools, sessionFile)
  const assistantReply = { value: '' }
  const unsubscribe = subscribeToSession({
    assistantReply,
    onEvent,
    session: sessionState.session,
    statusMessage: buildStatusMessage(current),
  })

  seedSessionContext({
    current,
    groupId,
    people,
    session: sessionState.session,
    title,
  })

  try {
    await sessionState.session.prompt(buildPennyUserMessage({
      groupId,
      latestMessage,
      people,
    }))
  } catch (error: any) {
    error.sessionFile = sessionState.sessionFile
    throw error
  } finally {
    unsubscribe()
    sessionState.session.dispose()
  }

  if (!toolState.currentReceipt.value) {
    throw new Error('The Penny agent finished without extracting a receipt.')
  }

  if (!toolState.finalPlan.value) {
    return {
      message: normalizeText(assistantReply.value) || 'Penny has an update.',
      rawReceipt: toolState.currentRawReceipt.value || current?.rawReceipt || current?.receipt,
      receipt: toolState.currentReceipt.value,
      sessionFile: sessionState.sessionFile,
    }
  }

  return {
    plan: splitPlanSchema.parse(toolState.finalPlan.value),
    rawReceipt: toolState.currentRawReceipt.value || current?.rawReceipt || current?.receipt,
    receipt: toolState.currentReceipt.value,
    sessionFile: sessionState.sessionFile,
  }
}
