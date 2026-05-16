import {
  AgentHarness,
  Session,
} from '@earendil-works/pi-agent-core'
import { NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import { getModel } from '@earendil-works/pi-ai'
import { splitPlanSchema } from '../receipt-contract'
import {
  BillSessionStorage,
  type BillChatSessionMetadata,
} from './session-storage'
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

async function createPennyHarness({
  chatId,
  customTools,
  personId,
}: {
  chatId: string
  customTools: any[]
  personId: string
}) {
  const model = getModel('openai', getPennyModelName())
  const session = new Session(new BillSessionStorage(personId, chatId))
  const harness = new AgentHarness({
    env: new NodeExecutionEnv({ cwd: process.cwd() }),
    getApiKeyAndHeaders: async () => ({ apiKey: process.env.OPENAI_API_KEY || '' }),
    model,
    session,
    systemPrompt: buildPennySystemPrompt(),
    thinkingLevel: 'low',
    tools: customTools,
  })

  return {
    harness,
    session,
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
  session: AgentHarness
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

async function seedSessionContext({
  current,
  groupId,
  people,
  session,
  title,
}: {
  current?: any
  groupId?: string
  people: string[]
  session: Session<BillChatSessionMetadata>
  title: string
}) {
  if (!current) {
    return
  }

  if ((await session.buildContext()).messages.length) {
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

  await session.appendCustomMessageEntry('penny_context', contextMessage, false, {
    title,
  })
}

export async function runPennySession({
  chatId,
  current,
  groupId,
  latestMessage,
  onEvent = () => {},
  people,
  personId,
  title,
}: {
  chatId: string
  current?: any
  groupId?: string
  latestMessage?: any
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
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
  const sessionState = await createPennyHarness({
    chatId,
    customTools: toolState.tools,
    personId: personId || '',
  })
  const assistantReply = { value: '' }
  const unsubscribe = subscribeToSession({
    assistantReply,
    onEvent,
    session: sessionState.harness,
    statusMessage: buildStatusMessage(current),
  })

  await seedSessionContext({
    current,
    groupId,
    people,
    session: sessionState.session,
    title,
  })

  try {
    await sessionState.harness.prompt(buildPennyUserMessage({
      groupId,
      latestMessage,
      people,
    }))
  } catch (error: any) {
    throw error
  } finally {
    unsubscribe()
  }

  if (!toolState.currentReceipt.value) {
    throw new Error('The Penny agent finished without extracting a receipt.')
  }

  if (!toolState.finalPlan.value) {
    return {
      message: normalizeText(assistantReply.value) || 'Penny has an update.',
      rawReceipt: toolState.currentRawReceipt.value || current?.rawReceipt || current?.receipt,
      receipt: toolState.currentReceipt.value,
    }
  }

  return {
    plan: splitPlanSchema.parse(toolState.finalPlan.value),
    rawReceipt: toolState.currentRawReceipt.value || current?.rawReceipt || current?.receipt,
    receipt: toolState.currentReceipt.value,
  }
}
