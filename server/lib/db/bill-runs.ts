import { Session } from '@earendil-works/pi-agent-core'
import { normalizePeople } from '../bill-analysis'
import {
  BillSessionStorage,
  billSessionRepo,
  type BillChatSessionMetadata,
} from '../penny-agent/session-storage'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function readTextContent(content: any) {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter((part: any) => part?.type === 'text')
    .map((part: any) => String(part.text || ''))
    .join('')
    .trim()
}

function toChatMessages(messages: any[]) {
  return messages.flatMap((message: any) => {
    if (message.role === 'user') {
      return [{
        data: {},
        role: 'user',
        text: readTextContent(message.content),
      }]
    }

    if (message.role === 'assistant') {
      const text = readTextContent(message.content)
      return text
        ? [{
            data: {},
            role: 'assistant',
            text,
          }]
        : []
    }

    if (message.role === 'toolResult') {
      return [{
        data: {
          state: message.isError ? 'error' : 'done',
          toolName: normalizeText(message.toolName),
        },
        role: 'assistant',
        text: '',
      }]
    }

    return []
  }).slice(-120)
}

function splitPlan(metadata: BillChatSessionMetadata) {
  const value = metadata.currentSplit
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as any
    : { split: Array.isArray(value) ? value : [] }
}

async function buildChatResult(metadata: BillChatSessionMetadata) {
  const session = new Session(new BillSessionStorage(metadata.personId, metadata.id))
  const context = await session.buildContext()
  const receipt = metadata.extractedData && typeof metadata.extractedData === 'object' && !Array.isArray(metadata.extractedData)
    ? metadata.extractedData as any
    : undefined
  const plan = splitPlan(metadata)
  const split = Array.isArray(plan.split) ? plan.split : []
  const billItems = Array.isArray(plan.billItems) ? plan.billItems : []
  const totalCents = Number(metadata.totalCents || receipt?.totalCents || 0)
  const title = normalizeText(metadata.title) || normalizeText(receipt?.merchant) || 'Untitled bill'

  return {
    billDate: normalizeText(receipt?.billDate),
    billItems,
    chatId: metadata.id,
    currency: normalizeText(receipt?.currency) || 'EUR',
    groupId: metadata.groupId || undefined,
    items: Array.isArray(receipt?.items) ? receipt.items : [],
    linkedBillGroupId: metadata.groupId || undefined,
    linkedBillId: metadata.billId || undefined,
    merchant: normalizeText(receipt?.merchant || title) || title,
    messages: toChatMessages(context.messages),
    notes: Array.isArray(plan.notes)
      ? plan.notes
      : Array.isArray(receipt?.notes)
        ? receipt.notes
        : [],
    openai: {
      model: process.env.OPENAI_RECEIPT_MODEL || 'gpt-4.1-mini',
      used: Boolean(receipt),
    },
    people: normalizePeople(metadata.people),
    penny: {
      model: process.env.PENNY_AGENT_MODEL || process.env.PI_AGENT_MODEL || 'gpt-4.1-mini',
      used: context.messages.length > 0,
    },
    receipt,
    runId: metadata.id,
    savedAt: metadata.createdAt,
    source: split.length ? 'penny-split' : 'penny-message',
    split,
    status: metadata.status as 'error' | 'needs_input' | 'ready' | 'running',
    summary: normalizeText(metadata.summary || plan.summary),
    taxCents: Number(receipt?.taxCents || 0),
    tipCents: Number(receipt?.tipCents || 0),
    title,
    totalCents,
  }
}

export async function getBillChat(personId: string, chatId: string) {
  const session = await billSessionRepo.open({
    billId: null,
    createdAt: '',
    currentSplit: null,
    extractedData: null,
    groupId: null,
    id: chatId,
    people: [],
    personId,
    status: 'running',
    summary: '',
    title: '',
    totalCents: 0,
  })
  return await buildChatResult(await session.getMetadata())
}

export async function listBillChats(personId: string) {
  const metadata = await billSessionRepo.list({ personId })

  return metadata.map((chat) => ({
    chatId: chat.id,
    linkedBillGroupId: chat.groupId || undefined,
    linkedBillId: chat.billId || undefined,
    people: normalizePeople(chat.people),
    summary: normalizeText(chat.summary),
    title: normalizeText(chat.title) || 'Untitled bill',
    totalCents: Number(chat.totalCents || 0),
    updatedAt: chat.createdAt,
  }))
}
