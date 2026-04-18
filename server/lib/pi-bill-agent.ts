import { Type, getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import { normalizeExtractedReceipt, normalizePeople, splitEvenly } from './bill-analysis'
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
    '3. Turn the parsed receipt into save-ready billItems.',
    '4. Make sure the billItems sum exactly to the receipt total, including tax, tip, and any rounding.',
    '5. Derive the participant split from those billItems.',
    '6. Call submit_split_plan exactly once.',
    'Rules:',
    '- Only use the provided participant names.',
    '- The split must include every participant exactly once.',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Single-consumer drinks or desserts should only be assigned when there is a strong clue.',
    '- Keep original receipt item names when practical, but you may add short adjustment items for shared tax, tip, or rounding.',
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
    `Date: ${receipt?.billDate || 'Unknown date'}`,
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

function buildParticipantRules(people: string[]) {
  if (people.length) {
    return [
      '- Only use the provided participant names.',
      '- The split must include every participant exactly once.',
      '',
      `Participants: ${people.join(', ')}`,
    ]
  }

  return [
    '- Infer the participant names from the user instruction and the current split.',
    '- Use short human names exactly once each in the split.',
    '',
    'Participants: infer them from the conversation.',
  ]
}

function buildClarificationRules() {
  return [
    '- If the user has not given enough information for a reliable split, call ask_follow_up_question instead of submit_split_plan.',
    '- Ask one short concrete question that unblocks the split.',
  ]
}

function buildGroupSelectionRules(people: string[]) {
  if (people.length) {
    return []
  }

  return [
    '- If no participants are available yet, call select_group exactly once before you do any split work.',
    '- Do not call ask_follow_up_question or submit_split_plan until the group is known.',
    '- If the user instruction already says which group was selected, do not call select_group again.',
  ]
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
    'The receipt is already parsed. Do not ask for more receipt data and do not call extract_receipt.',
    'Update the split based on the user follow-up message.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "revise".',
    '2. Rework the save-ready billItems using the parsed receipt and the current split.',
    '3. Recompute the participant split from those billItems.',
    '4. Either call submit_split_plan exactly once or call ask_follow_up_question exactly once.',
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- If the user only clarifies ownership, keep the total and rebalance the shares.',
    '- Keep notes short and concrete.',
    ...buildClarificationRules(),
    ...buildParticipantRules(people),
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

function buildReceiptSplitPrompt({ message, people, receipt, title }: {
  message: string
  people: string[]
  receipt: any
  title: string
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'The receipt is already parsed. Do not ask for more data and do not call extract_receipt.',
    'Create the first split from the parsed receipt and the user instruction.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "split".',
    '2. Build save-ready billItems using the parsed receipt and the user instruction.',
    '3. Compute the participant split from those billItems.',
    '4. Either call submit_split_plan exactly once or call ask_follow_up_question exactly once.',
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Keep original receipt item names when practical, but you may add short adjustment items for shared tax, tip, or rounding.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- Keep notes short and concrete.',
    '- If the user only gave you the group or participant list, call ask_follow_up_question with one short question about how the receipt should be split before you create the first split.',
    ...buildClarificationRules(),
    ...buildGroupSelectionRules(people),
    ...buildParticipantRules(people),
    '',
    'User instruction:',
    message,
    '',
    'Parsed receipt:',
    buildReceiptSummary(receipt),
  ].join('\n')
}

function getSplitPlanError({
  billItems,
  people,
  receipt,
  split,
}: {
  billItems: any[]
  people: string[]
  receipt: any
  split: any[]
}) {
  const totalCents = split.reduce((sum: number, entry: any) => sum + entry.amountCents, 0)
  const participantNames = split.map((entry: any) => String(entry.person || '').trim())
  const allowedPeople = people.length ? people : participantNames

  if (!receipt) {
    return 'Split plan rejected. No parsed receipt is available.'
  }

  if (!participantNames.length || participantNames.some((name: string) => !name)) {
    return 'Split plan rejected. Each split row needs a participant name.'
  }

  if (new Set(participantNames).size !== participantNames.length) {
    return 'Split plan rejected. A participant appears more than once.'
  }

  if (people.length && (
    participantNames.length !== people.length
    || participantNames.some((name: string) => !people.includes(name))
  )) {
    return `Split plan rejected. Use each participant exactly once: ${people.join(', ')}.`
  }

  if (totalCents !== receipt.totalCents) {
    return `Split plan rejected. Your split totals ${totalCents} cents but the receipt total is ${receipt.totalCents} cents. Adjust and submit again.`
  }

  if (!Array.isArray(billItems) || !billItems.length) {
    return 'Split plan rejected. Include at least one save-ready bill item.'
  }

  const normalizedBillItems = billItems.map((item: any, index: number) => ({
    amountCents: Math.max(0, Math.round(Number(item?.amountCents || 0))),
    assignedPeople: normalizePeople(Array.isArray(item?.assignedPeople) ? item.assignedPeople : []),
    name: String(item?.name || `Item ${index + 1}`).trim(),
  }))

  if (normalizedBillItems.some((item: any) => !item.name || item.amountCents <= 0 || !item.assignedPeople.length)) {
    return 'Split plan rejected. Every bill item needs a name, a positive amount, and at least one assigned person.'
  }

  if (normalizedBillItems.some((item: any) => item.assignedPeople.some((person: string) => !allowedPeople.includes(person)))) {
    return `Split plan rejected. billItems can only use these participants: ${allowedPeople.join(', ')}.`
  }

  const billItemsTotal = normalizedBillItems.reduce((sum: number, item: any) => sum + item.amountCents, 0)

  if (billItemsTotal !== receipt.totalCents) {
    return `Split plan rejected. Your billItems total ${billItemsTotal} cents but the receipt total is ${receipt.totalCents} cents. Adjust and submit again.`
  }

  const derivedTotals = new Map(allowedPeople.map((person: string) => [person, 0]))

  for (const item of normalizedBillItems) {
    const splitAmounts = splitEvenly(item.amountCents, item.assignedPeople)

    for (const entry of splitAmounts) {
      derivedTotals.set(entry.person, (derivedTotals.get(entry.person) || 0) + entry.amountCents)
    }
  }

  for (const entry of split) {
    if ((derivedTotals.get(entry.person) || 0) !== entry.amountCents) {
      return 'Split plan rejected. The billItems do not reproduce the submitted participant totals.'
    }
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

function defineFollowUpQuestionTool({
  followUpQuestion,
}: {
  followUpQuestion: { value: string }
}) {
  return defineTool({
    name: 'ask_follow_up_question',
    label: 'Ask Follow-up Question',
    description: 'Ask one short question when the user has not given enough information for a reliable split.',
    parameters: Type.Object({
      question: Type.String({ description: 'A single short clarifying question for the user.' }),
    }),
    execute: async (_toolCallId, params) => {
      const question = String(params.question || '').trim()

      if (!question) {
        return {
          content: [{ type: 'text', text: 'Provide a non-empty question.' }],
          details: {},
        }
      }

      followUpQuestion.value = question

      return {
        content: [{ type: 'text', text: 'Question recorded.' }],
        details: {},
      }
    },
  })
}

function defineSelectGroupTool({
  followUpQuestion,
}: {
  followUpQuestion: { value: string }
}) {
  return defineTool({
    name: 'select_group',
    label: 'Select Group',
    description: 'Ask the user which group this receipt belongs to before you create the first split.',
    parameters: Type.Object({
      question: Type.String({ description: 'A single short question asking for the group.' }),
    }),
    execute: async (_toolCallId, params) => {
      const question = String(params.question || '').trim()

      if (!question) {
        return {
          content: [{ type: 'text', text: 'Provide a non-empty question.' }],
          details: {},
        }
      }

      followUpQuestion.value = question

      return {
        content: [{ type: 'text', text: 'Group question recorded.' }],
        details: {},
      }
    },
  })
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
      billItems: Type.Array(Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        assignedPeople: Type.Array(Type.String()),
        name: Type.String(),
      })),
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
        billItems: params.billItems,
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
  const followUpQuestion = { value: '' }
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
      billItems: Type.Array(Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        assignedPeople: Type.Array(Type.String()),
        name: Type.String(),
      })),
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
        billItems: params.billItems,
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

  const askFollowUpQuestion = defineFollowUpQuestionTool({
    followUpQuestion,
  })

  const session = await createPiSession([logProgress, askFollowUpQuestion, submitSplitPlan])
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

  if (followUpQuestion.value) {
    return {
      question: followUpQuestion.value,
      receipt: normalizedReceipt,
    }
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a revised split plan.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    receipt: normalizedReceipt,
  }
}

export async function runPiBillReceiptSplitAgent({
  message,
  onEvent = () => {},
  people,
  receipt,
  title,
}: {
  message: string
  onEvent?: (payload: any) => void
  people: string[]
  receipt: any
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  const finalPlan = { value: null as any }
  const followUpQuestion = { value: '' }
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
      billItems: Type.Array(Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        assignedPeople: Type.Array(Type.String()),
        name: Type.String(),
      })),
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
        billItems: params.billItems,
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

  const askFollowUpQuestion = defineFollowUpQuestionTool({
    followUpQuestion,
  })
  const selectGroup = defineSelectGroupTool({
    followUpQuestion,
  })

  const session = await createPiSession([logProgress, selectGroup, askFollowUpQuestion, submitSplitPlan])
  const stopHeartbeats = startHeartbeats({
    finalPlan,
    firstMessage: 'Penny is turning the parsed receipt into a first split.',
    onEvent,
    sawActivity,
    secondMessage: 'Penny is still balancing the split.',
  })
  const unsubscribe = subscribeToSession({
    onEvent,
    sawActivity,
    session,
    statusMessage: 'Penny is building the first split.',
  })

  try {
    await session.prompt(buildReceiptSplitPrompt({
      message,
      people,
      receipt: normalizedReceipt,
      title,
    }))
  } finally {
    stopHeartbeats()
    unsubscribe()
    session.dispose()
  }

  if (followUpQuestion.value) {
    return {
      question: followUpQuestion.value,
      receipt: normalizedReceipt,
    }
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a split plan.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    receipt: normalizedReceipt,
  }
}
