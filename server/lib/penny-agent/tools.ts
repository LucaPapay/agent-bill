import { Type } from '@earendil-works/pi-ai'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import {
  editExtractedReceipt,
  normalizeExtractedReceipt,
  normalizePeople,
  reconcileExtractedReceipt,
  splitEvenly,
} from '../bill-analysis'
import { extractReceiptWithOpenAI } from '../openai-receipt'
import { searchPreviousSplits } from './previous-splits'

function defineTool(tool: AgentTool): AgentTool {
  return tool
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
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
  const participantNames = split.map((entry: any) => normalizeText(entry.person))
  const allowedPeople = people.length ? people : participantNames

  if (!receipt) {
    return 'Split plan rejected. No parsed receipt is available.'
  }

  if (!people.length) {
    return 'Split plan rejected. No participant list is available yet. Ask the user directly instead of inventing names.'
  }

  if (!participantNames.length || participantNames.some((name: string) => !name)) {
    return 'Split plan rejected. Each split row needs a participant name.'
  }

  if (new Set(participantNames).size !== participantNames.length) {
    return 'Split plan rejected. A participant appears more than once.'
  }

  if (
    participantNames.length !== people.length
    || participantNames.some((name: string) => !people.includes(name))
  ) {
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
    name: normalizeText(item?.name || `Item ${index + 1}`),
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

export function createPennyTools({
  chatId,
  groupId,
  latestMessageData,
  onEvent = () => {},
  people,
  personId,
  rawReceipt,
  receipt,
  title,
}: {
  chatId?: string
  groupId?: string
  latestMessageData?: any
  onEvent?: (payload: any) => void
  people: string[]
  personId?: string
  rawReceipt?: any
  receipt?: any
  title: string
}) {
  const imageBase64 = normalizeText(latestMessageData?.imageBase64)
  const mimeType = normalizeText(latestMessageData?.mimeType)
  const currentRawReceipt = { value: (rawReceipt || receipt || null) as any }
  const currentReceipt = { value: (receipt ? normalizeExtractedReceipt(receipt) : null) as any }
  const finalPlan = { value: null as any }

  const extractReceipt = defineTool({
    name: 'extract_receipt',
    label: 'Extract Receipt',
    description: 'Parse the uploaded receipt image or OCR text into a structured receipt.',
    parameters: Type.Object({}),
    execute: async () => {
      if (currentReceipt.value) {
        return toolResponse(currentReceipt.value)
      }

      if (!imageBase64 && !normalizeText(latestMessageData?.rawText)) {
        return toolResponse({
          receipt: null,
          summary: 'No receipt input is available to parse.',
        })
      }

      currentRawReceipt.value = await extractReceiptWithOpenAI({
        imageBase64,
        mimeType,
        onEvent: async (payload) => {
          if (payload.type === 'receipt_extracted') {
            await onEvent(payload)
          }
        },
        people,
        rawText: normalizeText(latestMessageData?.rawText) || undefined,
        title,
      })
      currentReceipt.value = normalizeExtractedReceipt(currentRawReceipt.value)

      return toolResponse(currentReceipt.value)
    },
  })

  const reconcileReceipt = defineTool({
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

      return toolResponse(result)
    },
  })

  const editReceipt = defineTool({
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

      const reason = normalizeText(params.reason)

      if (!reason) {
        return toolResponse({
          corrections: [],
          receipt: currentReceipt.value,
          summary: 'Provide a non-empty reason before editing the receipt.',
        })
      }

      const result = editExtractedReceipt(currentReceipt.value, {
        billDate: params.billDate,
        currency: params.currency,
        items: params.items,
        merchant: params.merchant,
        subtotalCents: params.subtotalCents,
        taxCents: params.taxCents,
        tipCents: params.tipCents,
        totalCents: params.totalCents,
      }, reason)
      currentReceipt.value = result.receipt

      return toolResponse(result)
    },
  })

  const searchPreviousSplitsTool = defineTool({
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

      if (!normalizeText(groupId)) {
        return toolResponse({
          matches: [],
          summary: 'Select the group before searching previous splits.',
        })
      }

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

  return {
    currentRawReceipt,
    currentReceipt,
    finalPlan,
    tools: [
      extractReceipt,
      reconcileReceipt,
      editReceipt,
      searchPreviousSplitsTool,
      submitSplitPlan,
    ],
  }
}
