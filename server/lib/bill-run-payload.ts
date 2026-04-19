import { normalizeBillChatMessages } from './bill-chat-messages'

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeNumber(value: unknown) {
  return Number(value || 0)
}

function asObject(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null
}

export function normalizePeople(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(entry => normalizeText(entry))
    .filter(Boolean)
}

function normalizeEngine(value: any) {
  const engine = asObject(value)

  if (!engine) {
    return {
      model: null,
      used: false,
    }
  }

  return {
    model: normalizeText(engine.model) || null,
    used: Boolean(engine.used),
  }
}

function normalizeStatus(value: unknown) {
  const status = normalizeText(value)

  if (
    status === 'error'
    || status === 'needs_input'
    || status === 'ready'
    || status === 'running'
  ) {
    return status
  }

  return 'ready'
}

export function readSavedRunPayload(value: unknown) {
  const payload: any = asObject(value) || {}
  const receipt = asObject(payload.receipt) || undefined
  const title = normalizeText(payload.title || receipt?.merchant) || 'Untitled bill'
  const merchant = normalizeText(payload.merchant || receipt?.merchant || title) || title
  const normalizedPayload: any = {
    billDate: normalizeText(payload.billDate || receipt?.billDate),
    billItems: Array.isArray(payload.billItems) ? payload.billItems : [],
    chatId: normalizeText(payload.chatId),
    currency: normalizeText(payload.currency || receipt?.currency) || 'EUR',
    groupId: normalizeText(payload.groupId) || undefined,
    items: Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(receipt?.items)
        ? receipt.items
        : [],
    merchant,
    messages: normalizeBillChatMessages(payload.messages),
    notes: Array.isArray(payload.notes)
      ? payload.notes
      : Array.isArray(receipt?.notes)
        ? receipt.notes
        : [],
    openai: normalizeEngine(payload.openai),
    people: normalizePeople(payload.people),
    penny: normalizeEngine(payload.penny),
    source: normalizeText(payload.source),
    split: Array.isArray(payload.split) ? payload.split : [],
    status: normalizeStatus(payload.status),
    summary: normalizeText(payload.summary),
    taxCents: normalizeNumber(payload.taxCents || receipt?.taxCents),
    tipCents: normalizeNumber(payload.tipCents || receipt?.tipCents),
    title,
    totalCents: normalizeNumber(payload.totalCents || receipt?.totalCents),
  }

  if (payload.rawReceipt !== null && payload.rawReceipt !== undefined) {
    normalizedPayload.rawReceipt = payload.rawReceipt
  }

  if (receipt) {
    normalizedPayload.receipt = receipt
  }

  return normalizedPayload
}

export function withRunMetadata(row: any) {
  return {
    ...readSavedRunPayload(row.payload),
    linkedBillGroupId: normalizeText(row.linked_bill_group_id) || undefined,
    linkedBillId: normalizeText(row.linked_bill_id) || undefined,
    runId: row.id,
    savedAt: row.created_at,
  }
}
