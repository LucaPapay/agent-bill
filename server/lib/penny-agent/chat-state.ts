import {
  appendBillChatMessages,
  failRunningBillChatToolMessages,
  normalizeBillChatMessages,
} from '../bill-chat-messages'
import { normalizePeople } from '../bill-analysis'
import { withRunMetadata } from '../bill-run-payload'
import {
  assertPersonCanAccessGroup,
  getGroupMemberNames,
} from '../db'

export function normalizeChatText(value: any) {
  return String(value || '').trim()
}

export function readPennyChatRequest(input: any, current: any) {
  const incomingMessages = normalizeBillChatMessages(input?.messages || [])
  const latestMessage = incomingMessages[incomingMessages.length - 1]
  const latestMessageData = latestMessage?.data && typeof latestMessage.data === 'object' && !Array.isArray(latestMessage.data)
    ? latestMessage.data
    : {}

  return {
    groupId: normalizeChatText(latestMessageData.groupId || current?.groupId),
    incomingMessages,
    latestMessage,
    latestMessageData,
    people: Array.isArray(latestMessageData.people)
      ? normalizePeople(latestMessageData.people)
      : [],
    title: normalizeChatText(latestMessageData.title || current?.title) || 'Untitled bill',
  }
}

export async function resolvePennyChatParticipants({
  fallbackPeople,
  groupId,
  personId,
}: any) {
  const normalizedGroupId = normalizeChatText(groupId)

  if (!normalizedGroupId) {
    return normalizePeople(fallbackPeople)
  }

  await assertPersonCanAccessGroup(personId, normalizedGroupId)
  return normalizePeople(await getGroupMemberNames(normalizedGroupId))
}

export function createPennyChatState({
  chatId,
  current,
  people,
  request,
}: any) {
  return {
    chatId,
    current,
    groupId: request.groupId,
    messages: appendBillChatMessages(
      failRunningBillChatToolMessages(current?.messages || []),
      request.incomingMessages,
    ),
    people,
    rawReceipt: current?.rawReceipt || current?.receipt,
    receipt: current?.receipt || null,
    title: request.title,
  }
}

export function buildPennyPendingSummary({
  latestMessageData,
  receipt,
  split,
}: any) {
  if (receipt && split.length) {
    return 'Penny is revising the split.'
  }

  if (receipt) {
    return 'Penny is building the split.'
  }

  if (normalizeChatText(latestMessageData?.imageBase64) || normalizeChatText(latestMessageData?.rawText)) {
    return 'Receipt uploaded. Penny is parsing the bill items.'
  }

  return 'Penny is working through the chat.'
}

export function buildPennyRunPayload(state: any, base: any, { source, status, summary }: any) {
  const receipt = state.receipt && typeof state.receipt === 'object' && !Array.isArray(state.receipt)
    ? state.receipt
    : undefined
  const title = normalizeChatText(state.title) || 'Untitled bill'

  return {
    billDate: normalizeChatText(base?.billDate || receipt?.billDate),
    billItems: Array.isArray(base?.billItems) ? base.billItems : [],
    chatId: state.chatId,
    currency: normalizeChatText(base?.currency || receipt?.currency) || 'EUR',
    groupId: normalizeChatText(state.groupId || base?.groupId) || undefined,
    items: Array.isArray(base?.items)
      ? base.items
      : Array.isArray(receipt?.items)
        ? receipt.items
        : [],
    merchant: normalizeChatText(base?.merchant || receipt?.merchant || title) || title,
    messages: state.messages,
    notes: Array.isArray(base?.notes)
      ? base.notes
      : Array.isArray(receipt?.notes)
        ? receipt.notes
        : [],
    openai: base?.openai || {
      model: null,
      used: false,
    },
    people: state.people,
    penny: base?.penny || {
      model: null,
      used: false,
    },
    rawReceipt: state.rawReceipt,
    receipt,
    source,
    split: Array.isArray(base?.split) ? base.split : [],
    status,
    summary: normalizeChatText(summary || base?.summary),
    taxCents: Number(base?.taxCents || receipt?.taxCents || 0),
    tipCents: Number(base?.tipCents || receipt?.tipCents || 0),
    title,
    totalCents: Number(base?.totalCents || receipt?.totalCents || 0),
  }
}

export function toSavedPennyChatResult(payload: any, run: any) {
  return withRunMetadata({
    created_at: run.createdAt,
    id: run.id,
    payload,
  })
}
