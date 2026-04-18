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
  if (process.env.PI_AGENT_MODEL === 'gpt-5.4') {
    return 'gpt-5.4'
  }

  if (process.env.PI_AGENT_MODEL === 'gpt-5.4-mini') {
    return 'gpt-5.4-mini'
  }

  return 'gpt-5-mini'
}

function buildPrompt({ title, people, receipt }: {
  title: string
  people: string[]
  receipt: any
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'You already have a structured receipt. Decide on a practical split.',
    'Rules:',
    '- Only use the provided participant names.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Tax and tip should be distributed proportionally across the split.',
    '- Use log_progress for short UI-visible updates as you move through the problem.',
    '- When you are done, call submit_split_plan exactly once.',
    '',
    `Participants: ${people.join(', ')}`,
    '',
    `Structured receipt JSON:\n${JSON.stringify(receipt, null, 2)}`,
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
      onEvent({
        type: 'agent_text_delta',
        delta: event.assistantMessageEvent.delta,
      })
      return
    }

    if (event.type === 'tool_execution_start') {
      onEvent({
        type: 'agent_tool_start',
        toolName: event.toolName,
      })
      return
    }

    if (event.type === 'tool_execution_end') {
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
    unsubscribe()
    session.dispose()
  }

  if (!finalPlan) {
    throw new Error('The Pi agent finished without submitting a split plan.')
  }

  return splitPlanSchema.parse(finalPlan)
}
