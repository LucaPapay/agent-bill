import {
  buildBillChatHistory,
  normalizeBillChatMessages,
} from './bill-chat-history'

function parseJsonValue(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  if (!value) {
    return value
  }

  return JSON.parse(value)
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

export function normalizePeople(value: unknown) {
  const parsedValue = parseJsonValue(value)

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .map(entry => String(entry || '').trim())
    .filter(Boolean)
}

function normalizeMessages(value: unknown) {
  const parsedValue = parseJsonValue(value)

  return normalizeBillChatMessages(Array.isArray(parsedValue) ? parsedValue : [])
}

function buildMessagesFromHistory(history: any[]) {
  if (!Array.isArray(history)) {
    return []
  }

  return history
    .map((entry: any) => {
      const who = String(entry?.who || '').trim()
      const text = normalizeText(entry?.text)

      if (!text || (who !== 'penny' && who !== 'user')) {
        return null
      }

      return {
        data: {},
        role: who === 'penny' ? 'assistant' : 'user',
        text,
      }
    })
    .filter(Boolean)
}

function normalizeHistory(value: unknown) {
  const parsedValue = parseJsonValue(value)

  if (!Array.isArray(parsedValue)) {
    return []
  }

  return parsedValue
    .map((entry: any) => {
      const who = String(entry?.who || '').trim()
      const text = normalizeText(entry?.text)

      if (!text || (who !== 'log' && who !== 'penny' && who !== 'user')) {
        return null
      }

      return {
        text,
        who,
      }
    })
    .filter(Boolean)
}

function resolveContextStatus(source: unknown) {
  const normalizedSource = normalizeText(source)

  if (normalizedSource === 'penny-pending') {
    return 'running'
  }

  if (
    normalizedSource === 'penny-message'
    || normalizedSource === 'penny-question'
  ) {
    return 'needs_input'
  }

  if (normalizedSource.endsWith('-error')) {
    return 'error'
  }

  return 'ready'
}

function buildContext(payload: any) {
  const receipt = payload.receipt && typeof payload.receipt === 'object'
    ? payload.receipt
    : undefined

  return {
    billDate: normalizeText(payload.billDate),
    billItems: Array.isArray(payload.billItems) ? payload.billItems : [],
    currency: normalizeText(payload.currency) || 'EUR',
    groupId: normalizeText(payload.groupId) || undefined,
    items: Array.isArray(payload.items) ? payload.items : Array.isArray(receipt?.items) ? receipt.items : [],
    merchant: normalizeText(payload.merchant) || normalizeText(receipt?.merchant) || normalizeText(payload.title) || 'Untitled bill',
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    people: normalizePeople(payload.people),
    receipt,
    source: normalizeText(payload.source),
    split: Array.isArray(payload.split) ? payload.split : [],
    status: resolveContextStatus(payload.source),
    summary: normalizeText(payload.summary),
    taxCents: Number(payload.taxCents || receipt?.taxCents || 0),
    tipCents: Number(payload.tipCents || receipt?.tipCents || 0),
    title: normalizeText(payload.title) || 'Untitled bill',
    totalCents: Number(payload.totalCents || receipt?.totalCents || 0),
  }
}

export function normalizeSavedRunPayload(value: unknown) {
  const payload = parseJsonValue(value)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      billItems: [],
    }
  }

  const normalizedPayload: any = { ...payload }

  if (!Array.isArray(normalizedPayload.billItems)) {
    normalizedPayload.billItems = []
  }

  if (!normalizedPayload.penny && normalizedPayload.pi) {
    normalizedPayload.penny = normalizedPayload.pi
  }

  if (normalizedPayload.source === 'pi-agent-pending' || normalizedPayload.source === 'receipt-pending') {
    normalizedPayload.source = 'penny-pending'
  }

  if (normalizedPayload.source === 'pi-agent-question') {
    normalizedPayload.source = 'penny-question'
  }

  if (normalizedPayload.source === 'pi-agent-split') {
    normalizedPayload.source = 'penny-split'
  }

  if (normalizedPayload.source === 'pi-agent-revision') {
    normalizedPayload.source = 'penny-revision'
  }

  if (normalizedPayload.source === 'pi-agent-revision-error') {
    normalizedPayload.source = 'penny-revision-error'
  }

  if (normalizedPayload.source === 'openai-image+pi-agent') {
    normalizedPayload.source = 'openai-image+penny'
  }

  if (normalizedPayload.source === 'openai-text+pi-agent') {
    normalizedPayload.source = 'openai-text+penny'
  }

  if ((payload as any).rawReceipt === null) {
    delete normalizedPayload.rawReceipt
  }

  if ((payload as any).receipt === null) {
    delete normalizedPayload.receipt
  }

  normalizedPayload.messages = normalizeMessages(normalizedPayload.messages)
  const history = normalizeHistory(normalizedPayload.history)

  if (!normalizedPayload.messages.length) {
    normalizedPayload.messages = buildMessagesFromHistory(history)
  }

  normalizedPayload.history = [
    ...buildBillChatHistory(normalizedPayload.messages),
    ...history.filter((entry: any) => entry.who === 'log'),
  ].slice(-120)

  normalizedPayload.context = buildContext(normalizedPayload.context && typeof normalizedPayload.context === 'object'
    ? {
      ...normalizedPayload,
      ...normalizedPayload.context,
    }
    : normalizedPayload)

  return normalizedPayload
}

export function withRunMetadata(row: any) {
  return {
    ...normalizeSavedRunPayload(row.payload),
    runId: row.id,
    savedAt: row.created_at,
  }
}
