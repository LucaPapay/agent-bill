import { Type, getModel } from '@mariozechner/pi-ai'
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from '@mariozechner/pi-coding-agent'
import {
  editExtractedReceipt,
  normalizeExtractedReceipt,
  normalizePeople,
  reconcileExtractedReceipt,
  splitEvenly,
} from '../bill-analysis'
import { extractReceiptWithOpenAI } from '../openai-receipt'
import { splitPlanSchema } from '../receipt-contract'
import { buildPennyPrompt } from './prompt'
import { loadPreviousSplitHints, searchPreviousSplits } from './previous-splits'

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

  if (!people.length) {
    return 'Split plan rejected. No participant list is available yet. Ask a follow-up question instead of inventing names.'
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

function toolResponse(payload: unknown) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(payload),
    }],
    details: {},
  }
}

function defineReceiptReconcileTool({
  currentReceipt,
  onEvent,
}: {
  currentReceipt: { value: any }
  onEvent: (payload: any) => void
}) {
  return defineTool({
    name: 'reconcile_extracted_receipt',
    label: 'Reconcile Extracted Receipt',
    description: 'Safely repair extracted receipt math when subtotal, tax, tip, total, money-scale, or rounding do not line up.',
    parameters: Type.Object({}),
    execute: async () => {
      if (!currentReceipt.value) {
        return toolResponse({
          corrections: [],
          receipt: null,
          summary: 'No parsed receipt is available yet.',
        })
      }

      const result = reconcileExtractedReceipt(currentReceipt.value)
      currentReceipt.value = result.receipt

      await onEvent({
        type: 'agent_progress',
        message: result.summary,
        stage: 'receipt',
      })

      return toolResponse(result)
    },
  })
}

function defineReceiptEditTool({
  currentReceipt,
  onEvent,
}: {
  currentReceipt: { value: any }
  onEvent: (payload: any) => void
}) {
  return defineTool({
    name: 'edit_extracted_receipt',
    label: 'Edit Extracted Receipt',
    description: 'Apply an explicit user-requested correction to the parsed receipt while keeping the working receipt normalized.',
    parameters: Type.Object({
      billDate: Type.Optional(Type.String({ description: 'Updated receipt date, usually YYYY-MM-DD.' })),
      currency: Type.Optional(Type.String({ description: 'Updated receipt currency such as EUR or USD.' })),
      items: Type.Optional(Type.Array(Type.Object({
        amountCents: Type.Integer({ minimum: 0 }),
        name: Type.String(),
        quantity: Type.Optional(Type.Integer({ minimum: 1 })),
      }))),
      merchant: Type.Optional(Type.String({ description: 'Updated merchant name.' })),
      reason: Type.String({ description: 'Short explanation of what the user corrected.' }),
      subtotalCents: Type.Optional(Type.Integer({ minimum: 0 })),
      taxCents: Type.Optional(Type.Integer({ minimum: 0 })),
      tipCents: Type.Optional(Type.Integer({ minimum: 0 })),
      totalCents: Type.Optional(Type.Integer({ minimum: 0 })),
    }),
    execute: async (_toolCallId, params) => {
      if (!currentReceipt.value) {
        return toolResponse({
          corrections: [],
          receipt: null,
          summary: 'No parsed receipt is available yet.',
        })
      }

      const reason = String(params.reason || '').trim()

      if (!reason) {
        return toolResponse({
          corrections: [],
          receipt: currentReceipt.value,
          summary: 'Provide a non-empty reason before editing the receipt.',
        })
      }

      const changes = {
        billDate: params.billDate,
        currency: params.currency,
        items: params.items,
        merchant: params.merchant,
        subtotalCents: params.subtotalCents,
        taxCents: params.taxCents,
        tipCents: params.tipCents,
        totalCents: params.totalCents,
      }
      const result = editExtractedReceipt(currentReceipt.value, changes, reason)
      currentReceipt.value = result.receipt

      await onEvent({
        type: 'agent_progress',
        message: result.summary,
        stage: 'receipt',
      })

      return toolResponse(result)
    },
  })
}

function definePreviousSplitsTool({
  chatId,
  currentReceipt,
  groupId,
  onEvent,
  people,
  personId,
}: {
  chatId?: string
  currentReceipt: { value: any }
  groupId?: string
  onEvent: (payload: any) => void
  people: string[]
  personId?: string
}) {
  return defineTool({
    name: 'search_previous_splits',
    label: 'Search Previous Splits',
    description: 'Find previous splits for this user that may help infer who usually shares or orders similar dishes.',
    parameters: Type.Object({
      maxResults: Type.Optional(Type.Integer({ maximum: 5, minimum: 1 })),
      query: Type.Optional(Type.String({ description: 'Short search hint such as "same sushi group".' })),
    }),
    execute: async (_toolCallId, params) => {
      if (!currentReceipt.value) {
        return toolResponse({
          matches: [],
          summary: 'No parsed receipt is available yet.',
        })
      }

      if (!personId) {
        return toolResponse({
          matches: [],
          summary: 'No searchable split history is available yet.',
        })
      }

      if (!String(groupId || '').trim()) {
        return toolResponse({
          matches: [],
          summary: 'Select the group before searching previous splits.',
        })
      }

      await onEvent({
        type: 'agent_progress',
        message: 'Penny is checking what this group ate before.',
        stage: 'memory',
      })

      return toolResponse(await searchPreviousSplits({
        chatId,
        groupId,
        maxResults: Number(params.maxResults || 5),
        people,
        personId,
        query: String(params.query || ''),
        receipt: currentReceipt.value,
      }))
    },
  })
}

async function createPennySession(customTools: any[]) {
  const authStorage = AuthStorage.create()
  authStorage.setRuntimeApiKey('openai', process.env.OPENAI_API_KEY || '')

  const modelRegistry = ModelRegistry.inMemory(authStorage)
  const model = getModel('openai', getPennyModelName())

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

export async function runPennyAgent({
  chatId,
  groupId,
  imageBase64,
  message,
  mimeType,
  onEvent = () => {},
  people,
  personId,
  rawReceipt,
  rawText,
  receipt,
  split = [],
  title,
}: {
  chatId?: string
  groupId?: string
  imageBase64?: string
  message?: string
  mimeType?: string
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
  rawReceipt?: any
  rawText?: string
  receipt?: any
  split?: any[]
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Penny agent loop.')
  }

  const currentRawReceipt = { value: (rawReceipt || receipt || null) as any }
  const currentReceipt = { value: (receipt ? normalizeExtractedReceipt(receipt) : null) as any }
  const finalPlan = { value: null as any }
  const followUpQuestion = { value: '' }
  const sawActivity = { value: false }
  const currentSplit = Array.isArray(split) ? split : []

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
      if (currentReceipt.value) {
        return toolResponse(currentReceipt.value)
      }

      if (!imageBase64 && !rawText) {
        return toolResponse({
          receipt: null,
          summary: 'No receipt input is available to parse.',
        })
      }

      await onEvent({
        type: 'agent_progress',
        message: 'Penny is reading the receipt.',
        stage: 'extract',
      })

      currentRawReceipt.value = await extractReceiptWithOpenAI({
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
      })
      currentReceipt.value = normalizeExtractedReceipt(currentRawReceipt.value)

      return toolResponse(currentReceipt.value)
    },
  })

  const reconcileReceipt = defineReceiptReconcileTool({
    currentReceipt,
    onEvent,
  })

  const editReceipt = defineReceiptEditTool({
    currentReceipt,
    onEvent,
  })

  const searchPreviousSplitsTool = definePreviousSplitsTool({
    chatId,
    currentReceipt,
    groupId,
    onEvent,
    people,
    personId,
  })

  const askFollowUpQuestion = defineFollowUpQuestionTool({
    followUpQuestion,
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
        receipt: currentReceipt.value,
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

  const session = await createPennySession([
    logProgress,
    extractReceipt,
    reconcileReceipt,
    editReceipt,
    searchPreviousSplitsTool,
    askFollowUpQuestion,
    submitSplitPlan,
  ])
  const stopHeartbeats = startHeartbeats({
    finalPlan,
    firstMessage: currentSplit.length
      ? 'Penny is rebalancing the split.'
      : currentReceipt.value
        ? 'Penny is turning the parsed receipt into a split.'
        : 'Penny is reading the receipt and building the split.',
    onEvent,
    sawActivity,
    secondMessage: 'Penny is still working through the split.',
  })
  const unsubscribe = subscribeToSession({
    onEvent,
    sawActivity,
    session,
    statusMessage: currentSplit.length ? 'Penny is revising the split.' : 'Penny is building the split.',
  })
  const previousSplitHints = currentReceipt.value
    ? await loadPreviousSplitHints({
      chatId,
      groupId,
      onEvent,
      people,
      personId,
      receipt: currentReceipt.value,
    })
    : ''

  try {
    await session.prompt(buildPennyPrompt({
      imageBase64,
      message,
      people,
      previousSplitHints,
      rawText,
      receipt: currentReceipt.value,
      split: currentSplit,
      title,
    }))
  } finally {
    stopHeartbeats()
    unsubscribe()
    session.dispose()
  }

  if (!currentReceipt.value) {
    throw new Error('The Penny agent finished without extracting a receipt.')
  }

  if (followUpQuestion.value) {
    return {
      question: followUpQuestion.value,
      rawReceipt: currentRawReceipt.value || currentReceipt.value,
      receipt: currentReceipt.value,
    }
  }

  if (!finalPlan.value) {
    throw new Error('The Penny agent finished without submitting a split plan or follow-up question.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    rawReceipt: currentRawReceipt.value || currentReceipt.value,
    receipt: currentReceipt.value,
  }
}
