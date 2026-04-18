import { Type, getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import { normalizeExtractedReceipt } from './bill-analysis'
import { extractReceiptWithOpenAI } from './openai-receipt'
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

function buildPrompt({ title, people, imageBase64, rawText }: {
  title: string
  people: string[]
  imageBase64?: string
  rawText?: string
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'You must read the receipt, then produce a practical split and keep the workflow fast.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "start".',
    '2. Call extract_receipt exactly once.',
    '3. Decide which items are shared and which likely belong to one person.',
    '4. Distribute tax and tip proportionally.',
    '5. Call submit_split_plan exactly once.',
    'Rules:',
    '- Only use the provided participant names.',
    '- The split must include every participant exactly once.',
    '- The split amounts must sum exactly to the receipt total.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Tax and tip should be distributed proportionally across the split.',
    '- You must call extract_receipt before you decide the split.',
    '- Use log_progress for short UI-visible updates as you move through the problem.',
    '- When you are done, call submit_split_plan exactly once.',
    '- Do not ask follow-up questions.',
    '- Be decisive and pragmatic.',
    '',
    `Participants: ${people.join(', ')}`,
    '',
    imageBase64 ? 'A receipt image is available through the extract_receipt tool.' : '',
    rawText ? `OCR fallback text:\n${rawText.slice(0, 8000)}` : '',
  ].join('\n')
}

function formatMoney(amountCents: number, currency = 'EUR') {
  return `${currency} ${(amountCents / 100).toFixed(2)}`
}

function buildReceiptSummary(receipt: any) {
  const itemLines = (receipt?.items || [])
    .slice(0, 16)
    .map((item: any) => `- ${item.quantity} x ${item.name}: ${formatMoney(item.amountCents, receipt.currency)}`)
    .join('\n')

  return [
    `Merchant: ${receipt?.merchant || 'Unknown merchant'}`,
    `Total: ${formatMoney(receipt?.totalCents || 0, receipt?.currency || 'EUR')}`,
    `Tax: ${formatMoney(receipt?.taxCents || 0, receipt?.currency || 'EUR')}`,
    `Tip: ${formatMoney(receipt?.tipCents || 0, receipt?.currency || 'EUR')}`,
    'Items:',
    itemLines || '- No structured items found',
  ].join('\n')
}

function buildCurrentSplitSummary(split: any[], currency = 'EUR') {
  return split
    .map((entry: any) =>
      `- ${entry.person}: ${formatMoney(entry.amountCents || 0, currency)}${entry.note ? ` (${entry.note})` : ''}`)
    .join('\n')
}

function buildRevisionPrompt({ message, people, receipt, split, title }: {
  message: string
  people: string[]
  receipt: any
  split: any[]
  title: string
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'The receipt is already parsed. Do not ask for more data and do not call extract_receipt.',
    'Update the split based on the user follow-up message.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "revise".',
    '2. Rework the split using the parsed receipt and the current split.',
    '3. Call submit_split_plan exactly once.',
    'Rules:',
    '- Only use the provided participant names.',
    '- The split must include every participant exactly once.',
    '- The split amounts must sum exactly to the receipt total.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- If the user only clarifies ownership, keep the total and rebalance the shares.',
    '- Keep notes short and concrete.',
    '- Do not ask follow-up questions.',
    '',
    `Participants: ${people.join(', ')}`,
    '',
    'User follow-up:',
    message,
    '',
    'Parsed receipt:',
    buildReceiptSummary(receipt),
    '',
    'Current split:',
    buildCurrentSplitSummary(split, receipt?.currency || 'EUR'),
  ].join('\n')
}

function getSplitPlanError({
  people,
  receipt,
  split,
}: {
  people: string[]
  receipt: any
  split: any[]
}) {
  const totalCents = split.reduce((sum: number, entry: any) => sum + entry.amountCents, 0)
  const participantNames = split.map((entry: any) => String(entry.person || '').trim())

  if (!receipt) {
    return 'Split plan rejected. No parsed receipt is available.'
  }

  if (participantNames.length !== people.length || participantNames.some((name: string) => !people.includes(name))) {
    return `Split plan rejected. Use each participant exactly once: ${people.join(', ')}.`
  }

  if (new Set(participantNames).size !== people.length) {
    return 'Split plan rejected. A participant appears more than once.'
  }

  if (totalCents !== receipt.totalCents) {
    return `Split plan rejected. Your split totals ${totalCents} cents but the receipt total is ${receipt.totalCents} cents. Adjust and submit again.`
  }

  return ''
}

async function createPiSession(customTools: any[]) {
  const authStorage = AuthStorage.create()
  authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY || '')

  const modelRegistry = ModelRegistry.inMemory(authStorage)
  const model = getModel('openai', getPiModelName())

  const { session } = await createAgentSession({
    authStorage,
    customTools,
    model,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    thinkingLevel: 'low',
    tools: [],
  })

  return session
}

function subscribeToSession({
  onEvent,
  sawActivity,
  session,
  statusMessage,
}: {
  onEvent: (payload: any) => void
  sawActivity: { value: boolean }
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
      sawActivity.value = true
      void Promise.resolve(onEvent({
        type: 'agent_text_delta',
        delta: event.assistantMessageEvent.delta,
      })).catch(() => {})
      return
    }

    if (event.type === 'tool_execution_start') {
      sawActivity.value = true
      void Promise.resolve(onEvent({
        type: 'agent_tool_start',
        toolName: event.toolName,
      })).catch(() => {})
      return
    }

    if (event.type === 'tool_execution_end') {
      sawActivity.value = true
      void Promise.resolve(onEvent({
        type: 'agent_tool_end',
        isError: event.isError,
        toolName: event.toolName,
      })).catch(() => {})
    }
  })
}

function startHeartbeats({
  finalPlan,
  firstMessage,
  onEvent,
  sawActivity,
  secondMessage,
}: {
  finalPlan: { value: any }
  firstMessage: string
  onEvent: (payload: any) => void
  sawActivity: { value: boolean }
  secondMessage: string
}) {
  const firstHeartbeat = setTimeout(() => {
    if (!sawActivity.value && !finalPlan.value) {
      void Promise.resolve(onEvent({
        type: 'agent_progress',
        message: firstMessage,
        stage: 'thinking',
      })).catch(() => {})
    }
  }, 5000)

  const secondHeartbeat = setTimeout(() => {
    if (!sawActivity.value && !finalPlan.value) {
      void Promise.resolve(onEvent({
        type: 'agent_progress',
        message: secondMessage,
        stage: 'thinking',
      })).catch(() => {})
    }
  }, 12000)

  return () => {
    clearTimeout(firstHeartbeat)
    clearTimeout(secondHeartbeat)
  }
}

export async function runPiBillAgent({
  title,
  people,
  imageBase64,
  mimeType,
  rawText,
  onEvent = () => {},
}: {
  title: string
  people: string[]
  imageBase64?: string
  mimeType?: string
  rawText?: string
  onEvent?: (payload: any) => void
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  const finalPlan = { value: null as any }
  let extractedReceipt: any = null
  const sawActivity = { value: false }

  const logProgress = defineTool({
    name: 'log_progress',
    label: 'Log Progress',
    description: 'Send a short progress update to the frontend UI.',
    parameters: Type.Object({
      message: Type.String({ description: 'A short UI-safe progress message.' }),
      stage: Type.String({ description: 'Current stage label.' }),
    }),
    execute: async (_toolCallId, params) => {
      await onEvent({
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

  const extractReceipt = defineTool({
    name: 'extract_receipt',
    label: 'Extract Receipt',
    description: 'Parse the uploaded receipt image or OCR text into a structured receipt.',
    parameters: Type.Object({}),
    execute: async () => {
      await onEvent({
        type: 'agent_progress',
        message: 'Penny is reading the receipt.',
        stage: 'extract',
      })

      if (!extractedReceipt) {
        extractedReceipt = normalizeExtractedReceipt(await extractReceiptWithOpenAI({
          imageBase64,
          mimeType,
          onEvent: async (payload) => {
            if (payload.type === 'receipt_extracted') {
              await onEvent(payload)
            }
          },
          people,
          rawText,
          title,
        }))
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(extractedReceipt),
        }],
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
      const error = getSplitPlanError({
        people,
        receipt: extractedReceipt,
        split: params.split,
      })

      if (error) {
        return {
          content: [{ type: 'text', text: error }],
          details: {},
        }
      }

      finalPlan.value = params

      await onEvent({
        type: 'agent_plan_submitted',
        plan: params,
      })

      return {
        content: [{ type: 'text', text: 'Split plan recorded.' }],
        details: {},
      }
    },
  })

  const session = await createPiSession([extractReceipt, logProgress, submitSplitPlan])
  const stopHeartbeats = startHeartbeats({
    finalPlan,
    firstMessage: 'Penny is classifying shared versus individual items.',
    onEvent,
    sawActivity,
    secondMessage: 'Penny is still working through the split. This agent step can take a moment.',
  })
  const unsubscribe = subscribeToSession({
    onEvent,
    sawActivity,
    session,
    statusMessage: 'Starting the Pi agent loop.',
  })

  try {
    await session.prompt(buildPrompt({ imageBase64, people, rawText, title }))
  } finally {
    stopHeartbeats()
    unsubscribe()
    session.dispose()
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a split plan.')
  }

  if (!extractedReceipt) {
    throw new Error('The Pi agent finished without extracting a receipt.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    receipt: extractedReceipt,
  }
}

export async function runPiBillRevisionAgent({
  message,
  onEvent = () => {},
  people,
  receipt,
  split,
  title,
}: {
  message: string
  onEvent?: (payload: any) => void
  people: string[]
  receipt: any
  split: any[]
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  const finalPlan = { value: null as any }
  const normalizedReceipt = normalizeExtractedReceipt(receipt)
  const sawActivity = { value: false }

  const logProgress = defineTool({
    name: 'log_progress',
    label: 'Log Progress',
    description: 'Send a short progress update to the frontend UI.',
    parameters: Type.Object({
      message: Type.String({ description: 'A short UI-safe progress message.' }),
      stage: Type.String({ description: 'Current stage label.' }),
    }),
    execute: async (_toolCallId, params) => {
      await onEvent({
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
      const error = getSplitPlanError({
        people,
        receipt: normalizedReceipt,
        split: params.split,
      })

      if (error) {
        return {
          content: [{ type: 'text', text: error }],
          details: {},
        }
      }

      finalPlan.value = params

      await onEvent({
        type: 'agent_plan_submitted',
        plan: params,
      })

      return {
        content: [{ type: 'text', text: 'Split plan recorded.' }],
        details: {},
      }
    },
  })

  const session = await createPiSession([logProgress, submitSplitPlan])
  const stopHeartbeats = startHeartbeats({
    finalPlan,
    firstMessage: 'Penny is adjusting the split based on your note.',
    onEvent,
    sawActivity,
    secondMessage: 'Penny is still rebalancing the split.',
  })
  const unsubscribe = subscribeToSession({
    onEvent,
    sawActivity,
    session,
    statusMessage: 'Penny is revising the split.',
  })

  try {
    await session.prompt(buildRevisionPrompt({
      message,
      people,
      receipt: normalizedReceipt,
      split,
      title,
    }))
  } finally {
    stopHeartbeats()
    unsubscribe()
    session.dispose()
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a revised split plan.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    receipt: normalizedReceipt,
  }
}
