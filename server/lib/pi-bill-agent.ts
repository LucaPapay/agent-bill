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
} from './bill-analysis'
import { extractReceiptWithOpenAI } from './openai-receipt'
import { splitPlanSchema } from './receipt-contract'
import { searchPreviousSplits } from './split-memory'

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
    '3. If the extracted receipt math is inconsistent or needs a safe repair, call reconcile_extracted_receipt before you build billItems.',
    '4. Only if the user explicitly corrects extracted data, call edit_extracted_receipt.',
    '5. Turn the parsed receipt into save-ready billItems.',
    '6. Make sure the billItems sum exactly to the receipt total, including tax, tip, and any rounding.',
    '7. Derive the participant split from those billItems.',
    '8. Call submit_split_plan exactly once.',
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
    '- Use reconcile_extracted_receipt for safe math cleanup such as subtotal, tax, tip, total, money-scale, or rounding issues.',
    '- Do not call edit_extracted_receipt unless the user explicitly corrects the extracted receipt.',
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
    `Subtotal: ${formatMoney(receipt?.subtotalCents || 0, receipt?.currency || 'EUR')}`,
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

function buildPreviousSplitHintText(matches: any[]) {
  return matches
    .slice(0, 3)
    .map((match: any, index: number) => {
      const itemNames = (match.billItems || [])
        .slice(0, 6)
        .map((item: any) => String(item?.name || '').trim())
        .filter(Boolean)
        .join(', ')
      const splitSummary = (match.split || [])
        .slice(0, 6)
        .map((entry: any) => `${entry.person}: ${formatMoney(entry.amountCents || 0)}`)
        .join(', ')
      const reasons = Array.isArray(match.why) ? match.why.join(', ') : ''
      const sourceLabel = match.source === 'ledger_bill' ? 'Saved bill' : 'Saved split chat'

      return [
        `${index + 1}. ${match.title || match.merchant || 'Untitled bill'}`,
        `${sourceLabel}${match.groupName ? ` in ${match.groupName}` : ''}${match.billDate ? ` on ${match.billDate}` : ''}`,
        match.people?.length ? `People: ${match.people.join(', ')}` : '',
        itemNames ? `Items: ${itemNames}` : '',
        splitSummary ? `Split: ${splitSummary}` : '',
        reasons ? `Why it matches: ${reasons}` : '',
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')
}

function buildRevisionPrompt({ message, people, previousSplitHints, receipt, split, title }: {
  message: string
  people: string[]
  previousSplitHints?: string
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
    '2. If the receipt math needs a safe repair, call reconcile_extracted_receipt before you touch the split.',
    '3. Only if the user explicitly corrects extracted receipt data, call edit_extracted_receipt.',
    '4. Review the previous split hints below when they are present. Only if you still need a narrower lookup, call search_previous_splits once before you assign billItems.',
    '5. Rework the save-ready billItems using the parsed receipt and the current split.',
    '6. Recompute the participant split from those billItems.',
    '7. Either call submit_split_plan exactly once or call ask_follow_up_question exactly once.',
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- If the user only clarifies ownership, keep the total and rebalance the shares.',
    '- Keep notes short and concrete.',
    '- Use reconcile_extracted_receipt for safe math cleanup such as subtotal, tax, tip, total, money-scale, or rounding issues.',
    '- Do not call edit_extracted_receipt unless the user explicitly corrects the extracted receipt.',
    '- Use the previous split hints below when the dish ownership is ambiguous, when the group tends to order similar meals, or when the user references a previous split.',
    '- If the preloaded hints are not enough, call search_previous_splits once with a narrower query before you assign billItems.',
    '- Treat previous splits as hints, not truth. Prefer same group and same people when you borrow any pattern.',
    '- Do not use previous split memory until the group is known.',
    '- Only call ask_follow_up_question after you have considered the previous split hints below.',
    ...buildClarificationRules(),
    ...buildParticipantRules(people),
    '',
    'User follow-up:',
    message,
    '',
    'Parsed receipt:',
    buildReceiptSummary(receipt),
    '',
    previousSplitHints ? `Previous split hints:\n${previousSplitHints}` : '',
    previousSplitHints ? '' : '',
    'Current split:',
    buildCurrentSplitSummary(split, receipt?.currency || 'EUR'),
  ].join('\n')
}

function buildReceiptSplitPrompt({ message, people, previousSplitHints, receipt, title }: {
  message: string
  people: string[]
  previousSplitHints?: string
  receipt: any
  title: string
}) {
  return [
    `You are Penny, the bill-splitting agent for "${title}".`,
    'The receipt is already parsed. Do not ask for more data and do not call extract_receipt.',
    'Create the first split from the parsed receipt and the user instruction.',
    'Follow this exact order:',
    '1. Immediately call log_progress with stage "split".',
    '2. If the receipt math needs a safe repair, call reconcile_extracted_receipt before you build billItems.',
    '3. Only if the user explicitly corrects extracted receipt data, call edit_extracted_receipt.',
    '4. Review the previous split hints below when they are present. Only if you still need a narrower lookup, call search_previous_splits once before you assign billItems.',
    '5. Build save-ready billItems using the parsed receipt and the user instruction.',
    '6. Compute the participant split from those billItems.',
    '7. Either call submit_split_plan exactly once or call ask_follow_up_question exactly once.',
    'Rules:',
    '- The split amounts must sum exactly to the receipt total.',
    '- The billItems must sum exactly to the receipt total.',
    '- Each billItem must have a short name, a positive amount, and one or more assignedPeople.',
    '- The split must exactly match the totals implied by billItems when each billItem is split evenly across its assignedPeople.',
    '- Shared food can be split across everyone when ownership is unclear.',
    '- Keep original receipt item names when practical, but you may add short adjustment items for shared tax, tip, or rounding.',
    '- Respect explicit user instructions when they do not break the receipt total.',
    '- Keep notes short and concrete.',
    '- Use reconcile_extracted_receipt for safe math cleanup such as subtotal, tax, tip, total, money-scale, or rounding issues.',
    '- Do not call edit_extracted_receipt unless the user explicitly corrects the extracted receipt.',
    '- Use the previous split hints below when the dish ownership is ambiguous, when the group tends to order similar meals, or when the user references a previous split.',
    '- If the preloaded hints are not enough, call search_previous_splits once with a narrower query before you assign billItems.',
    '- Treat previous splits as hints, not truth. Prefer same group and same people when you borrow any pattern.',
    '- Do not use previous split memory until the group is known.',
    '- Only call ask_follow_up_question after you have considered the previous split hints below. If those hints support a practical first split, make it instead of asking who had what.',
    '- If the user only gave you the group or participant list, use the previous split hints first. Only call ask_follow_up_question if those hints still do not give you a practical first split.',
    ...buildClarificationRules(),
    ...buildGroupSelectionRules(people),
    ...buildParticipantRules(people),
    '',
    'User instruction:',
    message,
    '',
    'Parsed receipt:',
    buildReceiptSummary(receipt),
    '',
    previousSplitHints ? `Previous split hints:\n${previousSplitHints}` : '',
  ].join('\n')
}

async function loadPreviousSplitHints({
  chatId,
  groupId,
  onEvent,
  people,
  personId,
  receipt,
}: {
  chatId?: string
  groupId?: string
  onEvent: (payload: any) => void
  people: string[]
  personId?: string
  receipt: any
}) {
  if (!personId || !receipt || !String(groupId || '').trim()) {
    return ''
  }

  await onEvent({
    type: 'agent_progress',
    message: 'Penny is checking what this group ate before.',
    stage: 'memory',
  })

  const result = await searchPreviousSplits({
    chatId,
    groupId,
    maxResults: 3,
    people,
    personId,
    receipt,
  })

  if (!result.matches.length) {
    return ''
  }

  await onEvent({
    type: 'agent_progress',
    message: result.summary,
    stage: 'memory',
  })

  return buildPreviousSplitHintText(result.matches)
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

  const currentRawReceipt = { value: null as any }
  const currentReceipt = { value: null as any }
  const finalPlan = { value: null as any }
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

      if (!currentReceipt.value) {
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
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(currentReceipt.value),
        }],
        details: {},
      }
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

  const session = await createPiSession([extractReceipt, logProgress, reconcileReceipt, editReceipt, submitSplitPlan])
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

  if (!currentReceipt.value) {
    throw new Error('The Pi agent finished without extracting a receipt.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    rawReceipt: currentRawReceipt.value || currentReceipt.value,
    receipt: currentReceipt.value,
  }
}

export async function runPiBillRevisionAgent({
  chatId,
  groupId,
  message,
  onEvent = () => {},
  people,
  personId,
  rawReceipt,
  receipt,
  split,
  title,
}: {
  chatId?: string
  groupId?: string
  message: string
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
  rawReceipt?: any
  receipt: any
  split: any[]
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  const currentRawReceipt = { value: rawReceipt || receipt }
  const currentReceipt = { value: normalizeExtractedReceipt(receipt) }
  const finalPlan = { value: null as any }
  const followUpQuestion = { value: '' }
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

  const askFollowUpQuestion = defineFollowUpQuestionTool({
    followUpQuestion,
  })

  const session = await createPiSession([
    logProgress,
    reconcileReceipt,
    editReceipt,
    searchPreviousSplitsTool,
    askFollowUpQuestion,
    submitSplitPlan,
  ])
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
  const previousSplitHints = await loadPreviousSplitHints({
    chatId,
    groupId,
    onEvent,
    people,
    personId,
    receipt: currentReceipt.value,
  })

  try {
    await session.prompt(buildRevisionPrompt({
      message,
      people,
      previousSplitHints,
      receipt: currentReceipt.value,
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
      rawReceipt: currentRawReceipt.value || currentReceipt.value,
      receipt: currentReceipt.value,
    }
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a revised split plan.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    rawReceipt: currentRawReceipt.value || currentReceipt.value,
    receipt: currentReceipt.value,
  }
}

export async function runPiBillReceiptSplitAgent({
  chatId,
  groupId,
  message,
  onEvent = () => {},
  people,
  personId,
  rawReceipt,
  receipt,
  title,
}: {
  chatId?: string
  groupId?: string
  message: string
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
  rawReceipt?: any
  receipt: any
  title: string
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for the Pi agent loop.')
  }

  const currentRawReceipt = { value: rawReceipt || receipt }
  const currentReceipt = { value: normalizeExtractedReceipt(receipt) }
  const finalPlan = { value: null as any }
  const followUpQuestion = { value: '' }
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

  const askFollowUpQuestion = defineFollowUpQuestionTool({
    followUpQuestion,
  })
  const selectGroup = defineSelectGroupTool({
    followUpQuestion,
  })

  const session = await createPiSession([
    logProgress,
    reconcileReceipt,
    editReceipt,
    searchPreviousSplitsTool,
    selectGroup,
    askFollowUpQuestion,
    submitSplitPlan,
  ])
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
  const previousSplitHints = await loadPreviousSplitHints({
    chatId,
    groupId,
    onEvent,
    people,
    personId,
    receipt: currentReceipt.value,
  })

  try {
    await session.prompt(buildReceiptSplitPrompt({
      message,
      people,
      previousSplitHints,
      receipt: currentReceipt.value,
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
      rawReceipt: currentRawReceipt.value || currentReceipt.value,
      receipt: currentReceipt.value,
    }
  }

  if (!finalPlan.value) {
    throw new Error('The Pi agent finished without submitting a split plan.')
  }

  return {
    plan: splitPlanSchema.parse(finalPlan.value),
    rawReceipt: currentRawReceipt.value || currentReceipt.value,
    receipt: currentReceipt.value,
  }
}
