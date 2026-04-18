import { Type, getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import { splitPlanSchema } from './receipt-contract'

function getPiModelName() {
  if (process.env.PI_AGENT_MODEL === 'gpt-4.1-mini') {
    return 'gpt-4.1-mini'
  }

  if (process.env.PI_AGENT_MODEL === 'gpt-5.4') {
    return 'gpt-5.4'
  }

  if (process.env.PI_AGENT_MODEL === 'gpt-5.4-mini') {
    return 'gpt-5.4-mini'
  }

  if (process.env.PI_AGENT_MODEL === 'gpt-5-mini') {
    return 'gpt-5-mini'
  }

  return 'gpt-4.1-mini'
}

function buildReceiptSummary(receipt: any) {
  const itemLines = (receipt?.items || [])
    .slice(0, 20)
    .map((item: any, index: number) => {
      return `${index + 1}. ${item.name} | qty ${item.quantity} | line total ${item.amountCents} cents`
    })

  return [
    `Merchant: ${receipt?.merchant || 'Unknown'}`,
    `Date: ${receipt?.billDate || 'Unknown'}`,
    `Currency: ${receipt?.currency || 'EUR'}`,
    `Subtotal cents: ${receipt?.subtotalCents || 0}`,
    `Tax cents: ${receipt?.taxCents || 0}`,
    `Tip cents: ${receipt?.tipCents || 0}`,
    `Total cents: ${receipt?.totalCents || 0}`,
    'Items:',
    ...itemLines,
  ].join('\n')
}

function buildPrompt({ title, people, receipt }: {
  title: string
  people: string[]
  receipt: any
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'You already have a structured receipt. Decide on a practical split and keep the workflow fast.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "start".',
    '2. Decide which items are shared and which likely belong to one person.',
    '3. Distribute tax and tip proportionally.',
    '4. Call submit_split_plan exactly once.',
    'Rules:',
    '- Only use the provided participant names.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Tax and tip should be distributed proportionally across the split.',
    '- Use log_progress for short UI-visible updates as you move through the problem.',
    '- When you are done, call submit_split_plan exactly once.',
    '- Do not ask follow-up questions.',
    '- Be decisive and pragmatic.',
    '',
    `Participants: ${people.join(', ')}`,
    '',
    `Structured receipt:\n${buildReceiptSummary(receipt)}`,
  ].join('\n')
}

export async function runPiBillAgent({
  title,
  people,
  receipt,
  onEvent = () => {},
}: {
  title: string
  people: string[]
  receipt: any
  onEvent?: (payload: any) => void
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  let finalPlan: any = null
  let sawActivity = false

  const logProgress = defineTool({
    name: 'log_progress',
    label: 'Log Progress',
    description: 'Send a short progress update to the frontend UI.',
    parameters: Type.Object({
      message: Type.String({ description: 'A short UI-safe progress message.' }),
      stage: Type.String({ description: 'Current stage label.' }),
    }),
    execute: async (_toolCallId, params) => {
      onEvent({
        type: 'agent_progress',
        message: params.message,
        stage: params.stage,
      })

      return {
        content: [{ type: 'text', text: 'Progress logged.' }],
        details: {},
      }
    },
  })

  const submitSplitPlan = defineTool({
    name: 'submit_split_plan',
    label: 'Submit Split Plan',
    description: 'Submit the final split plan once the reasoning is done.',
    parameters: Type.Object({
      notes: Type.Array(Type.String()),
      split: Type.Array(Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        note: Type.String(),
        person: Type.String(),
      })),
      summary: Type.String(),
    }),
    execute: async (_toolCallId, params) => {
      finalPlan = params

      onEvent({
        type: 'agent_plan_submitted',
        plan: params,
      })

      return {
        content: [{ type: 'text', text: 'Split plan recorded.' }],
        details: {},
      }
    },
  })

  const authStorage = AuthStorage.create()
  authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY)

  const modelRegistry = ModelRegistry.inMemory(authStorage)
  const model = getModel('openai', getPiModelName())

  const { session } = await createAgentSession({
    authStorage,
    customTools: [logProgress, submitSplitPlan],
    model,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: 'low',
    tools: [],
  })

  const firstHeartbeat = setTimeout(() => {
    if (!sawActivity && !finalPlan) {
      onEvent({
        type: 'agent_progress',
        message: 'Penny is classifying shared versus individual items.',
        stage: 'thinking',
      })
    }
  }, 5000)

  const secondHeartbeat = setTimeout(() => {
    if (!sawActivity && !finalPlan) {
      onEvent({
        type: 'agent_progress',
        message: 'Penny is still working through the split. This agent step can take a moment.',
        stage: 'thinking',
      })
    }
  }, 12000)

  const unsubscribe = session.subscribe((event) => {
    if (event.type === 'agent_start') {
      onEvent({
        type: 'status',
        phase: 'agent',
        message: 'Starting the Pi agent loop.',
      })
      return
    }

    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      sawActivity = true
      onEvent({
        type: 'agent_text_delta',
        delta: event.assistantMessageEvent.delta,
      })
      return
    }

    if (event.type === 'tool_execution_start') {
      sawActivity = true
      onEvent({
        type: 'agent_tool_start',
        toolName: event.toolName,
      })
      return
    }

    if (event.type === 'tool_execution_end') {
      sawActivity = true
      onEvent({
        type: 'agent_tool_end',
        isError: event.isError,
        toolName: event.toolName,
      })
    }
  })

  try {
    await session.prompt(buildPrompt({ title, people, receipt }))
  } finally {
    clearTimeout(firstHeartbeat)
    clearTimeout(secondHeartbeat)
    unsubscribe()
    session.dispose()
  }

  if (!finalPlan) {
    throw new Error('The Pi agent finished without submitting a split plan.')
  }

  return splitPlanSchema.parse(finalPlan)
}
